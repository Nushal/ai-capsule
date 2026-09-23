import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Logo from '../components/Logo.jsx';
import Modal from '../components/Modal.jsx';
import CapsuleForm from '../components/CapsuleForm.jsx';
import CapsuleCard from '../components/CapsuleCard.jsx';
import { api, CATEGORIES } from '../api.js';

export default function Dashboard({ user }) {
  const navigate = useNavigate();
  const [capsules, setCapsules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [editor, setEditor] = useState(null); // null | { capsule: null } (create) | { capsule } (edit)
  const [saving, setSaving] = useState(false);
  const [formErrors, setFormErrors] = useState([]);
  const [confirmingId, setConfirmingId] = useState(null);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');

  // A 401 from any API call means the JWT is missing/expired -> back to login.
  const handleApiError = useCallback(
    (err) => {
      if (err.status === 401) {
        navigate('/login?error=session_expired', { replace: true });
        return true;
      }
      return false;
    },
    [navigate]
  );

  // READ: GET /api/capsules (only this user's records come back)
  const loadCapsules = useCallback(async () => {
    setLoading(true);
    try {
      setCapsules(await api.listCapsules());
      setError('');
    } catch (err) {
      if (!handleApiError(err)) setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [handleApiError]);

  useEffect(() => {
    loadCapsules();
  }, [loadCapsules]);

  useEffect(() => {
    if (!notice) return undefined;
    const timer = setTimeout(() => setNotice(''), 3000);
    return () => clearTimeout(timer);
  }, [notice]);

  const openCreate = () => {
    setFormErrors([]);
    setEditor({ capsule: null });
  };
  const openEdit = (capsule) => {
    setFormErrors([]);
    setEditor({ capsule });
  };
  const closeEditor = useCallback(() => {
    if (!saving) setEditor(null);
  }, [saving]);

  // CREATE (POST) or UPDATE (PUT), then re-read the list from the server.
  async function handleSave(values) {
    setSaving(true);
    setFormErrors([]);
    try {
      if (editor.capsule) {
        await api.updateCapsule(editor.capsule.id, values);
        setNotice('Capsule updated');
      } else {
        await api.createCapsule(values);
        setNotice('Capsule created');
      }
      setEditor(null);
      await loadCapsules();
    } catch (err) {
      if (!handleApiError(err)) setFormErrors(err.details.length ? err.details : [err.message]);
    } finally {
      setSaving(false);
    }
  }

  // DELETE, then re-read the list from the server.
  async function handleDelete(id) {
    try {
      await api.deleteCapsule(id);
      setNotice('Capsule deleted');
      await loadCapsules();
    } catch (err) {
      if (!handleApiError(err)) setError(err.message);
    } finally {
      setConfirmingId(null);
    }
  }

  async function handleLogout() {
    try {
      await api.logout();
    } finally {
      navigate('/', { replace: true });
    }
  }

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return capsules.filter((c) => {
      if (category !== 'All' && c.category !== category) return false;
      if (!term) return true;
      return [c.prompt_title, c.project_name, c.prompt_text, c.notes, c.response_summary]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(term));
    });
  }, [capsules, search, category]);

  const stats = useMemo(
    () => ({
      total: capsules.length,
      reviewed: capsules.filter((c) => c.reviewed).length,
      improved: capsules.filter((c) => c.improved).length,
      projects: new Set(capsules.map((c) => c.project_name)).size,
    }),
    [capsules]
  );

  return (
    <div className="dashboard">
      <header className="appbar">
        <div className="container appbar-inner">
          <Logo />
          <div className="user">
            {user.avatarUrl && <img src={user.avatarUrl} alt="" className="avatar" />}
            <span className="user-name">
              {user.name}
              <small>@{user.login}</small>
            </span>
            <button type="button" className="btn btn-ghost btn-sm" onClick={handleLogout}>
              Log out
            </button>
          </div>
        </div>
      </header>

      <main className="container dash-main">
        <div className="dash-title">
          <div>
            <h1>Your capsules</h1>
            <p className="muted">Only you can see these records.</p>
          </div>
          <button type="button" className="btn btn-primary" onClick={openCreate}>
            + New capsule
          </button>
        </div>

        <div className="stats">
          <div className="stat"><strong>{stats.total}</strong><span>Capsules</span></div>
          <div className="stat"><strong>{stats.projects}</strong><span>Projects</span></div>
          <div className="stat"><strong>{stats.reviewed}</strong><span>Reviewed</span></div>
          <div className="stat"><strong>{stats.improved}</strong><span>Improved</span></div>
        </div>

        <div className="toolbar">
          <input
            type="search"
            className="search"
            placeholder="Search title, project, prompt or notes…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search capsules"
          />
          <select value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Filter by category">
            <option value="All">All categories</option>
            {CATEGORIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
          <button type="button" className="btn btn-ghost" onClick={loadCapsules} disabled={loading}>
            Refresh
          </button>
        </div>

        {notice && <div className="toast" role="status">{notice}</div>}
        {error && <div className="alert alert-error" role="alert">{error}</div>}

        {loading && capsules.length === 0 ? (
          <div className="empty"><span className="spinner" aria-hidden="true" /> Loading your capsules…</div>
        ) : capsules.length === 0 ? (
          <div className="empty">
            <h2>No capsules yet</h2>
            <p className="muted">Save your first useful prompt so you can find it again.</p>
            <button type="button" className="btn btn-primary" onClick={openCreate}>+ New capsule</button>
          </div>
        ) : visible.length === 0 ? (
          <div className="empty"><p className="muted">No capsules match your search.</p></div>
        ) : (
          <div className="capsule-grid">
            {visible.map((capsule) => (
              <CapsuleCard
                key={capsule.id}
                capsule={capsule}
                confirming={confirmingId === capsule.id}
                onEdit={openEdit}
                onAskDelete={setConfirmingId}
                onCancelDelete={() => setConfirmingId(null)}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </main>

      {editor && (
        <Modal title={editor.capsule ? 'Edit capsule' : 'New capsule'} onClose={closeEditor}>
          <CapsuleForm
            key={editor.capsule?.id ?? 'new'}
            initial={editor.capsule}
            saving={saving}
            errors={formErrors}
            onSubmit={handleSave}
            onCancel={closeEditor}
          />
        </Modal>
      )}
    </div>
  );
}
