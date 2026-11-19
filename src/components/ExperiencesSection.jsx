/*
  Phase 5 — ExperiencesSection.jsx
  The public write-up library. Cards link to /experience/:id for the full
  story; search, company, year and tag filters are kept in the URL query
  string so a filtered view can be bookmarked or shared.

  Filtering happens in the browser over the already-loaded /api/content
  payload — no extra request per keystroke. The SERVER still owns what is in
  that payload: only approved write-ups and public bylines ever arrive here.
*/
import { useEffect } from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import { useAuth } from "../AuthContext.jsx";
import { useContent } from "../ContentContext.jsx";

function ExperiencesSection() {
  const { content } = useContent();
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();

  // React Router does not scroll to a hash on its own. Detail pages link back
  // to /?...#experiences, so honour that anchor when the section mounts.
  useEffect(() => {
    if (location.hash === "#experiences") {
      document.getElementById("experiences")?.scrollIntoView();
    }
  }, [location.hash]);

  const experiences = content.experiences;
  const query = (searchParams.get("q") || "").trim();
  const company = searchParams.get("company") || "";
  const year = searchParams.get("year") || "";
  const tag = searchParams.get("tag") || "";

  // Option lists are derived from the data, so a newly approved write-up
  // automatically appears in the right filter — no hard-coded arrays.
  const companies = [...new Set(experiences.map((e) => e.company))].sort();
  const years = [...new Set(experiences.map((e) => e.placementYear))]
    .sort().reverse();
  const tags = [...new Set(experiences.flatMap((e) => e.tags))].sort();

  const filtered = experiences.filter((exp) => {
    if (company && exp.company !== company) return false;
    if (year && exp.placementYear !== year) return false;
    if (tag && !exp.tags.includes(tag)) return false;
    if (query) {
      const haystack = [
        exp.company, exp.role, exp.heading, exp.excerpt,
        ...exp.tags, exp.author.name, exp.placementYear,
      ].join(" ").toLowerCase();
      if (!haystack.includes(query.toLowerCase())) return false;
    }
    return true;
  });

  function setFilter(key, value) {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value);
    else next.delete(key);
    // preventScrollReset keeps the user next to the cards while typing.
    setSearchParams(next, { preventScrollReset: true });
  }

  function clearFilters() {
    setSearchParams(new URLSearchParams(), { preventScrollReset: true });
  }

  const hasFilters = Boolean(query || company || year || tag);

  return (
    <section className="experiences" id="experiences">
      <h2 className="section-title">Interview Experiences</h2>
      <p className="section-sub">
        Reviewed write-ups from seniors who sat for these companies. Search,
        filter and open any story for the full process.
      </p>

      <div className="experience-filters">
        <label className="search-field">
          <span>Search</span>
          <input
            className="search-input"
            type="search"
            value={query}
            onChange={(event) => setFilter("q", event.target.value)}
            placeholder="Company, role, tag or keyword…"
            aria-label="Search interview experiences"
          />
        </label>

        <label className="search-field">
          <span>Company</span>
          <select
            className="filter-select"
            value={company}
            onChange={(event) => setFilter("company", event.target.value)}
            aria-label="Filter experiences by company"
          >
            <option value="">All companies</option>
            {companies.map((name) => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
        </label>

        <label className="search-field">
          <span>Year</span>
          <select
            className="filter-select"
            value={year}
            onChange={(event) => setFilter("year", event.target.value)}
            aria-label="Filter experiences by placement year"
          >
            <option value="">All years</option>
            {years.map((value) => (
              <option key={value} value={value}>{value}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="exp-tag-filters" role="group" aria-label="Filter experiences by topic">
        <button
          type="button"
          className={`filter-tab${tag ? "" : " active"}`}
          aria-pressed={!tag}
          onClick={() => setFilter("tag", "")}
        >
          All topics
        </button>
        {tags.map((value) => (
          <button
            key={value}
            type="button"
            className={`filter-tab${tag === value ? " active" : ""}`}
            aria-pressed={tag === value}
            onClick={() => setFilter("tag", tag === value ? "" : value)}
          >
            {value}
          </button>
        ))}
      </div>

      <p className="filter-summary">
        Showing <strong>{filtered.length}</strong> of {experiences.length} write-ups
        {hasFilters && (
          <button type="button" className="clear-filters" onClick={clearFilters}>
            Clear filters
          </button>
        )}
      </p>

      {filtered.length === 0 ? (
        <div className="empty-card">
          <h2>No write-ups match</h2>
          <p>Try a different keyword, company, year or topic.</p>
          <button type="button" className="btn-primary" onClick={clearFilters}>
            Clear filters
          </button>
        </div>
      ) : (
        <div className="experience-list">
          {filtered.map((exp) => (
            <Link
              className="experience-card"
              key={exp.id}
              to={`/experience/${exp.id}`}
              state={{ from: searchParams.toString() }}
            >
              <div className="experience-card-top">
                <span className="year-badge">{exp.placementYear}</span>
                <span className="experience-company">{exp.company}</span>
              </div>
              <h3>{exp.heading}</h3>
              <p>{exp.excerpt}</p>

              <ul className="tags">
                {exp.tags.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>

              <span className="experience-read">Read full write-up →</span>
              <span className="author">
                — {[exp.author.name, exp.author.branch].filter(Boolean).join(", ")}
                {exp.author.year ? `, ${exp.author.year}` : ""}
              </span>
            </Link>
          ))}
        </div>
      )}

      <div className="experience-cta">
        {["student", "contributor"].includes(user?.role) ? (
          <>
            <span>Were you placed? Help the next batch by sharing your process.</span>
            <Link className="btn-primary" to="/submit">Share your experience →</Link>
          </>
        ) : (
          <>
            <span>Were you placed? Sign in with your VJTI email to share your process.</span>
            <Link className="btn-secondary" to="/signin">Sign in to contribute</Link>
          </>
        )}
      </div>
    </section>
  );
}

export default ExperiencesSection;
