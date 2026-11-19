/*
  STEP 8 — CompanyCard.jsx: one tile in the companies grid.

  This is an "extracted component": CompaniesPage maps over
  companies and renders <CompanyCard company={c} /> for each.
  The card receives ONE prop — the company object — and renders
  itself. The <Link> filling the card navigates to /company/<slug>.

  Phase 6: the card is now an <article> with the link and the Save button as
  SIBLINGS. Nesting a button (or a second link) inside a <Link> is invalid
  HTML, so the bookmark control sits above the link instead.
*/
import { Link } from "react-router-dom";
import { slugify } from "../data.js";
import BookmarkButton from "./BookmarkButton.jsx";

function CompanyCard({ company }) {
  const slug = slugify(company.name);
  return (
    <article className="company-card">
      <Link className="company-card-link" to={`/company/${slug}`}>
        <h3>{company.name}</h3>
        <span className="company-role">{company.role}</span>

        <span className="company-package">₹{company.package} LPA</span>

        <span className="company-hired">{company.hired} students hired</span>

        <span className="view-details">View details →</span>
      </Link>
      <BookmarkButton slug={slug} floating />
    </article>
  );
}

export default CompanyCard;
