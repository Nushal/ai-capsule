// Entry point: open the database, build the app and start listening.
import { config, isGitHubConfigured } from './config.js';
import { openDatabase } from './db.js';
import { createApp } from './app.js';

const db = openDatabase(config.dbPath);
const app = createApp({ db });

app.listen(config.port, () => {
  console.log(`AI Capsule listening on port ${config.port} (${config.isProduction ? 'production' : 'development'})`);
  console.log(`SQLite database: ${config.dbPath}`);
  console.log(`GitHub OAuth configured: ${isGitHubConfigured() ? 'yes' : 'NO - set GITHUB_CLIENT_ID / GITHUB_CLIENT_SECRET'}`);
  console.log(`OAuth callback URL: ${config.githubCallbackUrl}`);
});
