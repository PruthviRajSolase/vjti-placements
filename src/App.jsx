/*
  Phase 2 — src/App.jsx
  Providers live in main.jsx. Here we compose the header, routes, footer
  and the global loading/error states. Both `user` and `content` now come
  from real API-backed contexts instead of local demo state.
*/
import { useEffect, useState } from "react";
import { Routes, Route } from "react-router-dom";
import Header from "./components/Header.jsx";
import Footer from "./components/Footer.jsx";
import RequireRole from "./components/RequireRole.jsx";
import RequireAuth from "./components/RequireAuth.jsx";
import HomePage from "./pages/HomePage.jsx";
import CompaniesPage from "./pages/CompaniesPage.jsx";
import CompanyPage from "./pages/CompanyPage.jsx";
import DrivesPage from "./pages/DrivesPage.jsx";
import MyApplicationsPage from "./pages/MyApplicationsPage.jsx";
import ExperienceDetailPage from "./pages/ExperienceDetailPage.jsx";
import PrepInsightsPage from "./pages/PrepInsightsPage.jsx";
import SignInPage from "./pages/SignInPage.jsx";
import AdminPage from "./pages/AdminPage.jsx";
import ReviewQueuePage from "./pages/ReviewQueuePage.jsx";
import AdminUsersPage from "./pages/AdminUsersPage.jsx";
import AuditLogPage from "./pages/AuditLogPage.jsx";
import AdminAlumniPage from "./pages/AdminAlumniPage.jsx";
import AdminDrivesPage from "./pages/AdminDrivesPage.jsx";
import SubmitExperiencePage from "./pages/SubmitExperiencePage.jsx";
import MyExperiencesPage from "./pages/MyExperiencesPage.jsx";
import SavedCompaniesPage from "./pages/SavedCompaniesPage.jsx";
import NotificationsPage from "./pages/NotificationsPage.jsx";
import AccountPage from "./pages/AccountPage.jsx";
import NotFoundPage from "./pages/NotFoundPage.jsx";
import { useAuth } from "./AuthContext.jsx";
import { useContent } from "./ContentContext.jsx";

const THEME_STORAGE_KEY = "vjti-placements-theme";

// The inline script in index.html already picked a theme and put it on
// <html> before React mounted — just read that value back.
function readInitialTheme() {
  return document.documentElement.getAttribute("data-theme") === "dark"
    ? "dark"
    : "light";
}

function App() {
  const [theme, setTheme] = useState(readInitialTheme);
  // Year still lives above the routes so it survives navigation.
  const [year, setYear] = useState("2026");
  const { user, loading: authLoading, signOut } = useAuth();
  const { content, loading: contentLoading, error: contentError, refresh } = useContent();

  // Once content arrives, make sure the selected year actually exists.
  useEffect(() => {
    if (content && !content.stats[year]) setYear(content.currentYear);
  }, [content, year]);

  // Mirror theme state onto <html>, where the CSS variables live.
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  function toggleTheme() {
    const current =
      document.documentElement.getAttribute("data-theme") === "dark"
        ? "dark"
        : "light";
    const nextTheme = current === "dark" ? "light" : "dark";

    document.documentElement.setAttribute("data-theme", nextTheme);
    setTheme(nextTheme);

    try {
      localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
    } catch {
      // storage unavailable — theme still changes for this session
    }
  }

  if (contentError) {
    return (
      <>
        <Header user={user} onSignOut={signOut} theme={theme} onToggleTheme={toggleTheme} />
        <main>
          <section className="content-error">
            <h1>Couldn't load placement data</h1>
            <p>{contentError}</p>
            <button type="button" className="btn-primary" onClick={refresh}>Try again</button>
          </section>
        </main>
        <Footer />
      </>
    );
  }

  if (authLoading || contentLoading || !content) {
    return (
      <main className="page-loading-skeleton" aria-live="polite">
        <div className="skeleton-hero" />
        <div className="skeleton-grid">
          <div className="skeleton-card" />
          <div className="skeleton-card" />
          <div className="skeleton-card" />
          <div className="skeleton-card" />
        </div>
        <p className="page-loading">Loading placement data…</p>
      </main>
    );
  }

  const isLaunch = content?.mode === "launch";

  return (
    <>
      <Header user={user} onSignOut={signOut} theme={theme} onToggleTheme={toggleTheme} />

      <p className={isLaunch ? "demo-banner beta-banner" : "demo-banner"}>
        {isLaunch
          ? "Beta — student-run experience portal. Content is reviewed before publishing."
          : "Demo build — all statistics and experiences shown here are sample data, not official TPO records."}
      </p>

      <main>
        <Routes>
          <Route
            path="/"
            element={<HomePage year={year} onYearChange={setYear} />}
          />
          {!isLaunch && (
            <Route
              path="/companies"
              element={<CompaniesPage year={year} onYearChange={setYear} />}
            />
          )}
          {!isLaunch && <Route path="/company/:slug" element={<CompanyPage />} />}
          {!isLaunch && <Route path="/drives" element={<DrivesPage />} />}
          {!isLaunch && (
            <Route
              path="/my-applications"
              element={
                <RequireRole roles={["student", "contributor"]}>
                  <MyApplicationsPage />
                </RequireRole>
              }
            />
          )}
          <Route path="/experience/:id" element={<ExperienceDetailPage />} />
          <Route path="/prep-insights" element={<PrepInsightsPage />} />
          <Route path="/signin" element={<SignInPage />} />
          <Route
            path="/submit"
            element={
              <RequireRole roles={["student", "contributor"]}>
                <SubmitExperiencePage />
              </RequireRole>
            }
          />
          <Route
            path="/submit/:id"
            element={
              <RequireRole roles={["student", "contributor"]}>
                <SubmitExperiencePage />
              </RequireRole>
            }
          />
          <Route
            path="/my-experiences"
            element={
              <RequireRole roles={["student", "contributor"]}>
                <MyExperiencesPage />
              </RequireRole>
            }
          />
          {!isLaunch && (
            <Route
              path="/saved"
              element={
                <RequireAuth>
                  <SavedCompaniesPage />
                </RequireAuth>
              }
            />
          )}
          <Route
            path="/notifications"
            element={
              <RequireAuth>
                <NotificationsPage />
              </RequireAuth>
            }
          />
          <Route
            path="/account"
            element={
              <RequireAuth>
                <AccountPage />
              </RequireAuth>
            }
          />
          {!isLaunch && (
            <Route
              path="/admin"
              element={
                <RequireRole roles={["tpo", "tpoi"]}>
                  <AdminPage />
                </RequireRole>
              }
            />
          )}
          <Route
            path="/admin/reviews"
            element={
              <RequireRole roles={["tpo", "tpoi"]}>
                <ReviewQueuePage />
              </RequireRole>
            }
          />
          <Route
            path="/admin/users"
            element={
              <RequireRole roles={["tpo", "tpoi"]}>
                <AdminUsersPage />
              </RequireRole>
            }
          />
          <Route
            path="/admin/audit"
            element={
              <RequireRole roles={["tpoi"]}>
                <AuditLogPage />
              </RequireRole>
            }
          />
          {!isLaunch && (
            <Route
              path="/admin/alumni"
              element={
                <RequireRole roles={["tpo", "tpoi"]}>
                  <AdminAlumniPage />
                </RequireRole>
              }
            />
          )}
          {!isLaunch && (
            <Route
              path="/admin/drives"
              element={
                <RequireRole roles={["tpo", "tpoi"]}>
                  <AdminDrivesPage />
                </RequireRole>
              }
            />
          )}
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </main>

      <Footer />
    </>
  );
}

export default App;
