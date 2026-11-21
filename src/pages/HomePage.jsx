/*
  Home page. Demo mode shows placement stats/companies/branches/experiences.
  Launch mode shows only experience-sharing content for students.
*/
import { Link } from "react-router-dom";
import Hero from "../components/Hero.jsx";
import StatsSection from "../components/StatsSection.jsx";
import CompaniesSection from "../components/CompaniesSection.jsx";
import BranchSection from "../components/BranchSection.jsx";
import ExperiencesSection from "../components/ExperiencesSection.jsx";
import PrepInsightsSection from "../components/PrepInsightsSection.jsx";
import { useContent } from "../ContentContext.jsx";
import { useAuth } from "../AuthContext.jsx";

function HomePage({ year, onYearChange }) {
  const { content } = useContent();
  const { user } = useAuth();
  const isLaunch = content?.mode === "launch";

  if (isLaunch) {
    return (
      <>
        <section className="hero" id="overview">
          <h1>Interview experiences from VJTI seniors, for juniors</h1>
          <p className="hero-sub">
            Read real interview journeys, learn what to prepare, and help juniors by sharing your own experience.
          </p>
          <div className="hero-cta">
            <Link className="btn-primary hero-cta-btn" to={user ? "/submit" : "/signin"}>
              Share your experience
            </Link>
          </div>
        </section>
        <ExperiencesSection />
        <PrepInsightsSection />
      </>
    );
  }

  return (
    <>
      <Hero year={year} onYearChange={onYearChange} />
      <StatsSection year={year} />
      <CompaniesSection year={year} />
      <BranchSection year={year} />
      <ExperiencesSection />
      <PrepInsightsSection />
    </>
  );
}

export default HomePage;
