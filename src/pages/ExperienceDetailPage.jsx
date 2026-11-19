/*
  Phase 5 — ExperienceDetailPage.jsx
  URL: /experience/:id  e.g. /experience/1

  The card list only carries a short excerpt, so the full write-up is fetched
  from GET /api/experiences/:id. That endpoint is public but server-gated:
  it returns 404 unless the row is approved, and it never includes the
  author's real identity, email or staff review notes.
*/
import { useEffect, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { api } from "../api.js";
import { useAuth } from "../AuthContext.jsx";
import { useContent } from "../ContentContext.jsx";

function ExperienceDetailPage() {
  const { id } = useParams();
  const location = useLocation();
  const { user } = useAuth();
  const { content } = useContent();

  const [experience, setExperience] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    setExperience(null);

    api(`/experiences/${encodeURIComponent(id)}`)
      .then((data) => {
        if (active) setExperience(data.experience);
      })
      .catch((err) => {
        if (active) setError(err.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [id]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [id]);

  // Cards pass their active filters along, so "back" restores the same view.
  const filters = location.state?.from;
  const backTo = filters ? `/?${filters}#experiences` : "/#experiences";

  if (loading) {
    return <p className="page-loading">Loading write-up…</p>;
  }

  if (error || !experience) {
    return (
      <section className="not-found">
        <h1>🤷</h1>
        <p>{error || "That write-up is not available."}</p>
        <p>
          Only approved write-ups have public pages. If you submitted this one,
          check its status in <Link to="/my-experiences">My experiences</Link>.
        </p>
        <Link className="back-link" to={backTo}>← All experiences</Link>
      </section>
    );
  }

  const byline = [
    experience.author.name,
    experience.author.branch,
    experience.author.year,
  ].filter(Boolean).join(", ");

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
          <Link
            className="tag"
            key={item}
            to={`/?tag=${encodeURIComponent(item)}#experiences`}
          >
            {item}
          </Link>
        ))}
      </div>

      {related.length > 0 && (
        <section className="related-experiences">
          <h2>More at {experience.company}</h2>
          <ul>
            {related.map((item) => (
              <li key={item.id}>
                <Link to={`/experience/${item.id}`}>{item.heading} →</Link>
              </li>
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
