/*
  STEP 8 — Header.jsx: rewritten with ROUTER LINKS.

  <Link> instead of <a>: clicking it tells the router to swap
  components WITHOUT a page reload. A plain <a href="/companies">
  would reload the whole app (losing state) — the exact problem
  SPAs exist to solve.

  <NavLink> is a Link that KNOWS whether it's the current URL.
  It passes us an object { isActive } and we build the className
  from it — passing a FUNCTION as a prop is a very common
  React pattern ("render prop" style).

  `end` on the Home link: without it, "/" is considered active
  for EVERY path (since all paths start with "/"). `end` means
  "only exact matches count".
*/
import { Link, NavLink, useLocation } from "react-router-dom";
import { useNotifications } from "../NotificationsContext.jsx";

function Header({ user, onSignOut, theme, onToggleTheme }) {
  // Remember the current page so /signin can send the user back here.
  const location = useLocation();
  const { unreadCount } = useNotifications();
  // publicUser() returns `fullName`; the old demo auth used `name`.
  // Support both so the header always shows the real name when available.
  const displayName = user
    ? user.fullName || user.name || user.email.split("@")[0]
    : "";

  return (
    <header className="site-header">
      <Link className="brand" to="/">
        VJTI Placements
      </Link>

      <nav className="main-nav">
        <NavLink
          to="/"
          end
          className={({ isActive }) => `nav-link${isActive ? " active" : ""}`}
        >
          Home
        </NavLink>
        <NavLink
          to="/companies"
          className={({ isActive }) => `nav-link${isActive ? " active" : ""}`}
        >
          Companies
        </NavLink>
        {/* Signed-in users get a private shortlist; students can track their
            write-ups; staff get review + content links. These are shortcuts
            only — the API re-checks the session and role. */}
        {user && (
          <NavLink
            to="/saved"
            className={({ isActive }) => `nav-link${isActive ? " active" : ""}`}
          >
            Saved
          </NavLink>
        )}
        {user && (
          <NavLink
            to="/notifications"
            className={({ isActive }) => `nav-link notification-link${isActive ? " active" : ""}`}
            aria-label={unreadCount ? `Notifications, ${unreadCount} unread` : "Notifications"}
          >
            <span aria-hidden="true">🔔</span>
            <span className="notification-label">Alerts</span>
            {unreadCount > 0 && (
              <span className="notification-badge" aria-hidden="true">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </NavLink>
        )}
        {["student", "contributor"].includes(user?.role) && (
          <NavLink
            to="/my-experiences"
            className={({ isActive }) => `nav-link${isActive ? " active" : ""}`}
          >
            My experiences
          </NavLink>
        )}
        {["tpo", "tpoi"].includes(user?.role) && (
          <>
            <NavLink
              to="/admin/reviews"
              className={({ isActive }) => `nav-link${isActive ? " active" : ""}`}
            >
              Reviews
            </NavLink>
            <NavLink
              to="/admin"
              end
              className={({ isActive }) => `nav-link${isActive ? " active" : ""}`}
            >
              Admin
            </NavLink>
          </>
        )}
      </nav>

      {/* STEP 10: theme switch. aria-pressed tells assistive tech whether
          dark mode is currently ON; the label names the ACTION to take. */}
      <button
        type="button"
        className="theme-toggle"
        onClick={onToggleTheme}
        aria-pressed={theme === "dark"}
        aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
        title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      >
        <span aria-hidden="true">{theme === "dark" ? "☀️" : "🌙"}</span>
        <span className="theme-toggle-label">
          {theme === "dark" ? "Light" : "Dark"}
        </span>
      </button>

      {/* STEP 9: the right-hand slot swaps between a sign-in link and
          a signed-in chip + sign-out button. Conditional JSX again. */}
      {user ? (
        <>
          <Link className="user-chip" to="/account" title={`${user.email} — account settings`}>
            Hi, {displayName}
          </Link>
          <button type="button" className="btn-signout" onClick={onSignOut}>
            Sign out
          </button>
        </>
      ) : (
        <Link
          className="btn-signin"
          to="/signin"
          state={{ from: location.pathname + location.search }}
        >
          Sign in
        </Link>
      )}
    </header>
  );
}

export default Header;
