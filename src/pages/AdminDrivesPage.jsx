/*
  TPO drive management. Publish, edit and close the drives students apply to.
  All writes are audited and publishing notifies eligible students.
*/
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api.js";
import { BRANCHES } from "../branches.js";

const EMPTY = {
  company: "", role: "", package: "", location: "",
  eligibilityBranches: [], graduationYears: "",
  registrationDeadline: "", driveDate: "", applyLink: "", description: "", status: "open",
};

export default function AdminDrivesPage() {
  const [drives, setDrives] = useState([]);
  const [form, setForm] = useState(EMPTY);
  const [editingId, setEditingId] = useState(null);
  const [message, setMessage] = useState(null);
  const [busy, setBusy] = useState(false);

  function load() {
    api("/admin/drives")
      .then((data) => setDrives(data.drives))
      .catch((err) => setMessage({ type: "error", text: err.message }));
  }

  useEffect(load, []);

  function change(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function startEdit(drive) {
    setEditingId(drive.id);
    setForm({
      company: drive.company,
      role: drive.role,
      package: drive.package ?? "",
      location: drive.location || "",
      eligibilityBranches: drive.eligibilityBranches,
      graduationYears: drive.graduationYears.join(", "),
      registrationDeadline: drive.registrationDeadline || "",
      driveDate: drive.driveDate || "",
      applyLink: drive.applyLink || "",
      description: drive.description || "",
      status: drive.status,
    });
    setMessage(null);
  }

  function reset() {
    setEditingId(null);
    setForm(EMPTY);
  }

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      const result = await api(editingId ? `/admin/drives/${editingId}` : "/admin/drives", {
        method: editingId ? "PUT" : "POST",
        body: form,
      });
      setMessage({
        type: "success",
        text: editingId ? `Updated ${result.drive.company}.` : `Published ${result.drive.company} — eligible students were notified.`,
      });
      reset();
      load();
    } catch (err) {
      setMessage({ type: "error", text: err.message });
    } finally {
      setBusy(false);
    }
  }

  async function remove(drive) {
    if (!window.confirm(`Delete the ${drive.company} drive? Tracking rows for it will also be removed.`)) return;
    setBusy(true);
    setMessage(null);
    try {
      await api(`/admin/drives/${drive.id}`, { method: "DELETE" });
      setMessage({ type: "success", text: `Deleted the ${drive.company} drive.` });
      if (editingId === drive.id) reset();
      load();
    } catch (err) {
      setMessage({ type: "error", text: err.message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="admin-page">
      <div className="page-intro">
        <Link className="back-link" to="/admin">← Admin</Link>
        <h1 className="page-title">Placement drives</h1>
        <p className="section-sub">
          Publish upcoming placement and internship drives. Students whose branch and batch
          match will see a notification; everyone can find the drive on the public page.
        </p>
      </div>

      {message && (
        <div className={`admin-message ${message.type}`} role="status"><p>{message.text}</p></div>
      )}

      <div className="admin-grid">
        <form className="admin-card admin-card-wide" onSubmit={submit}>
          <h2 className="section-title">{editingId ? "Edit drive" : "Publish a new drive"}</h2>
          <div className="admin-fields">
            <label>Company<input required value={form.company} onChange={(e) => change("company", e.target.value)} /></label>
            <label>Role<input required value={form.role} onChange={(e) => change("role", e.target.value)} /></label>
            <label>Package (LPA)<input type="number" min="0" step="0.25" value={form.package} onChange={(e) => change("package", e.target.value)} /></label>
            <label>Location<input value={form.location} onChange={(e) => change("location", e.target.value)} /></label>
            <label>Eligible branches
              <select
                multiple
                value={form.eligibilityBranches}
                onChange={(e) => change("eligibilityBranches", Array.from(e.target.selectedOptions, (option) => option.value))}
              >
                {BRANCHES.map((branch) => (
                  <option key={branch} value={branch}>{branch}</option>
                ))}
              </select>
            </label>
            <label>Graduation years (comma separated)<input value={form.graduationYears} onChange={(e) => change("graduationYears", e.target.value)} /></label>
            <label>Registration deadline<input type="date" value={form.registrationDeadline} onChange={(e) => change("registrationDeadline", e.target.value)} /></label>
            <label>Drive date<input type="date" value={form.driveDate} onChange={(e) => change("driveDate", e.target.value)} /></label>
            <label>Apply link<input type="url" placeholder="https://…" value={form.applyLink} onChange={(e) => change("applyLink", e.target.value)} /></label>
            <label>Status
              <select value={form.status} onChange={(e) => change("status", e.target.value)}>
                <option value="open">Open</option>
                <option value="closed">Closed</option>
              </select>
            </label>
          </div>
          <label className="csv-paste-label">
            Description
            <textarea rows={3} value={form.description} onChange={(e) => change("description", e.target.value)} />
          </label>
          <div className="alumni-actions">
            <button className="btn-primary" type="submit" disabled={busy}>{editingId ? "Save changes" : "Publish drive"}</button>
            {editingId && <button className="btn-secondary" type="button" onClick={reset}>Cancel edit</button>}
          </div>
        </form>

        <div className="admin-card admin-card-wide">
          <h2 className="section-title">Published drives ({drives.length})</h2>
          <div className="table-scroll">
            <table className="company-table admin-table">
              <thead>
                <tr>
                  <th scope="col">Company</th><th scope="col">Role</th><th scope="col">Deadline</th>
                  <th scope="col">Applicants</th><th scope="col">Offers</th><th scope="col">Status</th><th scope="col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {drives.length === 0 ? (
                  <tr><td colSpan={7} className="no-results">No drives published yet.</td></tr>
                ) : drives.map((drive) => (
                  <tr key={drive.id}>
                    <td><strong>{drive.company}</strong></td>
                    <td>{drive.role}</td>
                    <td>{drive.registrationDeadline || "—"}</td>
                    <td>{drive.applicantCount}</td>
                    <td>{drive.offerCount}</td>
                    <td><span className={`status-badge status-${drive.status}`}>{drive.status === "open" ? "Open" : "Closed"}</span></td>
                    <td>
                      <button className="btn-secondary" type="button" disabled={busy} onClick={() => startEdit(drive)}>Edit</button>{" "}
                      <button className="btn-secondary" type="button" disabled={busy} onClick={() => remove(drive)}>Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="drive-hint"><Link to="/drives">View the public drives page →</Link></p>
        </div>
      </div>
    </section>
  );
}
