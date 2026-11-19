/*
  Phase 3 — MyExperiencesPage.jsx
  The student's own submission tracker. Shows status, staff feedback and an
  edit button while a submission is still pending or needs changes.
*/
import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { api } from "../api.js";

const STATUS_LABEL = {
  pending: "Awaiting review",
  approved: "Published",
  changes_requested: "Changes requested",
  rejected: "Not published",
};

function MyExperiencesPage() {
  const location = useLocation();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    api("/experiences/mine")
      .then((data) => setItems(data.experiences))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="page-loading">Loading your submissions…</p>;

  return (
    <section className="list-page">
      <div className="page-intro">
        <h1 className="page-title">My experiences</h1>
        <p className="section-sub">
          Track what you've submitted and what the TPO said about it.
        </p>
        <Link className="btn-primary" to="/submit">+ Share a new experience</Link>
      </div>

      {location.state?.notice && (
        <p className="admin-message success" role="status">{location.state.notice}</p>
      )}
      {error && <p className="form-error" role="alert">{error}</p>}

      {items.length === 0 ? (
        <div className="empty-card">
          <h2>You haven't shared an experience yet</h2>
          <p>
            Sat for placements? Write up how it went. Your name or anonymity is
            your choice, and nothing goes public until the TPO approves it.
          </p>
          <Link className="btn-primary" to="/submit">Write your experience</Link>
        </div>
      ) : (
        <div className="submission-list">
          {items.map((item) => (
            <article className="submission-card" key={item.id}>
              <header className="submission-head">
                <div>
                  <span className={`status-badge ${item.status}`}>
                    {STATUS_LABEL[item.status]}
                  </span>
                  <h2>{item.heading}</h2>
                  <p className="submission-meta">
                    {item.company} · {item.role} · {item.placementYear} ·{" "}
                    {item.visibility === "anonymous" ? "Anonymous" : "Named"}
                  </p>
                </div>
                {["pending", "changes_requested"].includes(item.status) && (
                  <Link className="btn-secondary" to={`/submit/${item.id}`}>Edit</Link>
                )}
              </header>

              <p className="submission-body">{item.body}</p>

              {item.tags.length > 0 && (
                <ul className="tags">
                  {item.tags.map((tag) => <li key={tag}>{tag}</li>)}
                </ul>
              )}

              {item.reviewNote && (
                <div className="review-feedback">
                  <strong>Feedback from {item.reviewedBy || "TPO staff"}:</strong>{" "}
                  {item.reviewNote}
                </div>
              )}

              <footer className="submission-foot">
                Submitted {item.createdAt}
                {item.status === "approved" && (
                  <> · Published on the public experiences page</>
                )}
              </footer>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

export default MyExperiencesPage;
