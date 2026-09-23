// GitHub OAuth login + application JWT.
//
// Flow:
//   1. /login page links to GET /api/auth/github/start
//   2. We create a random "state" value (CSRF protection), keep it in a short-lived
//      HttpOnly cookie and redirect the browser to GitHub's authorize page.
//   3. GitHub redirects back to GET /api/auth/github/callback?code=...&state=...
//   4. We check the state, then exchange the code for a GitHub access token
//      server-to-server (the client secret never reaches the browser).
//   5. We read the GitHub profile, then sign OUR OWN application JWT with
//      JWT_SECRET. The GitHub access token is thrown away - it is not the JWT.
//   6. The JWT goes into a Secure, HttpOnly, SameSite=Lax cookie named "token".
//   7. requireAuth() verifies that cookie on every protected request.
import crypto from 'node:crypto';
import express from 'express';
import jwt from 'jsonwebtoken';
import { config, isGitHubConfigured } from './config.js';

export const TOKEN_COOKIE = 'token';
const STATE_COOKIE = 'oauth_state';
const TOKEN_TTL_SECONDS = 2 * 60 * 60; // 2 hours
const JWT_ISSUER = 'ai-capsule';

// Cookie settings for the application JWT.
//  httpOnly - JavaScript in the page cannot read it (protects against XSS token theft)
//  secure   - only sent over HTTPS (browsers also treat http://localhost as secure)
//  sameSite - 'lax' blocks the cookie on cross-site POST/PUT/DELETE (CSRF)
const tokenCookieOptions = {
  httpOnly: true,
  secure: true,
  sameSite: 'lax',
  path: '/',
};

// ---------------------------------------------------------------------------
// JWT helpers
// ---------------------------------------------------------------------------
export function signAppToken(user) {
  return jwt.sign(
    {
      sub: String(user.id), // GitHub user ID - becomes capsules.user_id
      login: user.login,
      name: user.name || user.login,
      avatar_url: user.avatar_url || null,
    },
    config.jwtSecret,
    { algorithm: 'HS256', expiresIn: TOKEN_TTL_SECONDS, issuer: JWT_ISSUER }
  );
}

export function verifyAppToken(token) {
  // Throws if the token is missing, malformed, has a bad signature,
  // uses a different algorithm, has the wrong issuer or has expired.
  return jwt.verify(token, config.jwtSecret, { algorithms: ['HS256'], issuer: JWT_ISSUER });
}

// ---------------------------------------------------------------------------
// JWT authentication middleware - used on EVERY /api/capsules route
// ---------------------------------------------------------------------------
export function requireAuth(req, res, next) {
  const token = req.cookies?.[TOKEN_COOKIE];
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized', message: 'Authentication required. Please log in.' });
  }
  try {
    const payload = verifyAppToken(token);
    // The ONLY source of the user's identity for the rest of the request.
    req.user = {
      id: payload.sub,
      login: payload.login,
      name: payload.name,
      avatarUrl: payload.avatar_url,
    };
    return next();
  } catch {
    return res.status(401).json({ error: 'Unauthorized', message: 'Invalid or expired token. Please log in again.' });
  }
}

// ---------------------------------------------------------------------------
// GitHub API helpers
// ---------------------------------------------------------------------------
async function exchangeCodeForAccessToken(code) {
  const response = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: config.githubClientId,
      client_secret: config.githubClientSecret,
      code,
      redirect_uri: config.githubCallbackUrl,
    }),
  });
  const data = await response.json();
  if (!response.ok || data.error || !data.access_token) {
    throw new Error(data.error_description || data.error || 'GitHub did not return an access token.');
  }
  return data.access_token;
}

async function fetchGitHubUser(accessToken) {
  const response = await fetch('https://api.github.com/user', {
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${accessToken}`,
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'AI-Capsule',
    },
  });
  const data = await response.json();
  if (!response.ok || !data.id) {
    throw new Error(data.message || 'Could not read the GitHub user profile.');
  }
  return data;
}

// ---------------------------------------------------------------------------
// Routes mounted at /api/auth
// ---------------------------------------------------------------------------
export const authRouter = express.Router();

// Step 2: start the OAuth flow
authRouter.get('/github/start', (req, res) => {
  if (!isGitHubConfigured()) {
    return res
      .status(500)
      .send('GitHub OAuth is not configured. Set GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET and GITHUB_CALLBACK_URL.');
  }

  const state = crypto.randomBytes(24).toString('hex');
  res.cookie(STATE_COOKIE, state, {
    ...tokenCookieOptions,
    path: '/api/auth/github',
    maxAge: 10 * 60 * 1000, // 10 minutes to finish logging in
  });

  const params = new URLSearchParams({
    client_id: config.githubClientId,
    redirect_uri: config.githubCallbackUrl,
    scope: 'read:user',
    state,
    allow_signup: 'true',
  });
  return res.redirect(`https://github.com/login/oauth/authorize?${params}`);
});

// Steps 3-6: GitHub redirects back here
authRouter.get('/github/callback', async (req, res) => {
  const { code, state, error } = req.query;
  const expectedState = req.cookies?.[STATE_COOKIE];
  res.clearCookie(STATE_COOKIE, { ...tokenCookieOptions, path: '/api/auth/github' });

  if (error) {
    return res.redirect('/login?error=access_denied');
  }
  // Reject forged callbacks: the state GitHub returns must match our cookie.
  if (!code || !state || !expectedState || state !== expectedState) {
    return res.redirect('/login?error=invalid_state');
  }

  try {
    const githubAccessToken = await exchangeCodeForAccessToken(String(code));
    const githubUser = await fetchGitHubUser(githubAccessToken);

    const appToken = signAppToken(githubUser);
    res.cookie(TOKEN_COOKIE, appToken, { ...tokenCookieOptions, maxAge: TOKEN_TTL_SECONDS * 1000 });

    console.log(`GitHub login OK: ${githubUser.login} (id ${githubUser.id})`);
    return res.redirect('/dashboard');
  } catch (err) {
    console.error('GitHub OAuth callback failed:', err.message);
    return res.redirect('/login?error=oauth_failed');
  }
});

// Who is logged in? Used by the React app to protect /dashboard.
authRouter.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user });
});

// Log out: remove the JWT cookie.
authRouter.post('/logout', (req, res) => {
  res.clearCookie(TOKEN_COOKIE, tokenCookieOptions);
  res.json({ ok: true });
});
