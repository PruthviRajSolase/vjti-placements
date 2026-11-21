/*
  STEP 8 — Hero.jsx: now uses the extracted <YearTabs>.
  The component got SHORTER and the tabs are now reusable
  everywhere. This is the everyday rhythm of React: build
  small, extract shared pieces, compose them.
*/
import { Link } from "react-router-dom";
import { useAuth } from "../AuthContext.jsx";
import YearTabs from "./YearTabs.jsx";

function Hero({ year, onYearChange }) {
  const { user } = useAuth();

  return (
    <section className="hero" id="overview">
      <h1>VJTI Placements</h1>

      <p className="hero-sub">
        Placement statistics, company data and reviewed interview
        experiences for <strong>Veermata Jijabai Technological
        Institute</strong>, Mumbai — made by students, for students.
      </p>
      <p className="hero-value">
        Find real placement numbers, learn from senior interview experiences, and track opportunities in one place.
      </p>
      <div className="hero-cta">
        {user ? (
          <Link className="btn-primary hero-cta-btn" to="/my-experiences">Share your experience</Link>
        ) : (
          <Link className="btn-primary hero-cta-btn" to="/signin">Sign in to contribute</Link>
        )}
      </div>

      <YearTabs year={year} onYearChange={onYearChange} />
    </section>
  );
}

export default Hero;
