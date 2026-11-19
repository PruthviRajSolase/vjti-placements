/*
  ============================================================
  VJTI PLACEMENTS — STEP 6: STATE + EVENTS + FILTERING
  ============================================================

  NEW this step:
  - STATE: variables that remember "where the user is" — which
    year is selected, what they typed, which branch pill is on.
    RULE OF THUMB: when state changes, we re-render the affected
    part of the page. (This idea *is* React, foreshadowed.)
  - EVENTS: functions that run when the user does something
    (typing, clicking). We attach them with addEventListener.
  - DERIVED DATA: the branch pills aren't hardcoded — they're
    computed from the companies array each time.

  Concept tour:
  - let                  → a variable that CAN be reassigned
                           (const can't; use let for state that changes)
  - .filter()            → array method: keep only items the function
                           approves of (returns true), in a NEW array
  - .includes(text)      → does this string/array contain it?
  - .trim() / .toLowerCase() → clean up user input before comparing
  - Set                  → a collection of UNIQUE values; adding the
                           same value twice does nothing. Used to
                           derive the unique branch list.
  - addEventListener("input", fn) → run fn on every keystroke
  - event.target         → the element the user interacted with
  - .closest(selector)   → walk UP from target to find the nearest
                           matching ancestor — key trick of "event
                           delegation" (ONE listener for many children)
  - element.dataset.branch → reads data-branch="..." from HTML
  - .classList.toggle(name, on) → add/remove a class by condition
  ============================================================
*/

/* ------------------------------------------------------------
   STATE — the page's memory. Everything the user can change.
   ------------------------------------------------------------ */
let currentYear = CURRENT_YEAR;              // which year's data to show

const filters = {
  search: "",                                // text typed in the search box
  branch: "All",                             // selected branch pill
};

/* ------------------------------------------------------------
   DERIVED DATA
   ------------------------------------------------------------ */

/* Build the unique, sorted branch list for a year from the
   company data itself. A Set keeps only unique values. */
function getBranchesForYear(year) {
  const branches = new Set();
  COMPANIES_BY_YEAR[year].forEach((company) => {
    company.branches.forEach((branch) => branches.add(branch));
  });
  return ["All", ...Array.from(branches).sort()];
}

/* Keep only companies that match BOTH the search text AND the
   selected branch. Returns a new array; original untouched. */
function filterCompanies(companies) {
  const search = filters.search.trim().toLowerCase();

  return companies.filter((company) => {
    const matchesSearch =
      search === "" ||
      company.name.toLowerCase().includes(search) ||
      company.role.toLowerCase().includes(search);

    const matchesBranch =
      filters.branch === "All" || company.branches.includes(filters.branch);

    // true = keep this company, false = drop it
    return matchesSearch && matchesBranch;
  });
}

/* ------------------------------------------------------------
   RENDERERS (updated versions)
   ------------------------------------------------------------ */

/* Branch pills — rebuilt whenever the year or selection changes. */
function renderBranchPills(year) {
  const wrap = document.getElementById("branch-pills");
  const branches = getBranchesForYear(year);

  // Safety: if the selected branch doesn't exist in the new year's
  // data (years differ!), fall back to "All".
  if (!branches.includes(filters.branch)) {
    filters.branch = "All";
  }

  wrap.innerHTML = branches
    .map((branch) => {
      // Ternary: add the "active" class only on the selected pill
      const active = branch === filters.branch ? " active" : "";
      return `<button class="pill${active}" data-branch="${branch}">${branch}</button>`;
    })
    .join("");
}

