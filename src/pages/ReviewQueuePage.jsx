/*
  Phase 3 — ReviewQueuePage.jsx (TPO / TPOI only)
  Staff sees every submission WITH the real author identity, even when the
  student chose anonymous publication. Approve publishes immediately;
  reject / request changes require a note the student can read.
*/
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api.js";
import { useContent } from "../ContentContext.jsx";

const FILTERS = [
  { key: "pending", label: "Pending" },
  { key: "changes_requested", label: "Changes requested" },
  { key: "approved", label: "Approved" },
  { key: "rejected", label: "Rejected" },
  { key: "all", label: "All" },
];

const STATUS_LABEL = {
  pending: "Awaiting review",
  approved: "Published",
  changes_requested: "Changes requested",
  rejected: "Not published",
};

function ReviewQueuePage() {
  const { refresh } = useContent();
  const [data, setData] = useState({ experiences: [], counts: {} });
  const [filter, setFilter] = useState("pending");
  const [notes, setNotes] = useState({});
  const [busyId, setBusyId] = useState(null);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const result = await api("/admin/experiences");
    setData(result);
  }, []);

  useEffect(() => {
    load().catch((err) => setError(err.message));
  }, [load]);

  const visible = useMemo(
    () => filter === "all"
      ? data.experiences
      : data.experiences.filter((item) => item.status === filter),
    [data.experiences, filter]
  );

  async function review(item, action) {
    const note = (notes[item.id] || "").trim();
    if (action !== "approve" && !note) return;

    setBusyId(item.id);
    setMessage(null);
    try {
      await api(`/admin/experiences/${item.id}/review`, {
        method: "POST",
        body: { action, note },
      });
      // Reload the queue AND the public content so an approval is visible
      // on the site the moment the staff member clicks Approve.
      await load();
      await refresh();
      const verb = { approve: "approved and published", reject: "rejected", request_changes: "sent back for changes" }[action];
      setMessage({
        type: "success",
        text: `${item.heading} was ${verb}. The student can see the decision in “My experiences”.`,
      });
      setNotes((current) => ({ ...current, [item.id]: "" }));
    } catch (err) {
      setMessage({ type: "error", text: err.message });
    } finally {
      setBusyId(null);
    }
  }

  const pendingCount = data.counts.pending || 0;

  return (
    <section className="list-page">
      <div className="page-intro">
        <Link className="back-link" to="/admin">← Content admin</Link>
        <h1 className="page-title">Experience review queue</h1>
        <p className="section-sub">
          {pendingCount} awaiting review · approve to publish, or send back with a note.
        </p>
      </div>

      {message && (
        <p className={`admin-message ${message.type}`} role="status">{message.text}</p>
      )}
      {error && <p className="form-error" role="alert">{error}</p>}

      <div className="filter-tabs" role="tablist" aria-label="Filter submissions">
        {FILTERS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={filter === tab.key}
            className={`filter-tab${filter === tab.key ? " active" : ""}`}
            onClick={() => setFilter(tab.key)}
          >
            {tab.label}
            {tab.key !== "all" && data.counts[tab.key] != null && (
              <span className="tab-count">{data.counts[tab.key]}</span>
            )}
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <div className="empty-card">
          <h2>Nothing here right now</h2>
          <p>Submissions from students will appear in this queue.</p>
        </div>
      ) : (
        <div className="review-list">
          {visible.map((item) => {
            const actionable = ["pending", "changes_requested"].includes(item.status);
            return (
              <article className="review-card" key={item.id}>
                <header className="submission-head">
                  <div>
                    <span className={`status-badge ${item.status}`}>
                      {STATUS_LABEL[item.status]}
                    </span>
                    <span className={`visibility-badge ${item.visibility}`}>
                      {item.visibility === "anonymous" ? "Anonymous" : "Named"}
                    </span>
                    <h2>{item.heading}</h2>
                    <p className="submission-meta">
                      {item.company} · {item.role} · {item.placementYear} · submitted {item.createdAt}
                    </p>
                  </div>
                </header>

                <div className="identity-panel">
                  <strong>Submitted by {item.author.realName}</strong>
                  <span>{item.author.email} · {item.author.realBranch || "Branch not set"}</span>
                  <small>
                    {item.visibility === "anonymous"
                      ? "Public visitors will only see “Anonymous senior” — staff always see this identity."
                      : "This is the name shown on the public page."}
                  </small>
                </div>

                <p className="submission-body">{item.body}</p>

                {item.tags.length > 0 && (
                  <ul className="tags">
                    {item.tags.map((tag) => <li key={tag}>{tag}</li>)}
                  </ul>
                )}

                {item.reviewNote && (
                  <div className="review-feedback">
                    <strong>{item.reviewedBy || "TPO staff"} noted:</strong> {item.reviewNote}
                    {item.reviewedAt && <small> · {item.reviewedAt}</small>}
                  </div>
                )}

                {actionable ? (
                  <div className="review-actions">
                    <textarea
                      rows={2}
                      placeholder="Optional for approval; required to reject or request changes"
                      value={notes[item.id] || ""}
                      onChange={(e) =>
                        setNotes((current) => ({ ...current, [item.id]: e.target.value }))
                      }
                    />
                    <div className="review-buttons">
                      <button
                        type="button" className="btn-primary"
                        disabled={busyId === item.id}
                        onClick={() => review(item, "approve")}
                      >
                        Approve & publish
                      </button>
                      <button
                        type="button" className="btn-secondary"
                        disabled={busyId === item.id || !(notes[item.id] || "").trim()}
                        onClick={() => review(item, "request_changes")}
                      >
                        Request changes
                      </button>
                      <button
                        type="button" className="btn-danger"
                        disabled={busyId === item.id || !(notes[item.id] || "").trim()}
                        onClick={() => review(item, "reject")}
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="review-final">
                    Reviewed by {item.reviewedBy || "TPO staff"}{item.reviewedAt ? ` on ${item.reviewedAt}` : ""}. Final decision — no further edits.
                  </p>
                )}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

export default ReviewQueuePage;
