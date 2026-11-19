/*
  Phase 4 — AdminUsersPage.jsx
  TPO: find placed students and grant/revoke `contributor`.
  TPOI: also create staff accounts and change any role except their own.
  The UI only mirrors the server's permission matrix — the API enforces it.
*/
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api.js";
import { useAuth } from "../AuthContext.jsx";

const ROLE_LABEL = {
  student: "Student",
  contributor: "Contributor",
  tpo: "TPO staff",
  tpoi: "TPO in-charge",
};

const emptyStaff = { fullName: "", email: "", password: "", role: "tpo" };

function AdminUsersPage() {
  const { user } = useAuth();
  const isSuperAdmin = user.role === "tpoi";
  const [users, setUsers] = useState([]);
  const [drafts, setDrafts] = useState({});
  const [search, setSearch] = useState("");
  const [staff, setStaff] = useState(emptyStaff);
  const [message, setMessage] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const data = await api("/admin/users");
    setUsers(data.users);
    setDrafts(Object.fromEntries(data.users.map((u) => [u.id, u.role])));
  }, []);

  useEffect(() => {
    load()
      .catch((err) => setMessage({ type: "error", text: err.message }))
      .finally(() => setLoading(false));
  }, [load]);

  function optionsFor(target) {
    if (target.id === user.id) return [target.role];
    if (isSuperAdmin) return ["student", "contributor", "tpo", "tpoi"];
    if (["tpo", "tpoi"].includes(target.role)) return [target.role];
    return ["student", "contributor"];
  }

  function canEdit(target) {
    if (target.id === user.id) return false;
    if (isSuperAdmin) return true;
    return ["student", "contributor"].includes(target.role);
  }

  async function saveRole(target) {
    setBusyId(target.id);
    setMessage(null);
    try {
      const result = await api(`/admin/users/${target.id}/role`, {
        method: "PUT",
        body: { role: drafts[target.id] },
      });
      await load();
      setMessage({
        type: "success",
        text: `${result.user.fullName} is now ${ROLE_LABEL[result.user.role]}. The change took effect immediately.`,
      });
    } catch (err) {
      setMessage({ type: "error", text: err.message });
      await load();
    } finally {
      setBusyId(null);
    }
  }

  async function createStaff(event) {
    event.preventDefault();
    setMessage(null);
    setBusyId("new");
    try {
      const result = await api("/admin/users", { method: "POST", body: staff });
      await load();
      setStaff(emptyStaff);
      setMessage({
        type: "success",
        text: `Created ${ROLE_LABEL[result.user.role]} account for ${result.user.fullName}.`,
      });
    } catch (err) {
      setMessage({ type: "error", text: err.message });
    } finally {
      setBusyId(null);
    }
  }

  const visible = users.filter((entry) => {
    const needle = search.trim().toLowerCase();
    return !needle ||
      entry.fullName.toLowerCase().includes(needle) ||
      entry.email.toLowerCase().includes(needle) ||
      entry.role.includes(needle);
  });

  if (loading) return <p className="page-loading">Loading accounts…</p>;

  return (
    <section className="list-page admin-users-page">
      <div className="page-intro">
        <Link className="back-link" to="/admin">← Content admin</Link>
        <h1 className="page-title">Accounts &amp; roles</h1>
        <p className="section-sub">
          Signed in as <strong>{user.fullName}</strong> ({ROLE_LABEL[user.role]}).
          {isSuperAdmin
            ? " You can create staff accounts and change any role except your own."
            : " You can grant or revoke contributor status for verified students."}
        </p>
        {isSuperAdmin && <Link className="btn-secondary" to="/admin/audit">View audit log →</Link>}
      </div>

      {message && (
        <p className={`admin-message ${message.type}`} role="status">{message.text}</p>
      )}

      {isSuperAdmin && (
        <form className="admin-card staff-form" onSubmit={createStaff}>
          <h2 className="section-title">Create a staff account</h2>
          <p className="section-sub">New staff sign in with this email and password.</p>
          <div className="admin-fields">
            <label>
              Full name
              <input
                type="text" required maxLength={80} placeholder="Nisha Rao"
                value={staff.fullName}
                onChange={(e) => setStaff({ ...staff, fullName: e.target.value })}
              />
            </label>
            <label>
              College email
              <input
                type="email" required placeholder="nisha@vjti.ac.in"
                value={staff.email}
                onChange={(e) => setStaff({ ...staff, email: e.target.value })}
              />
            </label>
            <label>
              Temporary password
              <input
                type="text" required minLength={8} placeholder="At least 8 characters"
                value={staff.password}
                onChange={(e) => setStaff({ ...staff, password: e.target.value })}
              />
            </label>
            <label>
              Role
              <select
                value={staff.role}
                onChange={(e) => setStaff({ ...staff, role: e.target.value })}
              >
                <option value="tpo">TPO staff</option>
                <option value="tpoi">TPO in-charge</option>
              </select>
            </label>
          </div>
          <button className="btn-primary admin-submit" type="submit" disabled={busyId === "new"}>
            Create account
          </button>
        </form>
      )}

      <div className="admin-card">
        <h2 className="section-title">All accounts ({visible.length})</h2>
        <p className="section-sub">
          Role changes are checked on the server and take effect on the next request —
          no re-login needed.
        </p>
        <input
          type="search" className="search-input" placeholder="Search name, email or role…"
          value={search} onChange={(e) => setSearch(e.target.value)}
        />
        <div className="table-scroll">
          <table className="company-table admin-table users-table">
            <thead>
              <tr>
                <th scope="col">Name</th>
                <th scope="col">Email</th>
                <th scope="col">Role</th>
                <th scope="col">Change role</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((entry) => (
                <tr key={entry.id}>
                  <td><strong>{entry.fullName}</strong></td>
                  <td>{entry.email}</td>
                  <td><span className={`role-badge ${entry.role}`}>{ROLE_LABEL[entry.role]}</span></td>
                  <td>
                    {canEdit(entry) ? (
                      <div className="role-editor">
                        <select
                          aria-label={`Role for ${entry.fullName}`}
                          value={drafts[entry.id] || entry.role}
                          onChange={(e) =>
                            setDrafts((current) => ({ ...current, [entry.id]: e.target.value }))
                          }
                        >
                          {optionsFor(entry).map((role) => (
                            <option key={role} value={role}>{ROLE_LABEL[role]}</option>
                          ))}
                        </select>
                        <button
                          type="button"
                          disabled={busyId === entry.id || drafts[entry.id] === entry.role}
                          onClick={() => saveRole(entry)}
                        >
                          Save
                        </button>
                      </div>
                    ) : (
                      <span className="no-results">{entry.id === user.id ? "You" : "Locked"}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

export default AdminUsersPage;