/* Company table — now renders the FILTERED list + a count line. */
function renderCompanies(year) {
  const companies = COMPANIES_BY_YEAR[year];
  const visible = filterCompanies(companies);
  const tbody = document.getElementById("company-body");
  const countEl = document.getElementById("result-count");

  // "Early return": handle the nothing-matches case and leave.
  if (visible.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" class="no-results">
          No companies match your search. Try clearing the filters.
        </td>
      </tr>`;
    countEl.textContent = "Showing 0 companies";
    return;
  }

  tbody.innerHTML = visible
    .map(
      (company) => `
        <tr>
          <td>${company.name}</td>
          <td>${company.role}</td>
          <td>${company.package}</td>
          <td>${company.hired}</td>
          <td>${company.branches.join(", ")}</td>
        </tr>`
    )
    .join("");

  countEl.textContent =
    `Showing ${visible.length} of ${companies.length} companies`;

  document.getElementById("companies-title").textContent =
    "Companies — " + year;
}

/* Stats — unchanged logic, moved here for one file readability. */
function renderStats(year) {
  const stats = STATS_BY_YEAR[year];
  const grid = document.getElementById("stat-grid");

  const cards = [
    { value: stats.studentsPlaced, label: "Students Placed" },
    { value: stats.highest,        label: "Highest Package" },
    { value: stats.average,        label: "Average Package" },
    { value: stats.companies,      label: "Companies Visited" },
  ];

  grid.innerHTML = cards
    .map(
      (card) => `
        <div class="stat-card">
          <span class="stat-value">${card.value}</span>
          <span class="stat-label">${card.label}</span>
        </div>`
    )
    .join("");

  document.getElementById("stats-title").textContent =
    year + " Season at a Glance";
}

/* Branch-wise table — unchanged. */
function renderBranches(year) {
  const branches = BRANCH_STATS_BY_YEAR[year];
  const tbody = document.getElementById("branch-body");

  tbody.innerHTML = branches
    .map((b) => {
      const percentCell =
        b.percent >= 90 ? `<strong>${b.percent}%</strong>` : `${b.percent}%`;
      return `
        <tr>
          <td>${b.branch}</td>
          <td>${percentCell}</td>
        </tr>`;
    })
    .join("");

  document.getElementById("branches-title").textContent =
    "Branch-wise Placement — " + year;
}

/* Experiences — unchanged. */
function renderExperiences() {
  const list = document.getElementById("experience-list");

  list.innerHTML = EXPERIENCES.map(
    (exp) => `
      <article class="experience-card">
        <h3>${exp.heading}</h3>
        <p>${exp.excerpt}</p>
        <ul class="tags">
          ${exp.tags.map((tag) => `<li>${tag}</li>`).join("")}
        </ul>
        <span class="author">— ${exp.author.name}, ${exp.author.branch}, ${exp.author.year}</span>
      </article>`
  ).join("");
}

/* The conductor — now also rebuilds the pills. */
function renderAll(year) {
  renderStats(year);
  renderBranchPills(year);
  renderCompanies(year);
  renderBranches(year);
  renderExperiences();
}

/* ------------------------------------------------------------
   EVENTS — wire the page to the user.

   EVENT DELEGATION: instead of attaching a listener to every
   pill/tab (they get rebuilt constantly!), we attach ONE
   listener to their stable parent. When any child is clicked,
   the event "bubbles up" and we use .closest() to find WHICH
   child was hit. This survives re-rendering for free.
   ------------------------------------------------------------ */
function wireEvents() {
  /* 1. Search box: "input" fires on EVERY keystroke.
        Each keystroke updates state, then re-renders the table. */
  document
    .getElementById("company-search")
    .addEventListener("input", (event) => {
      filters.search = event.target.value;   // read what user typed
      renderCompanies(currentYear);          // re-render with new state
    });

  /* 2. Branch pills (delegated on the parent container). */
  document.getElementById("branch-pills").addEventListener("click", (event) => {
    const button = event.target.closest("button.pill");
    if (!button) return;                     // clicked the gap, not a pill

    filters.branch = button.dataset.branch;  // data-branch="CS" etc.
    renderBranchPills(currentYear);          // repaint selection highlight
    renderCompanies(currentYear);            // repaint table
  });

  /* 3. Year tabs (delegated on the nav). */
  document.getElementById("year-tabs").addEventListener("click", (event) => {
    const tab = event.target.closest("a.year-tab");
    if (!tab) return;

    currentYear = tab.dataset.year;          // STATE: new year

    // Repaint the .active highlight on the tabs themselves
    document.querySelectorAll("#year-tabs .year-tab").forEach((t) => {
      t.classList.toggle("active", t === tab);
    });

    // Reset filters (a new year = a fresh search)
    filters.search = "";
    document.getElementById("company-search").value = "";
    filters.branch = "All";

    renderAll(currentYear);                  // rebuild the whole page
  });
}

/* ------------------------------------------------------------
   BOOT: first render, then attach event listeners.
   ------------------------------------------------------------ */
renderAll(currentYear);
wireEvents();
