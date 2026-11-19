/*
  STEP 8 — HomePage.jsx: the original long page, now a ROUTE.

  The page is just a composition of the components we already
  built. A "page" in React = a component matched by a route.
*/
import Hero from "../components/Hero.jsx";
import StatsSection from "../components/StatsSection.jsx";
import CompaniesSection from "../components/CompaniesSection.jsx";
import BranchSection from "../components/BranchSection.jsx";
import ExperiencesSection from "../components/ExperiencesSection.jsx";

function HomePage({ year, onYearChange }) {
  return (
    <>
      <Hero year={year} onYearChange={onYearChange} />
      <StatsSection year={year} />
      <CompaniesSection year={year} />
      <BranchSection year={year} />
      <ExperiencesSection />
    </>
  );
}

export default HomePage;
