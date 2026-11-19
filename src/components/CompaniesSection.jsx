/*
  ============================================================
  STEP 7 — CompaniesSection.jsx: THE STAR COMPONENT.
  Compare line-by-line with vanilla script.js. Everything about
  search + pills + filtering is now ~40% shorter, with NO manual
  re-render calls, NO delegation, NO dataset reads.
  ============================================================

  KEY CONCEPTS:
  - LOCAL STATE: search text + selected branch live HERE via
    useState, because only this component uses them. (App owns
    `year` because everyone needs it — "lifting state up".)
  - CONTROLLED INPUT: the <input>'s value={search} comes FROM
    state, and onChange writes BACK to state. React state is the
    single source of truth; the DOM just displays it.
  - DERIVED VALUES: branchOptions and `visible` are computed on
    every render from current props+state. No caching, no
    "remember to rebuild pills when year changes" — impossible
    to get out of sync.
*/
import { useState } from "react";
import { Link } from "react-router-dom";
import { slugify } from "../data.js";
import { useContent } from "../ContentContext.jsx";

function CompaniesSection({ year }) {
  // Two independent pieces of state. Calling either setter
  // re-renders THIS component automatically.
  const [search, setSearch] = useState("");
  const [branch, setBranch] = useState("All");

  const { content } = useContent();
  const companies = content.companiesByYear[year] || [];

  // Derived: unique sorted branch list for THIS year.
  // .flatMap grabs every company's branches array into one big array.
  const branchOptions = [
    "All",
    ...Array.from(new Set(companies.flatMap((c) => c.branches))).sort(),
  ];

  // Derived: the filtered list, recomputed on every render.
  const searchLower = search.trim().toLowerCase();
  const visible = companies.filter((company) => {
    const matchesSearch =
      searchLower === "" ||
      company.name.toLowerCase().includes(searchLower) ||
      company.role.toLowerCase().includes(searchLower);

    const matchesBranch =
      branch === "All" || company.branches.includes(branch);

    return matchesSearch && matchesBranch;
  });

  return (
    <section className="companies" id="companies">
      <h2 className="section-title">Companies — {year}</h2>
      <p className="section-sub">
        Sample placement data — editable by TPO staff in the admin panel.
      </p>

      <div className="filters">
        {/* CONTROLLED INPUT: value flows FROM state into the box;
            onChange flows the keystroke BACK into state. One-way
            loop: type → setSearch → re-render → box shows value. */}
        <input
          type="search"
          className="search-input"
          placeholder="Search company or role…"
          autoComplete="off"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />

        <div className="branch-pills">
          {branchOptions.map((b) => (
            <button
              key={b}
              className={`pill${b === branch ? " active" : ""}`}
              onClick={() => setBranch(b)}
            >
              {b}
            </button>
          ))}
        </div>
      </div>

      <p className="result-count">
        Showing {visible.length} of {companies.length} companies
      </p>

      <div className="table-scroll">
        <table className="company-table">
          <thead>
            <tr>
              <th scope="col">Company</th>
              <th scope="col">Role</th>
              <th scope="col">Package (LPA)</th>
              <th scope="col">Students Hired</th>
              <th scope="col">Branches Eligible</th>
            </tr>
          </thead>
          <tbody>
            {/*
              CONDITIONAL RENDERING: a ternary inside JSX.
              Nothing matched? Render the friendly empty row.
              Otherwise map the visible companies into rows.
              Note colSpan (camelCase!) and key={c.name}.
            */}
            {visible.length === 0 ? (
              <tr>
                <td colSpan={5} className="no-results">
                  No companies match your search. Try clearing the filters.
                </td>
              </tr>
            ) : (
              visible.map((c) => (
                <tr key={c.name}>
                  <td>
                    {/* Step 8: company names are now LINKS to their
                        own page — /company/<slug> */}
                    <Link
                      className="company-link"
                      to={`/company/${slugify(c.name)}`}
                    >
                      {c.name}
                    </Link>
                  </td>
                  <td>{c.role}</td>
                  <td>{c.package}</td>
                  <td>{c.hired}</td>
                  <td>{c.branches.join(", ")}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default CompaniesSection;
