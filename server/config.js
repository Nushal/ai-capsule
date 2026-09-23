// Central configuration. Every secret comes from environment variables -
// nothing secret is hard-coded or committed to Git.
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const ROOT_DIR = path.resolve(__dirname, '..');

// Local development: load variables from ./.env if the file exists.
// On Render there is no .env file - variables are set in the dashboard,
// and values that are already set in the environment are never overwritten.
try {
  process.loadEnvFile(path.join(ROOT_DIR, '.env'));
} catch (err) {
  if (err.code !== 'ENOENT') throw err;
}

const port = Number(process.env.PORT) || 3000;

export const config = {
  port,
  isProduction: process.env.NODE_ENV === 'production',

  // Secret used to sign and verify the application JWT (HS256).
  jwtSecret: process.env.JWT_SECRET,

  // GitHub OAuth App credentials.
  githubClientId: process.env.GITHUB_CLIENT_ID || '',
  githubClientSecret: process.env.GITHUB_CLIENT_SECRET || '',
  githubCallbackUrl:
    process.env.GITHUB_CALLBACK_URL || `http://localhost:${port}/api/auth/github/callback`,

  // SQLite database file. On Render's free plan this lives on an
  // ephemeral disk (see README "Storage").
  dbPath: process.env.DB_PATH || path.join(ROOT_DIR, 'data', 'capsules.db'),

  // Built React app served by Express in production.
  clientDistDir: path.join(ROOT_DIR, 'client', 'dist'),
};

// Fail fast: the app must never run with a missing or weak JWT secret.
if (!config.jwtSecret || config.jwtSecret.length < 32) {
  throw new Error(
    'JWT_SECRET is missing or shorter than 32 characters. Set it in .env (local) or in the Render environment variables.'
  );
}

export function isGitHubConfigured() {
  return Boolean(
    config.githubClientId &&
      config.githubClientSecret &&
      !config.githubClientId.startsWith('paste-your') &&
      !config.githubClientSecret.startsWith('paste-your')
  );
}
