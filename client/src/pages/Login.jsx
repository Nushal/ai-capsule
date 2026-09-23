import { useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import Logo from '../components/Logo.jsx';
import GitHubIcon from '../components/GitHubIcon.jsx';
import { api } from '../api.js';

const ERRORS = {
  access_denied: 'GitHub sign-in was cancelled.',
  invalid_state: 'Your sign-in attempt expired or could not be verified. Please try again.',
  oauth_failed: 'GitHub sign-in failed. Please try again.',
  session_expired: 'Your session has expired. Please sign in again.',
};

export default function Login() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const error = ERRORS[params.get('error')];

  // Already signed in? Go straight to the dashboard.
  useEffect(() => {
    api.me().then(() => navigate('/dashboard', { replace: true })).catch(() => {});
  }, [navigate]);

  return (
    <div className="auth-page">
      <div className="auth-card">
        <Link to="/" className="auth-logo"><Logo size={36} /></Link>
        <h1>Sign in to AI Capsule</h1>
        <p className="muted">Use your GitHub account. No new password needed.</p>

        {error && <div className="alert alert-error" role="alert">{error}</div>}

        {/* A normal link (not fetch): the browser must leave the page for GitHub's OAuth screen. */}
        <a className="btn btn-github btn-lg btn-block" href="/api/auth/github/start">
          <GitHubIcon /> Continue with GitHub
        </a>

        <p className="fine-print">
          We only read your public GitHub profile (user ID, username and avatar). Your GitHub user ID is used to keep
          your capsules separate from everyone else&apos;s.
        </p>
      </div>
    </div>
  );
}
