/*
  Phase 6 — RequireAuth.jsx
  A thin wrapper around RequireRole for pages that need any signed-in user
  (saved companies, account settings). The server still checks the session on
  every API call; this only controls what the browser shows.
*/
import RequireRole from "./RequireRole.jsx";

const ALL_ROLES = ["student", "contributor", "tpo", "tpoi"];

function RequireAuth({ children }) {
  return <RequireRole roles={ALL_ROLES}>{children}</RequireRole>;
}

export default RequireAuth;
