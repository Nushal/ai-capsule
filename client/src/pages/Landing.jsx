import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Logo from '../components/Logo.jsx';
import { api } from '../api.js';

const FEATURES = [
  {
    title: 'Capture',
    text: 'Save the exact prompt, the project it was for and a short summary of what the AI said back.',
  },
  {
    title: 'Version',
    text: 'Keep v1, v2 and v3 of a prompt side by side so you can see what change made the difference.',
  },
  {
    title: 'Review',
    text: 'Rate usefulness, mark whether you checked the response and whether the output improved.',
  },
];

const STEPS = [
  'Sign in with your GitHub account',
  'Save a prompt as a capsule',
  'Review, rate and add evidence',
  'Edit it into the next version',
];

export default function Landing() {
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    api.me().then(() => setSignedIn(true)).catch(() => setSignedIn(false));
  }, []);

  const cta = signedIn ? (
    <Link to="/dashboard" className="btn btn-primary btn-lg">Open your dashboard</Link>
  ) : (
    <Link to="/login" className="btn btn-primary btn-lg">Sign in to get started</Link>
  );

  return (
    <div className="landing">
      <nav className="topnav container">
        <Logo />
        {signedIn ? (
          <Link to="/dashboard" className="btn btn-ghost">Dashboard</Link>
        ) : (
          <Link to="/login" className="btn btn-ghost">Sign in</Link>
        )}
      </nav>

      <header className="hero container">
        <div className="hero-copy">
          <p className="eyebrow">Private prompt library</p>
          <h1>Keep the AI prompts that actually worked.</h1>
          <p className="lead">
            You use ChatGPT, Copilot, Gemini and Claude for coding, writing and study, but the good prompts get
            lost in old chats. AI Capsule gives you one private place to save, review and improve them.
          </p>
          <div className="hero-actions">{cta}</div>
        </div>

        <div className="hero-visual" aria-hidden="true">
          <div className="capsule capsule-demo">
            <div className="capsule-tags">
              <span className="project">SmartFarm Irrigation</span>
              <span className="badge badge-version">v2</span>
              <span className="badge">Debugging</span>
            </div>
            <h3>Debug cloud deployment</h3>
            <div className="prompt-block">
              <div className="prompt-label"><span>Prompt</span></div>
              <pre>My Express app works locally but Render says "Application exited early". What should I check?</pre>
            </div>
            <div className="capsule-field">
              <span className="field-label">Response summary</span>
              <p>Use process.env.PORT and check the start command.</p>
            </div>
            <div className="chips">
              <span className="chip chip-good">Very Useful</span>
              <span className="chip chip-good">✓ Reviewed</span>
              <span className="chip chip-good">✓ Improved</span>
            </div>
          </div>
        </div>
      </header>

      <section className="container features">
        {FEATURES.map((feature) => (
          <div className="feature" key={feature.title}>
            <h2>{feature.title}</h2>
            <p>{feature.text}</p>
          </div>
        ))}
      </section>

      <section className="container how">
        <h2>How it works</h2>
        <ol className="steps">
          {STEPS.map((step, index) => (
            <li key={step}>
              <span className="step-num">{index + 1}</span>
              {step}
            </li>
          ))}
        </ol>
        <p className="privacy-note">
          Your capsules are private. Every request is checked against a signed session token issued by our server,
          and you can only ever see, edit or delete your own records.
        </p>
      </section>

      <footer className="site-footer container">
        <span>AI Capsule · React · Express · SQLite · GitHub OAuth · JWT</span>
        <span>CSE3CWA / CSE5006 Assessment 3</span>
      </footer>
    </div>
  );
}
