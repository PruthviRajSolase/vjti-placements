/*
  Private application pipeline. Every row is scoped to the signed-in user by
  the API; this page only renders what GET /api/applications returns.
*/
import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { api } from "../api.js";

const STAGES = [
  ["applied", "Applied"],
  ["oa", "Online assessment"],
  ["interview", "Interview"],
  ["offer", "Offer"],
  ["rejected", "Rejected"],
  ["withdrawn", "Withdrawn"],
];

const LABEL = Object.fromEntries(STAGES);

export default function MyApplicationsPage() {
  const location = useLocation();
  const [items, setItems] = useState([]);
  const [drafts, setDrafts] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busyId, setBusyId] = useState(null);

  function load() {
    setLoading(true);
    api("/applications")
      .then((data) => {
        setItems(data.applications);
        setDrafts(Object.fromEntries(data.applications.map((item) => [item.id, { status: item.status, notes: item.notes || "" }])));
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function save(id) {
    setBusyId(id);
    setMessage("");
    setError("");
    try {
      await api(`/applications/${id}`, { method: "PUT", body: drafts[id] });
      setMessage("Application updated.");
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  }

  async function remove(id) {
    if (!window.confirm("Remove this application from your pipeline?")) return;
    setBusyId(id);
    setError("");
    try {
      await api(`/applications/${id}`, { method: "DELETE" });
      setMessage("Application removed.");
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  }

  if (loading) return <p className="page-loading">Loading your applications…</p>;

  const counts = Object.fromEntries(STAGES.map(([key]) => [key, items.filter((i) => i.status === key).length]));

  return (
    <section className="list-page">
      <div className="page-intro">
        <h1 className="page-title">My applications</h1>
        <p className="section-sub">
          A private board for the drives you're pursuing. Move a card as it progresses and
          keep notes for yourself — only you can see them.
        </p>
        <Link className="btn-primary" to="/drives">Browse upcoming drives →</Link>
      </div>

      {location.state?.notice && (
        <p className="admin-message success" role="status">{location.state.notice}</p>
      )}
      {message && <p className="admin-message success" role="status">{message}</p>}
      {error && <p className="form-error" role="alert">{error}</p>}

      {items.length === 0 ? (
        <div className="empty-card">
          <h2>Nothing in your pipeline yet</h2>
          <p>Open an upcoming drive and choose “Track application” to start tracking it.</p>
          <Link className="btn-primary" to="/drives">See upcoming drives</Link>
        </div>
      ) : (
        <div className="pipeline-board">
          {STAGES.filter(([key]) => counts[key] > 0).map(([key, label]) => (
            <section className="pipeline-column" key={key}>
              <h2>{label} <span className="pipeline-count">{counts[key]}</span></h2>
              {items.filter((item) => item.status === key).map((item) => (
                <article className="application-card" key={item.id}>
                  <h3>{item.company}</h3>
                  <p className="application-role">{item.role}</p>
                  <p className="application-meta">
                    {item.package !== null ? `${item.package} LPA · ` : ""}
                    {item.registrationDeadline ? `Closes ${item.registrationDeadline}` : "Deadline TBA"}
                  </p>
                  <label>
                    Stage
                    <select
                      aria-label={`Stage for ${item.company}`}
                      value={drafts[item.id]?.status ?? item.status}
                      onChange={(e) => setDrafts((prev) => ({
                        ...prev, [item.id]: { ...prev[item.id], status: e.target.value },
                      }))}
                    >
                      {STAGES.map(([value, text]) => <option key={value} value={value}>{text}</option>)}
                    </select>
                  </label>
                  <label>
                    Private notes
                    <textarea
                      aria-label={`Notes for ${item.company}`}
                      rows={3}
                      placeholder="Round dates, contacts, what to revise…"
                      value={drafts[item.id]?.notes ?? ""}
                      onChange={(e) => setDrafts((prev) => ({
                        ...prev, [item.id]: { ...prev[item.id], notes: e.target.value },
                      }))}
                    />
                  </label>
                  {item.driveStatus === "closed" && <p className="application-closed">This drive is closed.</p>}
                  <div className="application-actions">
                    <button type="button" className="btn-primary" disabled={busyId === item.id} onClick={() => save(item.id)}>Save</button>
                    <button type="button" className="btn-secondary" disabled={busyId === item.id} onClick={() => remove(item.id)}>Remove</button>
                  </div>
                  {item.applyLink && <a className="application-link" href={item.applyLink} target="_blank" rel="noreferrer">Drive link ↗</a>}
                </article>
              ))}
            </section>
          ))}
        </div>
      )}
      <p className="sr-only">Current stages: {items.map((i) => LABEL[i.status]).join(", ")}</p>
    </section>
  );
}
