import { Link } from "react-router-dom";

function GuidelinesPage() {
  return (
    <section className="page-narrow">
      <Link className="back-link" to="/">← Home</Link>
      <h1 className="page-title">Community guidelines</h1>
      <p className="section-sub">
        VJTI Placements is a student-run portal for sharing interview experiences. Please keep write-ups helpful, honest, and respectful.
      </p>
      <div className="guidelines-card">
        <h2>What to share</h2>
        <ul>
          <li>Describe rounds, preparation, timelines, and the kinds of questions or topics asked.</li>
          <li>Be honest about your experience, including what was difficult or unexpected.</li>
          <li>Focus on information that helps juniors prepare.</li>
        </ul>
        <h2>What not to share</h2>
        <ul>
          <li>Do not post confidential assessment questions or material covered by an NDA.</li>
          <li>Do not include interviewer names, personal contact details, or other identifying personal information.</li>
          <li>Do not post disrespectful, discriminatory, or irrelevant content.</li>
        </ul>
        <h2>Anonymity and review</h2>
        <ul>
          <li>You can choose to publish anonymously, but staff can still see the author for moderation and accountability.</li>
          <li>All write-ups are reviewed before publishing. Staff may request changes, unpublish, or remove content that breaks these guidelines.</li>
        </ul>
      </div>
    </section>
  );
}

export default GuidelinesPage;
