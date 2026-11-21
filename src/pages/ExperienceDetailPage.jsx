/*
  Experience detail page. Public, server-gated: only approved experiences are returned.
*/
import { useEffect, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { api } from "../api.js";
import { useAuth } from "../AuthContext.jsx";
import { useContent } from "../ContentContext.jsx";

const REPORT_REASONS = [
  "Inaccurate or misleading",
  "Contains confidential/NDA content",
  "Includes personal or identifying details",
  "Inappropriate or disrespectful",
  "Spam or irrelevant",
  "Other",
];

function ExperienceDetailPage() {
  const { id } = useParams();
  const location = useLocation();
  const { user } = useAuth();
  const { content } = useContent();

  const [experience, setExperience] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState(REPORT_REASONS[0]);
  const [reportDetails, setReportDetails] = useState("");
  const [reportMsg, setReportMsg] = useState("");
  const [reportErr, setReportErr] = useState("");
  const [reporting, setReporting] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    setExperience(null);
    api(`/experiences/${encodeURIComponent(id)}`)
      .then((data) => { if (active) setExperience(data.experience); })
      .catch((err) => { if (active) setError(err.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [id]);

  useEffect(() => { window.scrollTo(0, 0); }, [id]);

  const filters = location.state?.from;
  const backTo = filters ? `/?${filters}#experiences` : "/#experiences";

  async function submitReport(event) {
    event.preventDefault();
    setReportErr("");
    setReportMsg("");
    setReporting(true);
    try {
      await api(`/experiences/${id}/report`, {
        method: "POST",
        body: { reason: reportReason, details: reportDetails.trim() },
      });
      setReportMsg("Report submitted. Thank you for helping keep the portal useful and safe.");
      setReportOpen(false);
      setReportDetails("");
    } catch (err) {
      setReportErr(err.message);
    } finally {
      setReporting(false);
    }
  }

  if (loading) return <p className="page-loading">Loading write-up…</p>;

  if (error || !experience) {
    return (
      <section className="not-found">
        <h1>404</h1>
        <p>{error || "That write-up is not available."}</p>
        <p>
          Only approved write-ups have public pages. If you submitted this one,
          check its status in <Link to="/my-experiences">My experiences</Link>.
        </p>
        <Link className="back-link" to={backTo}>← All experiences</Link>
      </section>
    );
  }

  const byline = [experience.author.name, experience.author.branch, experience.author.year].filter(Boolean).join(", ");
  const related = content.experiences
    .filter((item) => item.company === experience.company && item.id !== experience.id)
    .slice(0, 3);

  return (
    <article className="experience-detail">
      <Link className="back-link" to={backTo}>← All experiences</Link>

      <header className="experience-detail-head">
        <div className="experience-detail-meta">
          <span className="year-badge">{experience.placementYear}</span>
          <span>{experience.company}</span>
          <span className="meta-dot">•</span>
          <span>{experience.role}</span>
        </div>
        <h1>{experience.heading}</h1>
        <span className="author">— {byline}</span>
      </header>

      <div className="experience-body">{experience.body}</div>

      <div className="tags" aria-label="Topics">
        {experience.tags.map((item) => (
          <Link className="tag" key={item} to={`/?tag=${encodeURIComponent(item)}#experiences`}>
            {item}
          </Link>
        ))}
      </div>

      {user && (
        <section className="report-section" aria-label="Report this write-up">
          {!reportOpen ? (
            <button type="button" className="btn-ghost" onClick={() => { setReportOpen(true); setReportErr(""); }}>
              Report this write-up
            </button>
          ) : (
            <form className="report-form" onSubmit={submitReport}>
              <h2>Report this write-up</h2>
              <label>
                Reason
                <select value={reportReason} onChange={(e) => setReportReason(e.target.value)}>
                  {REPORT_REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </label>
              <label>
                Details (optional)
                <textarea rows={3} maxLength={1000} value={reportDetails} onChange={(e) => setReportDetails(e.target.value)}
                  placeholder="Add any helpful context for staff." />
              </label>
              {reportErr && <p className="form-error" role="alert">{reportErr}</p>}
              <div className="form-actions">
                <button type="submit" className="btn-primary" disabled={reporting}>{reporting ? "Sending…" : "Submit report"}</button>
                <button type="button" className="btn-ghost" onClick={() => setReportOpen(false)}>Cancel</button>
              </div>
            </form>
          )}
          {reportMsg && <p className="admin-message success" role="status">{reportMsg}</p>}
        </section>
      )}

      {related.length > 0 && (
        <section className="related-experiences">
          <h2>More at {experience.company}</h2>
          <ul>
            {related.map((item) => (
              <li key={item.id}><Link to={`/experience/${item.id}`}>{item.heading} →</Link></li>
            ))}
          </ul>
        </section>
      )}

      <div className="experience-cta">
        {["student", "contributor"].includes(user?.role) ? (
          <>
            <span>Were you placed? Help the next batch by sharing your process.</span>
            <Link className="btn-primary" to="/submit">Share your experience →</Link>
          </>
        ) : (
          <>
            <span>Were you placed? Sign in with your VJTI email to share your process.</span>
            <Link className="btn-secondary" to="/signin">Sign in to contribute</Link>
          </>
        )}
      </div>
    </article>
  );
}

export default ExperienceDetailPage;
