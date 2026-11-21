/*
  Phase 2 — AdminPage.jsx (TPO / TPOI only)
  The admin panel: edit yearly stats, manage companies, set branch
  percentages. Every write goes through the role-protected API, and a
  successful save refreshes the shared content so public pages update.
*/
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api.js";
import { useAuth } from "../AuthContext.jsx";
import { useContent } from "../ContentContext.jsx";
import YearTabs from "../components/YearTabs.jsx";

const emptyStats = { studentsPlaced: 0, highest: "", average: "", companies: 0 };
const emptyCompany = { id: null, name: "", role: "", package: "", hired: "", branches: "" };

function AdminPage() {
  const { user } = useAuth();
  const { content, refresh } = useContent();

  const [year, setYear] = useState(content.currentYear);
  const [raw, setRaw] = useState({ stats: [], companies: [], branchStats: [] });
  const [statsForm, setStatsForm] = useState(emptyStats);
  const [companyForm, setCompanyForm] = useState(emptyCompany);
  const [branchRows, setBranchRows] = useState([]);
  const [message, setMessage] = useState(null);
  const [busy, setBusy] = useState(false);
  const [csvText, setCsvText] = useState("");
  const [csvFileName, setCsvFileName] = useState("");

  const branchNames = useMemo(() => {
    const names = new Set(
      Object.values(content.branchStatsByYear).flat().map((row) => row.branch)
    );
    raw.branchStats.forEach((row) => names.add(row.branch));
    return [...names].sort();
  }, [content.branchStatsByYear, raw.branchStats]);

  async function loadRaw() {
    const data = await api("/admin/content");
    setRaw(data);
  }

  useEffect(() => {
    loadRaw().catch((err) => setMessage({ type: "error", text: err.message }));
  }, []);

  useEffect(() => {
    const stat = raw.stats.find((row) => row.year === year);
    setStatsForm(
      stat
        ? {
            studentsPlaced: stat.students_placed,
            highest: stat.highest_package,
            average: stat.average_package,
            companies: stat.companies_visited,
          }
        : { ...emptyStats }
    );

    const rows = raw.branchStats
      .filter((row) => row.year === year)
      .map((row) => ({
        branch: row.branch,
        percent: row.percent,
        totalStudents: row.totalStudents ?? 0,
        placedStudents: row.placedStudents ?? 0,
      }));
    setBranchRows(
      rows.length
        ? rows
        : branchNames.map((branch) => ({ branch, percent: 0, totalStudents: 0, placedStudents: 0 }))
    );
  }, [raw, year, branchNames]);

  // Shared save flow: write -> reload admin data -> refresh public data.
  // `action` is a thunk so the request only fires here, after busy is set.
  async function run(action, successText) {
    setBusy(true);
    setMessage(null);
    try {
      await action();
      await loadRaw();
      await refresh();
      setMessage({ type: "success", text: successText });
      return true;
    } catch (err) {
      setMessage({ type: "error", text: err.message });
      return false;
    } finally {
      setBusy(false);
    }
  }

  function saveStats(event) {
    event.preventDefault();
    const body = {
      ...statsForm,
      studentsPlaced: derivedPlaced ?? statsForm.studentsPlaced,
    };
    run(
      () => api(`/admin/stats/${year}`, { method: "PUT", body }),
      `Saved ${year} statistics. The homepage now shows the new numbers.`
    );
  }

  async function saveCompany(event) {
    event.preventDefault();
    const body = {
      year,
      name: companyForm.name,
      role: companyForm.role,
      package: Number(companyForm.package),
      hired: Number(companyForm.hired),
      branches: companyForm.branches.split(",").map((b) => b.trim()).filter(Boolean),
    };
    const saved = await run(
      () => (companyForm.id
        ? api(`/admin/companies/${companyForm.id}`, { method: "PUT", body })
        : api("/admin/companies", { method: "POST", body })),
      "Company saved."
    );
    if (saved) setCompanyForm(emptyCompany);
  }

  function editCompany(company) {
    setCompanyForm({
      id: company.id,
      name: company.name,
      role: company.role,
      package: company.package_lpa,
      hired: company.hired,
      branches: company.branches,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function deleteCompany(company) {
    if (!window.confirm(`Delete ${company.name} (${company.year})?`)) return;
    run(
      () => api(`/admin/companies/${company.id}`, { method: "DELETE" }),
      "Company deleted."
    );
  }

  function saveBranches(event) {
    event.preventDefault();
    const rows = branchRows.map((row) => {
      const totalStudents = Number(row.totalStudents ?? 0);
      const percent = Number(row.percent ?? 0);
      const placedStudents = row.placedStudents !== undefined
        ? Number(row.placedStudents)
        : (totalStudents > 0 ? Math.round((totalStudents * percent) / 100) : Math.round(percent));
      return { branch: row.branch, totalStudents, placedStudents };
    });
    run(
      () => api(`/admin/branch-stats/${year}`, {
        method: "PUT",
        body: { rows },
      }),
      `Saved ${year} branch placement data.`
    );
  }

  async function chooseCsv(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    setCsvText(await file.text());
    setCsvFileName(file.name);
    setMessage(null);
  }

  async function importCsv(event) {
    event.preventDefault();
    if (!csvText.trim()) {
      setMessage({ type: "error", text: "Choose a CSV file or paste rows first." });
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const result = await api("/admin/companies/import", {
        method: "POST",
        body: { year, csv: csvText },
      });
      await loadRaw();
      await refresh();
      setMessage({
        type: "success",
        text: `Imported ${result.imported} row(s) for ${year}: ${result.created} new, ${result.updated} updated.`,
      });
      setCsvText("");
      setCsvFileName("");
    } catch (err) {
      // The API returns per-row problems in `details` (see src/api.js).
      setMessage({ type: "error", text: err.message, details: err.details });
    } finally {
      setBusy(false);
    }
  }

  const companies = raw.companies.filter((row) => row.year === year);
  const branchRowsForYear = raw.branchStats.filter((row) => row.year === year);
  const derivedPlaced = branchRowsForYear.length > 0
    ? branchRowsForYear.reduce((sum, row) => sum + Number(row.placedStudents ?? 0), 0)
    : null;

  return (
    <section className="admin-page">
      <div className="page-intro">
        <h1 className="page-title">TPO Admin</h1>
        <p className="section-sub">
          Signed in as <strong>{user.fullName}</strong> · role: <strong>{user.role}</strong>
        </p>
        <YearTabs year={year} onYearChange={setYear} />
      </div>

      {message && (
        <div className={`admin-message ${message.type}`} role="status">
          <p>{message.text}</p>
          {message.details?.length > 0 && (
            <ul className="admin-message-details">
              {message.details.map((detail) => <li key={detail}>{detail}</li>)}
            </ul>
          )}
        </div>
      )}

      <div className="admin-shortcuts">
        <Link className="admin-shortcut" to="/admin/drives">
          <strong>Placement drives</strong>
          <small>Publish upcoming drives, deadlines and eligibility; see applicant counts.</small>
          <span aria-hidden="true">Manage drives →</span>
        </Link>
        <Link className="admin-shortcut" to="/admin/reviews">
          <strong>Experience review queue</strong>
          <small>Approve, reject or request changes on student write-ups.</small>
          <span aria-hidden="true">Open queue →</span>
        </Link>
        <Link className="admin-shortcut" to="/admin/alumni">
          <strong>Alumni outreach</strong>
          <small>Email placed alumni to help bring companies for placement/internship drives.</small>
          <span aria-hidden="true">Open outreach →</span>
        </Link>
        <Link className="admin-shortcut" to="/admin/users">
          <strong>Accounts &amp; roles</strong>
          <small>Grant contributor status or create staff accounts.</small>
          <span aria-hidden="true">Manage →</span>
        </Link>
        {user.role === "tpoi" && (
          <Link className="admin-shortcut" to="/admin/audit">
            <strong>Audit log</strong>
            <small>See who changed what, and when.</small>
            <span aria-hidden="true">View log →</span>
          </Link>
        )}
      </div>

      <div className="admin-grid">
        {/* ---- Season statistics ---- */}
        <form className="admin-card" onSubmit={saveStats}>
          <h2 className="section-title">{year} statistics</h2>
          <p className="section-sub">These four numbers appear on the homepage.</p>

          <div className="admin-fields">
            <label>
              Students placed
              <input
                type="number"
                min="0"
                value={derivedPlaced ?? statsForm.studentsPlaced}
                readOnly={derivedPlaced !== null}
                disabled={derivedPlaced !== null}
                onChange={(e) => setStatsForm({ ...statsForm, studentsPlaced: e.target.value })}
              />
              {derivedPlaced !== null && (
                <span className="field-help">Calculated from the branch table.</span>
              )}
            </label>
            <label>
              Highest package
              <input
                type="text" value={statsForm.highest}
                onChange={(e) => setStatsForm({ ...statsForm, highest: e.target.value })}
              />
            </label>
            <label>
              Average package
              <input
                type="text" value={statsForm.average}
                onChange={(e) => setStatsForm({ ...statsForm, average: e.target.value })}
              />
            </label>
            <label>
              Companies visited
              <input
                type="number" min="0" value={statsForm.companies}
                onChange={(e) => setStatsForm({ ...statsForm, companies: e.target.value })}
              />
            </label>
          </div>
          <button className="btn-primary admin-submit" type="submit" disabled={busy}>
            Save statistics
          </button>
        </form>

        {/* ---- Companies ---- */}
        <div className="admin-card admin-card-wide">
          <h2 className="section-title">Companies — {year}</h2>
          <p className="section-sub">Add, edit or remove visiting companies.</p>

          <form className="admin-company-form" onSubmit={saveCompany}>
            <input
              aria-label="Company name" placeholder="Company name" required
              value={companyForm.name}
              onChange={(e) => setCompanyForm({ ...companyForm, name: e.target.value })}
            />
            <input
              aria-label="Role" placeholder="Role" required
              value={companyForm.role}
              onChange={(e) => setCompanyForm({ ...companyForm, role: e.target.value })}
            />
            <input
              aria-label="Package in LPA" type="number" step="0.1" min="0"
              placeholder="Package (LPA)" value={companyForm.package}
              onChange={(e) => setCompanyForm({ ...companyForm, package: e.target.value })}
            />
            <input
              aria-label="Students hired" type="number" min="0" placeholder="Hired"
              value={companyForm.hired}
              onChange={(e) => setCompanyForm({ ...companyForm, hired: e.target.value })}
            />
            <input
              aria-label="Eligible branches" placeholder="Branches (comma separated)"
              value={companyForm.branches}
              onChange={(e) => setCompanyForm({ ...companyForm, branches: e.target.value })}
            />
            <button className="btn-primary" type="submit" disabled={busy}>
              {companyForm.id ? "Update" : "Add company"}
            </button>
            {companyForm.id && (
              <button
                type="button" className="btn-signout"
                onClick={() => setCompanyForm(emptyCompany)}
              >
                Cancel
              </button>
            )}
          </form>

          <div className="table-scroll">
            <table className="company-table admin-table">
              <thead>
                <tr>
                  <th scope="col">Company</th>
                  <th scope="col">Role</th>
                  <th scope="col">Package</th>
                  <th scope="col">Hired</th>
                  <th scope="col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {companies.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="no-results">No companies for this year yet.</td>
                  </tr>
                ) : (
                  companies.map((company) => (
                    <tr key={company.id}>
                      <td><strong>{company.name}</strong></td>
                      <td>{company.role}</td>
                      <td>₹{company.package_lpa} LPA</td>
                      <td>{company.hired}</td>
                      <td className="admin-actions">
                        <button type="button" onClick={() => editCompany(company)}>Edit</button>
                        <button type="button" onClick={() => deleteCompany(company)}>Delete</button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* ---- CSV import (Phase 8) ---- */}
        <form className="admin-card admin-card-wide csv-import-card" onSubmit={importCsv}>
          <h2 className="section-title">Import companies — {year}</h2>
          <p className="section-sub">
            Upload a CSV to add or update companies for {year}. Rows are matched
            by company name, so re-importing an updated file edits existing
            entries instead of duplicating them.
          </p>
          <p className="csv-format">
            Header: <code>name,role,package,hired,branches</code> — quote any
            field containing a comma, e.g. <code>"CS,IT"</code>.
          </p>

          <div className="csv-controls">
            <label className="csv-file-label">
              Choose .csv file
              <input
                type="file"
                accept=".csv,text/csv"
                aria-label="Choose companies CSV file"
                onChange={chooseCsv}
              />
            </label>
            {csvFileName && <span className="csv-file-name">{csvFileName}</span>}
          </div>

          <label className="csv-paste-label">
            Or paste CSV rows
            <textarea
              aria-label="Paste companies CSV"
              value={csvText}
              onChange={(event) => setCsvText(event.target.value)}
              rows={5}
              placeholder={'name,role,package,hired,branches\nExample Corp,Software Engineer,8.5,12,"CS,IT"'}
            />
          </label>

          <button className="btn-primary admin-submit" type="submit" disabled={busy}>
            Import into {year}
          </button>
        </form>

        {/* ---- Branch placement ---- */}
        <form className="admin-card admin-card-wide" onSubmit={saveBranches}>
          <h2 className="section-title">Branch-wise placement — {year}</h2>
          <p className="section-sub">Enter total and placed student counts. Placement % is calculated automatically.</p>

          <div className="table-scroll">
            <table className="branch-table admin-branch-table">
              <thead>
                <tr>
                  <th scope="col">Branch</th>
                  <th scope="col">Total students</th>
                  <th scope="col">Placed</th>
                  <th scope="col">Placed %</th>
                </tr>
              </thead>
              <tbody>
                {branchRows.map((row, index) => {
                  const total = Number(row.totalStudents ?? 0);
                  const placed = Number(row.placedStudents ?? 0);
                  const percent = total > 0 ? Math.round((placed / total) * 1000) / 10 : 0;
                  return (
                    <tr key={row.branch}>
                      <td>{row.branch}</td>
                      <td>
                        <input
                          aria-label={`${row.branch} total students`}
                          type="number"
                          min="0"
                          step="1"
                          value={row.totalStudents}
                          onChange={(event) => {
                            const totalStudents = event.target.value;
                            setBranchRows((current) =>
                              current.map((item, i) =>
                                i === index ? { ...item, totalStudents } : item
                              )
                            );
                          }}
                        />
                      </td>
                      <td>
                        <input
                          aria-label={`${row.branch} placed students`}
                          type="number"
                          min="0"
                          step="1"
                          value={row.placedStudents}
                          onChange={(event) => {
                            const placedStudents = event.target.value;
                            setBranchRows((current) =>
                              current.map((item, i) =>
                                i === index ? { ...item, placedStudents } : item
                              )
                            );
                          }}
                        />
                      </td>
                      <td>{percent.toFixed(1)}%</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr>
                  <th scope="row">Total</th>
                  <td>{branchRows.reduce((sum, row) => sum + Number(row.totalStudents || 0), 0)}</td>
                  <td>{branchRows.reduce((sum, row) => sum + Number(row.placedStudents || 0), 0)}</td>
                  <td>
                    {(() => {
                      const total = branchRows.reduce((sum, row) => sum + Number(row.totalStudents || 0), 0);
                      const placed = branchRows.reduce((sum, row) => sum + Number(row.placedStudents || 0), 0);
                      return `${(total > 0 ? Math.round((placed / total) * 1000) / 10 : 0).toFixed(1)}%`;
                    })()}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
          <button className="btn-primary admin-submit" type="submit" disabled={busy}>
            Save branch placement
          </button>
        </form>
      </div>
    </section>
  );
}

export default AdminPage;
