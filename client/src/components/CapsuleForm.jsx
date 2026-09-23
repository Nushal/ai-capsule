import { useState } from 'react';
import { CATEGORIES, USEFULNESS } from '../api.js';

const EMPTY = {
  project_name: '',
  prompt_title: '',
  prompt_version: 'v1',
  prompt_text: '',
  response_summary: '',
  category: 'Coding',
  usefulness: 'Good',
  reviewed: false,
  improved: false,
  screenshot_url: '',
  notes: '',
};

// Used for both CREATE and UPDATE. Note there is no user_id field:
// the server takes the owner from the verified JWT.
export default function CapsuleForm({ initial, saving, errors, onSubmit, onCancel }) {
  const [values, setValues] = useState(() => {
    if (!initial) return EMPTY;
    const merged = { ...EMPTY };
    for (const key of Object.keys(EMPTY)) {
      if (initial[key] !== null && initial[key] !== undefined) merged[key] = initial[key];
    }
    return merged;
  });

  function update(event) {
    const { name, type, value, checked } = event.target;
    setValues((current) => ({ ...current, [name]: type === 'checkbox' ? checked : value }));
  }

  function handleSubmit(event) {
    event.preventDefault();
    onSubmit(values);
  }

  return (
    <form className="capsule-form" onSubmit={handleSubmit} noValidate={false}>
      {errors.length > 0 && (
        <div className="alert alert-error" role="alert">
          <ul>
            {errors.map((message) => (
              <li key={message}>{message}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="form-grid">
        <label className="field">
          <span>Project name *</span>
          <input name="project_name" value={values.project_name} onChange={update} required maxLength={100}
            placeholder="SmartFarm Irrigation" autoFocus />
        </label>
        <label className="field">
          <span>Prompt title *</span>
          <input name="prompt_title" value={values.prompt_title} onChange={update} required maxLength={120}
            placeholder="Debug cloud deployment" />
        </label>
        <label className="field">
          <span>Version</span>
          <input name="prompt_version" value={values.prompt_version} onChange={update} maxLength={20} placeholder="v1" />
        </label>
        <label className="field">
          <span>Category</span>
          <select name="category" value={values.category} onChange={update}>
            {CATEGORIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
      </div>

      <label className="field">
        <span>Prompt text *</span>
        <textarea name="prompt_text" value={values.prompt_text} onChange={update} required maxLength={5000} rows={5}
          placeholder="Why does my Node server fail after deploying to Render?" className="mono" />
      </label>

      <label className="field">
        <span>Response summary</span>
        <textarea name="response_summary" value={values.response_summary} onChange={update} maxLength={3000} rows={3}
          placeholder="Check the start command and that PORT comes from the environment." />
      </label>

      <div className="form-grid">
        <label className="field">
          <span>Usefulness</span>
          <select name="usefulness" value={values.usefulness} onChange={update}>
            {USEFULNESS.map((u) => (
              <option key={u}>{u}</option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Screenshot evidence URL</span>
          <input name="screenshot_url" type="url" value={values.screenshot_url} onChange={update} maxLength={500}
            placeholder="https://…" />
        </label>
      </div>

      <div className="checks">
        <label className="check">
          <input type="checkbox" name="reviewed" checked={values.reviewed} onChange={update} />
          <span>Response reviewed</span>
        </label>
        <label className="check">
          <input type="checkbox" name="improved" checked={values.improved} onChange={update} />
          <span>Output improved</span>
        </label>
      </div>

      <label className="field">
        <span>Notes</span>
        <textarea name="notes" value={values.notes} onChange={update} maxLength={2000} rows={2}
          placeholder="Tested and worked." />
      </label>

      <div className="form-actions">
        <button type="button" className="btn btn-ghost" onClick={onCancel} disabled={saving}>
          Cancel
        </button>
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? 'Saving…' : initial ? 'Save changes' : 'Create capsule'}
        </button>
      </div>
    </form>
  );
}
