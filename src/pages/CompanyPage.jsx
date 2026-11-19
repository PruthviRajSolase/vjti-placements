/*
  ============================================================
  STEP 8 — CompanyPage.jsx: THE DYNAMIC ROUTE PAGE ⭐
  URL: /company/:slug    e.g. /company/jp_morgan_chase_co
  ============================================================

  useParams() gives us an object of the URL's dynamic segments:
  for /company/microsoft it returns { slug: "microsoft" }.
  This is how ONE component serves EVERY company — the URL is
  the input, the page is the output.

  We look the slug up in COMPANIES_BY_SLUG (built in data.js).
  A company may have visited in MULTIPLE years, so the lookup
  returns an object keyed by year: { "2026": {...}, "2025": {...} }.

  useEffect + window.scrollTo(0,0): when React swaps to this
  page, the browser keeps the old scroll position — we jump to
  the top after the page appears. useEffect(fn, [deps]) runs
  AFTER render whenever a dependency changes. (Full useEffect
  deep-dive comes in a later step — for now: "do a side-effect
  after the component appears".)
*/
import { useEffect } from "react";
import { Link, useParams } from "react-router-dom";
import { useContent } from "../ContentContext.jsx";
import BookmarkButton from "../components/BookmarkButton.jsx";

function CompanyPage() {
  // 1. Read the URL: /company/whatever → { slug: "whatever" }
  const { slug } = useParams();

  // 2. Jump to top whenever the slug changes (new page = new position)
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [slug]);

  // 3. Look up this company's visits: { year → entry }
  const { content } = useContent();
  const visitsByYear = content.companiesBySlug[slug];

  // 4. NOT FOUND state — early return with a friendly page
  if (!visitsByYear) {
    return (
      <section className="not-found">
        <h1>🤷</h1>
        <p>
          No company found at <code>/company/{slug}</code>.
        </p>
        <Link className="back-link" to="/companies">
          ← All companies
        </Link>
      </section>
    );
  }

  // 5. Latest year first (e.g. 2026 above 2025)
  const years = Object.keys(visitsByYear).sort().reverse();

  // 6. Unique roles across all years (a company may hire for
  //    different roles in different years)
  const roles = [
    ...new Set(years.map((y) => visitsByYear[y].role)),
  ];

  return (
    <section className="company-detail">
      <div className="company-detail-actions">
        <Link className="back-link" to="/companies">
          ← All companies
        </Link>
        <BookmarkButton slug={slug} />
      </div>

      {/* .map over years, NOT over companies — one card per visit */}
      {years.map((y) => {
        const c = visitsByYear[y];
        return (
          <article className="company-year-card" key={y}>
            <header className="year-card-head">
              <span className="year-badge">{y}</span>
              <h1>{c.name}</h1>
            </header>

            <div className="year-card-stats">
              <div className="detail-stat">
                <span className="stat-label">Role</span>
                <span className="stat-value-sm">{c.role}</span>
              </div>
              <div className="detail-stat">
                <span className="stat-label">Package</span>
                <span className="stat-value-sm accent">
                  ₹{c.package} LPA
                </span>
              </div>
              <div className="detail-stat">
                <span className="stat-label">Students Hired</span>
                <span className="stat-value-sm">{c.hired}</span>
              </div>
            </div>

            <div className="tags">
              {c.branches.map((branch) => (
                <span className="tag" key={branch}>
                  {branch}
                </span>
              ))}
            </div>
          </article>
        );
      })}

      <p className="roles-line">
        Roles across years: <strong>{roles.join(", ")}</strong>
      </p>
    </section>
  );
}

export default CompanyPage;
