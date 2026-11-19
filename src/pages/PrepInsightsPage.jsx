/*
  Phase 11 — PrepInsightsPage.jsx
  Turns tags from approved student experiences into a ranked prep checklist.
  Sources are public write-ups only; no pending submission or private note
  reaches this page.
*/
import { Link } from "react-router-dom";
import { useAuth } from "../AuthContext.jsx";
import { useContent } from "../ContentContext.jsx";

export default function PrepInsightsPage() {
  const { content } = useContent();
  const { user } = useAuth();
  const insights = content.prepInsights;

  if (!insights || insights.totalExperiences === 0) {
    return (
      <section className="list-page">
        <div className="page-intro">
          <h1 className="page-title">Preparation insights</h1>
          <p className="section-sub">
            No approved write-ups have been published yet, so there is no data
            to rank. Check back after a senior shares an experience.
          </p>
        </div>
      </section>
    );
  }

  const { totalExperiences, topicCount, commonCount, topics, checklist } = insights;

  return (
    <section className="list-page prep-page">
      <div className="page-intro">
        <h1 className="page-title">Preparation insights</h1>
        <p className="section-sub">
          Based on {totalExperiences} approved write-ups from placed students.
          Each theme is counted once per write-up, then ranked — so this is a
          pattern, not one person's opinion.
        </p>
        {["student", "contributor"].includes(user?.role) ? (
          <Link className="btn-primary" to="/submit">Share your experience →</Link>
        ) : (
          <Link className="btn-secondary" to="/signin" state={{ from: "/prep-insights" }}>
            Sign in to contribute
          </Link>
        )}
      </div>

      <div className="insight-stats">
        <div className="stat-card"><strong>{totalExperiences}</strong><span>approved write-ups</span></div>
        <div className="stat-card"><strong>{topicCount}</strong><span>distinct themes</span></div>
        <div className="stat-card"><strong>{commonCount}</strong><span>common themes</span></div>
      </div>

      <section className="insight-block">
        <h2 className="section-title">Your prep checklist</h2>
        <p className="section-sub">
          The five most repeated actionable themes. Start here if you don't
          know where your time will pay off most.
        </p>
        <ol className="prep-checklist">
          {checklist.map((item, index) => (
            <li key={item.tag}>
              <span className="checklist-index">{index + 1}</span>
              <div>
                <h3>{item.tag} <small>{item.category}</small></h3>
                <p className="insight-why">{item.why}</p>
                <p>{item.action}</p>
                <p className="insight-companies">Seen at {item.companies.join(", ")}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="insight-block">
        <h2 className="section-title">All themes from the write-ups</h2>
        <p className="section-sub">
          Counts show how many of the {totalExperiences} write-ups mentioned
          each theme. Process facts (like on-campus drives) are shown too, but
          they aren't scored as prep tasks.
        </p>
        <div className="insight-topic-grid">
          {topics.map((topic) => (
            <article className="insight-topic" key={topic.tag}>
              <div className="insight-topic-head">
                <h3>{topic.tag}</h3>
                <span>{topic.count} of {totalExperiences} · {topic.share}%</span>
              </div>
              <div className="insight-bar" aria-hidden="true">
                <span style={{ width: `${topic.share}%` }} />
              </div>
              <p className="insight-category">{topic.category}</p>
              <p>{topic.advice}</p>
              {topic.action && (
                <p className="insight-action"><strong>Do next:</strong> {topic.action}</p>
              )}
              <p className="insight-companies">
                {topic.companies.length === 1
                  ? `Seen at ${topic.companies[0]}`
                  : `Seen at ${topic.companies.join(", ")}`}
              </p>
              <div className="insight-links">
                <Link to={`/?tag=${encodeURIComponent(topic.tag)}#experiences`}>
                  Filter experiences →
                </Link>
                {topic.experienceIds.map((id) => (
                  <Link key={id} to={`/experience/${id}`}>#{id}</Link>
                ))}
              </div>
            </article>
          ))}
        </div>
      </section>

      <p className="insight-footnote">
        Demo data: these write-ups are sample content, not official TPO records.
        The ranking updates automatically when TPO approves a new experience.
      </p>
    </section>
  );
}
