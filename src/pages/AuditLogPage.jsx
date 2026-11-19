/*
  Phase 4 — AuditLogPage.jsx (TPOI only)
  Every staff write, submission, edit and review lands in audit_log. This
  page makes the record readable without touching the database.
*/
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api.js";

function actionClass(action) {
  if (action.startsWith("create") || action === "register") return "create";
  if (action.startsWith("delete") || action.startsWith("reject")) return "danger";
  if (action.startsWith("review") || action.startsWith("change")) return "review";
  return "update";
}

function AuditLogPage() {
  const [entries, setEntries] = useState([]);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api("/admin/audit")
      .then((data) => setEntries(data.entries))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const visible = entries.filter((entry) => {
    const needle = search.trim().toLowerCase();
    return !needle ||
      entry.action.toLowerCase().includes(needle) ||
      (entry.target || "").toLowerCase().includes(needle) ||
      entry.actor.name.toLowerCase().includes(needle);
  });

  return (
    <section className="list-page">
      <div className="page-intro">
        <Link className="back-link" to="/admin">← Content admin</Link>
        <h1 className="page-title">Audit log</h1>
        <p className="section-sub">
          Who changed what, and when. The most recent {entries.length} events are shown.
        </p>
      </div>

      {error && <p className="form-error" role="alert">{error}</p>}

      <div className="admin-card">
        <input
          type="search" className="search-input" placeholder="Search action, target or person…"
          value={search} onChange={(e) => setSearch(e.target.value)}
        />
        {loading ? (
          <p className="page-loading">Loading audit entries…</p>
        ) : (
          <div className="table-scroll">
            <table className="company-table admin-table audit-table">
              <thead>
                <tr>
                  <th scope="col">When (UTC)</th>
                  <th scope="col">Who</th>
                  <th scope="col">Action</th>
                  <th scope="col">Target</th>
                </tr>
              </thead>
              <tbody>
                {visible.length === 0 ? (
                  <tr><td colSpan={4} className="no-results">No matching entries.</td></tr>
                ) : (
                  visible.map((entry) => (
                    <tr key={entry.id}>
                      <td>{entry.createdAt}</td>
                      <td>
                        <strong>{entry.actor.name}</strong>
                        {entry.actor.email && <small> · {entry.actor.email}</small>}
                      </td>
                      <td><span className={`audit-action ${actionClass(entry.action)}`}>{entry.action}</span></td>
                      <td>{entry.target || "—"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}

export default AuditLogPage;
