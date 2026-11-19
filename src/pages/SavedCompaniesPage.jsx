/*
  Phase 6 — SavedCompaniesPage.jsx
  A private shortlist of companies. Every row comes from GET /api/bookmarks,
  which is scoped to the signed-in user on the server — this page never
  filters a global list in the browser.
*/
import { Link } from "react-router-dom";
import { useAuth } from "../AuthContext.jsx";
import { useBookmarks } from "../BookmarksContext.jsx";
import BookmarkButton from "../components/BookmarkButton.jsx";

function SavedCompaniesPage() {
  const { user } = useAuth();
  const { bookmarks } = useBookmarks();
  const firstName = user?.fullName?.split(" ")[0] || "there";

  return (
    <section className="list-page saved-page">
      <div className="page-intro">
        <h1 className="page-title">Saved companies</h1>
        <p className="section-sub">
          Your shortlist, {firstName}. Tap ★ on any company page to add it here;
          tap again to remove it. Only your account sees this list.
        </p>
      </div>

      {bookmarks.length === 0 ? (
        <div className="empty-card">
          <h2>Nothing saved yet</h2>
          <p>Open a company and press Save to keep it here for later.</p>
          <Link className="btn-primary" to="/companies">Browse companies →</Link>
        </div>
      ) : (
        <ul className="saved-list">
          {bookmarks.map((bookmark) => (
            <li className="saved-item" key={bookmark.slug}>
              <Link className="saved-link" to={`/company/${bookmark.slug}`}>
                <strong>{bookmark.name}</strong>
                <span>View placement history →</span>
              </Link>
              <BookmarkButton slug={bookmark.slug} />
            </li>
          ))}
        </ul>
      )}

      <p className="saved-hint">
        Saved {bookmarks.length} {bookmarks.length === 1 ? "company" : "companies"}.
      </p>
    </section>
  );
}

export default SavedCompaniesPage;
