/*
  Phase 11 — PrepInsightsSection.jsx
  Homepage preview of the themes that keep appearing in approved write-ups.
  The ranking itself is computed on the server from public experience tags.
*/
import { Link } from "react-router-dom";
import { useContent } from "../ContentContext.jsx";

export default function PrepInsightsSection() {
  const { content } = useContent();
  const insights = content.prepInsights;

  if (!insights || insights.totalExperiences === 0) return null;

  return (
    <section className="prep-insights" id="prep-insights">
      <div className="prep-insights-head">
        <div>
          <h2 className="section-title">What seniors say to prepare</h2>
          <p className="section-sub">
            The themes that keep repeating across {insights.totalExperiences}
            {" "}approved write-ups — ranked by how often students mentioned them.
          </p>
        </div>
        <Link className="btn-secondary" to="/prep-insights">Full prep plan →</Link>
      </div>

      <div className="insight-card-grid">
        {insights.checklist.slice(0, 3).map((item, index) => (
          <article className="insight-card" key={item.tag}>
            <span className="insight-rank">{String(index + 1).padStart(2, "0")}</span>
            <span className="insight-category">{item.category}</span>
            <h3>{item.tag}</h3>
            <p className="insight-why">{item.why}</p>
            <p className="insight-action">{item.action}</p>
            <Link
              className="insight-source"
              to={`/?tag=${encodeURIComponent(item.tag)}#experiences`}
            >
              See write-ups →
            </Link>
          </article>
        ))}
      </div>

      <p className="insight-footnote">
        Based on sample write-ups contributed by placed students. A theme is
        common only when at least half the write-ups mention it.
      </p>
    </section>
  );
}
