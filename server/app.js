// Builds the Express application. Kept separate from index.js so the
// automated tests can create the app with an in-memory database.
import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { config } from './config.js';
import { authRouter, verifyAppToken, TOKEN_COOKIE } from './auth.js';
import { createCapsulesRouter } from './capsules.js';

export function createApp({ db }) {
  const app = express();

  // Render terminates HTTPS at its proxy and forwards plain HTTP to us.
  app.set('trust proxy', 1);

  // Security headers (CSP etc.). Images may come from GitHub avatars (https).
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          'img-src': ["'self'", 'data:', 'https:'],
          // Only force HTTPS sub-resources in production (local dev is plain http).
          ...(config.isProduction ? {} : { 'upgrade-insecure-requests': null }),
        },
      },
    })
  );
  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());

  // ---------------------------------------------------------------- API
  // Public health check - used by markers and by Render's health check.
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  // GitHub OAuth login / logout / current user
  app.use('/api/auth', authRouter);

  // Protected CRUD API (JWT middleware is applied inside the router on every route)
  app.use('/api/capsules', createCapsulesRouter(db));

  // Unknown API routes -> JSON 404 (never the React page)
  app.use('/api', (req, res) => {
    res.status(404).json({ error: 'Not Found', path: req.originalUrl });
  });

  // ---------------------------------------------------------- Frontend
  // Server-side guard: /dashboard is only served with a valid JWT cookie.
  // (The React app also checks /api/auth/me, and the API itself returns 401.)
  app.get('/dashboard', (req, res, next) => {
    try {
      verifyAppToken(req.cookies?.[TOKEN_COOKIE]);
      return next();
    } catch {
      return res.redirect('/login');
    }
  });

  // Serve the built React app (client/dist) from the same URL as the API,
  // so no CORS or cross-site cookie configuration is needed.
  const indexHtml = path.join(config.clientDistDir, 'index.html');
  if (fs.existsSync(indexHtml)) {
    app.use(express.static(config.clientDistDir));
    // React Router handles /, /login and /dashboard in the browser.
    app.get(/.*/, (req, res) => res.sendFile(indexHtml));
  } else {
    app.get('/', (req, res) => {
      res.type('text').send('AI Capsule API is running. Frontend not built yet - run "npm run build".');
    });
  }

  // ------------------------------------------------------ Error handler
  app.use((err, req, res, next) => {
    if (err.type === 'entity.parse.failed') {
      return res.status(400).json({ error: 'Invalid JSON body' });
    }
    if (err.type === 'entity.too.large') {
      return res.status(413).json({ error: 'Request body too large' });
    }
    console.error(err);
    return res.status(500).json({ error: 'Internal Server Error' });
  });

  return app;
}
