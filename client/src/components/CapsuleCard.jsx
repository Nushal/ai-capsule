import { useState } from 'react';
import { formatDate } from '../api.js';

const USEFULNESS_TONE = {
  'Very Useful': 'good',
  Good: 'good',
  'Needs Improvement': 'warn',
  'Not Useful': 'bad',
};

export default function CapsuleCard({ capsule, confirming, onEdit, onAskDelete, onCancelDelete, onDelete }) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const isLong = capsule.prompt_text.length > 220 || capsule.prompt_text.split('\n').length > 4;

  async function copyPrompt() {
    try {
      await navigator.clipboard.writeText(capsule.prompt_text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard not available */
    }
  }

  return (
    <article className="capsule" data-testid="capsule-card">
      <header className="capsule-head">
        <div className="capsule-tags">
          <span className="project">{capsule.project_name}</span>
          {capsule.prompt_version && <span className="badge badge-version">{capsule.prompt_version}</span>}
          {capsule.category && <span className="badge">{capsule.category}</span>}
        </div>
        <h3>{capsule.prompt_title}</h3>
        <p className="dates">
          Created {formatDate(capsule.created_at)}
          {capsule.updated_at && <> · Edited {formatDate(capsule.updated_at)}</>}
        </p>
      </header>

      <div className="prompt-block">
        <div className="prompt-label">
          <span>Prompt</span>
          <button type="button" className="link-btn" onClick={copyPrompt}>
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
        <pre className={expanded ? '' : 'clamp'}>{capsule.prompt_text}</pre>
        {isLong && (
          <button type="button" className="link-btn" onClick={() => setExpanded((v) => !v)}>
            {expanded ? 'Show less' : 'Show more'}
          </button>
        )}
      </div>

      {capsule.response_summary && (
        <div className="capsule-field">
          <span className="field-label">Response summary</span>
          <p>{capsule.response_summary}</p>
        </div>
      )}
      {capsule.notes && (
        <div className="capsule-field">
          <span className="field-label">Notes</span>
          <p>{capsule.notes}</p>
        </div>
      )}

      <div className="chips">
        {capsule.usefulness && (
          <span className={`chip chip-${USEFULNESS_TONE[capsule.usefulness] || 'neutral'}`}>{capsule.usefulness}</span>
        )}
        <span className={`chip ${capsule.reviewed ? 'chip-good' : 'chip-neutral'}`}>
          {capsule.reviewed ? '✓ Reviewed' : '○ Not reviewed'}
        </span>
        <span className={`chip ${capsule.improved ? 'chip-good' : 'chip-neutral'}`}>
          {capsule.improved ? '✓ Improved' : '○ Not improved'}
        </span>
        {capsule.screenshot_url && (
          <a className="chip chip-link" href={capsule.screenshot_url} target="_blank" rel="noopener noreferrer">
            Screenshot ↗
          </a>
        )}
      </div>

      <footer className="capsule-foot">
        {confirming ? (
          <div className="actions confirm">
            <span>Delete this capsule?</span>
            <button type="button" className="btn btn-sm btn-ghost" onClick={onCancelDelete}>
              Keep
            </button>
            <button type="button" className="btn btn-sm btn-danger" onClick={() => onDelete(capsule.id)}>
              Yes, delete
            </button>
          </div>
        ) : (
          <div className="actions">
            <button type="button" className="btn btn-sm btn-ghost" onClick={() => onEdit(capsule)}>
              Edit
            </button>
            <button type="button" className="btn btn-sm btn-ghost danger-text" onClick={() => onAskDelete(capsule.id)}>
              Delete
            </button>
          </div>
        )}
      </footer>
    </article>
  );
}
