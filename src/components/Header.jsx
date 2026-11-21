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
import { useEffect, useRef, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { useNotifications } from "../NotificationsContext.jsx";
import { useContent } from "../ContentContext.jsx";

function Header({ user, onSignOut, theme, onToggleTheme }) {
  const location = useLocation();
  const { unreadCount } = useNotifications();
  const { content } = useContent();
  const isLaunch = content?.mode === "launch";
  const [navOpen, setNavOpen] = useState(false);
  const [userOpen, setUserOpen] = useState(false);
  const userMenuRef = useRef(null);
  const navRef = useRef(null);

  const displayName = user
    ? user.fullName || user.name || user.email.split("@")[0]
    : "";

  useEffect(() => {
    setNavOpen(false);
    setUserOpen(false);
  }, [location.pathname, location.search]);

  useEffect(() => {
    function onDocClick(event) {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target)) {
        setUserOpen(false);
      }
      if (
        navRef.current &&
        !navRef.current.contains(event.target) &&
        !event.target.closest(".nav-toggle")
      ) {
        setNavOpen(false);
      }
    }
    function onKeyDown(event) {
      if (event.key === "Escape") {
        setNavOpen(false);
        setUserOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  const navClass = ({ isActive }) => `nav-link${isActive ? " active" : ""}`;

  return (
    <header className="site-header">
      <Link className="brand" to="/">
        VJTI Placements
      </Link>

      <button
        type="button"
        className="nav-toggle"
        aria-expanded={navOpen}
        aria-controls="main-nav"
        aria-label={navOpen ? "Close menu" : "Open menu"}
        onClick={() => setNavOpen((v) => !v)}
      >
        <span aria-hidden="true">{navOpen ? "✕" : "☰"}</span>
      </button>

      <nav id="main-nav" ref={navRef} className={`main-nav${navOpen ? " open" : ""}`}>
        <NavLink to="/" end className={navClass}>Home</NavLink>
        {!isLaunch && <NavLink to="/companies" className={navClass}>Companies</NavLink>}
        {!isLaunch && <NavLink to="/drives" className={navClass}>Drives</NavLink>}
        <NavLink to="/prep-insights" className={navClass}>Prep insights</NavLink>
        {!isLaunch && ["student", "contributor"].includes(user?.role) && (
          <NavLink to="/my-applications" className={navClass}>My applications</NavLink>
        )}
        {["student", "contributor"].includes(user?.role) && (
          <NavLink to="/my-experiences" className={navClass}>My experiences</NavLink>
        )}
        {["tpo", "tpoi"].includes(user?.role) && (
          <>
            <NavLink to="/admin/reviews" className={navClass}>Reviews</NavLink>
            {!isLaunch && <NavLink to="/admin" end className={navClass}>Admin</NavLink>}
            {isLaunch && <NavLink to="/admin/users" className={navClass}>Accounts</NavLink>}
            {isLaunch && user?.role === "tpoi" && <NavLink to="/admin/audit" className={navClass}>Audit log</NavLink>}
          </>
        )}
      </nav>

      <div className="header-actions">
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

        {user ? (
          <div className="user-menu" ref={userMenuRef}>
            <button
              type="button"
              className="user-chip"
              aria-haspopup="menu"
              aria-expanded={userOpen}
              onClick={() => setUserOpen((v) => !v)}
              title={`${user.email} — account menu`}
            >
              Hi, {displayName}
            </button>
            {userOpen && (
              <div className="user-dropdown">
                <Link className="user-dropdown-link" to="/account" onClick={() => setUserOpen(false)}>
                  Account
                </Link>
                {!isLaunch && (
                  <Link className="user-dropdown-link" to="/saved" onClick={() => setUserOpen(false)}>
                    Saved
                  </Link>
                )}
                <button
                  type="button"
                  className="btn-signout user-dropdown-signout"
                  onClick={() => { setUserOpen(false); onSignOut(); }}
                >
                  Sign out
                </button>
              </div>
            )}
          </div>
        ) : (
          <Link
            className="btn-signin"
            to="/signin"
            state={{ from: location.pathname + location.search }}
          >
            Sign in
          </Link>
        )}
      </div>
    </header>
  );
}

export default Header;
