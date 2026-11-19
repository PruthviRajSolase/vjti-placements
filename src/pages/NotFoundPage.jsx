/*
  STEP 8 — NotFoundPage.jsx: the catch-all route.
  In App.jsx: <Route path="*" element={<NotFoundPage />} />
  "*" matches ANY URL nothing else matched. Every real app has
  this — try https://github.com/anything-random for a famous one.
*/
import { Link } from "react-router-dom";

function NotFoundPage() {
  return (
    <section className="not-found">
      <h1>404</h1>
      <p>That page doesn't exist. It may have been moved, or the link is wrong.</p>
      <Link className="back-link" to="/">
        ← Back to homepage
      </Link>
    </section>
  );
}

export default NotFoundPage;
