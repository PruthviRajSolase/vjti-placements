/*
  Phase 2 — RequireRole.jsx
  Client-side route guard. NOTE: this only controls what the user SEES.
  The real permission check is in the API (requireRole middleware) —
  someone can always call the API directly, so the server must refuse.
*/
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../AuthContext.jsx";

function RequireRole({ roles, children }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <p className="page-loading">Checking your session…</p>;

  if (!user) {
    return (
      <Navigate
        to="/signin"
        replace
        state={{ from: location.pathname + location.search }}
      />
    );
  }

  if (!roles.includes(user.role)) {
    return <Navigate to="/" replace />;
  }

  return children;
}

export default RequireRole;
