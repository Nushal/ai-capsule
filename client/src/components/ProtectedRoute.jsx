import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';

// Asks Express who is logged in (GET /api/auth/me verifies the JWT cookie).
// If the answer is 401 the user is sent to /login and the dashboard never renders.
export default function ProtectedRoute({ children }) {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);

  useEffect(() => {
    let active = true;
    api
      .me()
      .then((data) => active && setUser(data.user))
      .catch(() => active && navigate('/login', { replace: true }));
    return () => {
      active = false;
    };
  }, [navigate]);

  if (!user) {
    return (
      <div className="page-loading">
        <span className="spinner" aria-hidden="true" /> Checking your session…
      </div>
    );
  }
  return children(user);
}
