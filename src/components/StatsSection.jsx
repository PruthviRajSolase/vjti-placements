/*
  STEP 7 — StatsSection.jsx: rendering from props, no state at all.

  {year} inside JSX = "inject this JavaScript value here".
  {cards.map(...)} = inject a whole ARRAY of elements.
  This replaces the vanilla renderStats() + innerHTML + join("")
  dance — React joins and injects for us.
*/
import { useContent } from "../ContentContext.jsx";

function StatsSection({ year }) {
  // 1. Pick this year's numbers (from the API, not hardcoded data.js)
  const { content } = useContent();
  const stats = content.stats[year] || content.stats[content.currentYear];

  // 2. Shape them into a list of {value, label} cards
  const cards = [
    { value: stats.studentsPlaced, label: "Students Placed" },
    { value: stats.highest, label: "Highest Package" },
    { value: stats.average, label: "Average Package" },
    { value: stats.companies, label: "Companies Visited" },
  ];

  // 3. Describe the section ONCE. React re-runs this function
  //    automatically whenever `year` changes.
  return (
    <section className="stats" id="stats">
      <h2 className="section-title">{year} Season at a Glance</h2>

      <div className="stat-grid">
        {cards.map((card) => (
          <div className="stat-card" key={card.label}>
            <span className="stat-value">{card.value}</span>
            <span className="stat-label">{card.label}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

export default StatsSection;
