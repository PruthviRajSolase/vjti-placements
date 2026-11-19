/*
  STEP 8 — Hero.jsx: now uses the extracted <YearTabs>.
  The component got SHORTER and the tabs are now reusable
  everywhere. This is the everyday rhythm of React: build
  small, extract shared pieces, compose them.
*/
import YearTabs from "./YearTabs.jsx";

function Hero({ year, onYearChange }) {
  return (
    <section className="hero" id="overview">
      <h1>VJTI Placements</h1>

      <p className="hero-sub">
        Placement statistics, company data and reviewed interview
        experiences for <strong>Veermata Jijabai Technological
        Institute</strong>, Mumbai — made by students, for students.
      </p>

      <YearTabs year={year} onYearChange={onYearChange} />
    </section>
  );
}

export default Hero;
