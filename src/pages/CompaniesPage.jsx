/*
  ============================================================
  STEP 8 — CompaniesPage.jsx: the COMPANIES GRID page.
  This mirrors the reference site's company listing: a card per
  company; clicking a card navigates to /company/<slug>.
  ============================================================

  NEW CONCEPTS:
  - <Link to={...}> with a TEMPLATE LITERAL — every card gets
    its own URL like /company/northbridge_software.
  - The year tabs here share App's state: change the year on
    THIS page and the homepage stats update too. One state,
    many pages.
  - The card JSX is extracted into <CompanyCard> — the map
    stays readable no matter how fancy the card becomes.
*/
import { useContent } from "../ContentContext.jsx";
import YearTabs from "../components/YearTabs.jsx";
import CompanyCard from "../components/CompanyCard.jsx";

function CompaniesPage({ year, onYearChange }) {
  const { content } = useContent();
  const companies = content.companiesByYear[year] || [];

  return (
    <section className="companies" id="companies">
      <div className="page-intro">
        <h1 className="page-title">Companies — {year}</h1>
        <p className="section-sub">
          Every company that visited in the {year} season. Click one for
          full details across years.
        </p>
        <YearTabs year={year} onYearChange={onYearChange} />
      </div>

      <div className="company-grid">
        {companies.map((c) => (
          <CompanyCard key={c.name} company={c} />
        ))}
      </div>
    </section>
  );
}

export default CompaniesPage;
