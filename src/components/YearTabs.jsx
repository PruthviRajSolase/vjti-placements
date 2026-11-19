/*
  STEP 8 — YearTabs.jsx: EXTRACTED from Hero.

  REUSABILITY is the payoff of components. Both the homepage
  hero AND the companies page need the year selector now — so
  instead of copy-pasting JSX, we extract it into one component
  and use it in two places:

    <YearTabs year={year} onYearChange={onYearChange} />

  Rule of thumb: the moment you're about to copy-paste JSX,
  extract a component instead.
*/
const YEARS = ["2024", "2025", "2026"];

function YearTabs({ year, onYearChange }) {
  return (
    <nav className="year-tabs">
      {YEARS.map((y) => (
        <a
          key={y}
          href="#"
          className={`year-tab${y === year ? " active" : ""}`}
          onClick={(event) => {
            event.preventDefault();
            onYearChange(y);
          }}
        >
          {y}
        </a>
      ))}
    </nav>
  );
}

export default YearTabs;
