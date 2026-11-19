/*
  Upcoming drives. Public list with eligibility/deadline filters; signed-in
  students can see which drives they are already tracking.
*/
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api.js";
import { useAuth } from "../AuthContext.jsx";

function daysUntil(value) {
  if (!value) return null;
  const target = Date.parse(`${value}T00:00:00`);
  if (Number.isNaN(target)) return null;
  const today = new Date();
  const start = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((target - start) / 86_400_000);
}

function deadlineLabel(value) {
  const days = daysUntil(value);
  if (days === null) return "Deadline TBA";
  if (days < 0) return `Closed ${Math.abs(days)}d ago`;
  if (days === 0) return "Closes today";
  return `${days} day${days === 1 ? "" : "s"} left`;
}

export default function DrivesPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [drives, setDrives] = useState([]);
  const [tracked, setTracked] = useState([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("open");
  const [onlyMine, setOnlyMine] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState(null);

  useEffect(() => {
    let active = true;
    Promise.all([
      api("/drives"),
      user ? api("/applications").catch(() => ({ applications: [] })) : Promise.resolve({ applications: [] }),
    ])
      .then(([driveData, applicationData]) => {
        if (!active) return;
        setDrives(driveData.drives);
        setTracked(applicationData.applications);
      })
      .catch((err) => active && setError(err.message))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [user]);

  const branches = useMemo(
    () => [...new Set(drives.flatMap((d) => d.eligibilityBranches))].sort(),
    [drives]
  );

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return drives.filter((drive) => {
      if (status !== "all" && drive.status !== status) return false;
      if (onlyMine) {
        const branchOk = drive.eligibilityBranches.length === 0
          || drive.eligibilityBranches.includes(user?.branch);
        const yearOk = drive.graduationYears.length === 0
          || drive.graduationYears.includes(user?.graduationYear);
        if (!branchOk || !yearOk) return false;
      }
      if (!needle) return true;
      return [drive.company, drive.role, drive.location, drive.description, ...drive.eligibilityBranches]
        .some((value) => String(value || "").toLowerCase().includes(needle));
    });
  }, [drives, search, status, onlyMine, user]);

  const trackedIds = new Set(tracked.map((item) => item.driveId));

  async function track(drive) {
    setBusyId(drive.id);
    setError("");
    try {
      await api("/applications", { method: "POST", body: { driveId: drive.id } });
      navigate("/my-applications", {
        state: { notice: `Now tracking ${drive.company}. Move the card forward as it progresses.` },
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  }

  if (loading) return <p className="page-loading">Loading upcoming drives…</p>;

  return (
    <section className="list-page">
      <div className="page-intro">
        <h1 className="page-title">Upcoming drives</h1>
        <p className="section-sub">
          What's open right now, who can apply, and when registrations close. Track the
          drives you care about in your private application pipeline.
        </p>
        <Link className="btn-primary" to="/my-applications">My applications →</Link>
      </div>

      {error && <p className="form-error" role="alert">{error}</p>}

      <div className="drive-filters">
        <input
          type="search" className="search-input"
          placeholder="Search company, role or branch…"
          aria-label="Search drives"
          value={search} onChange={(e) => setSearch(e.target.value)}
        />
        <select aria-label="Drive status" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="open">Open drives</option>
          <option value="closed">Closed drives</option>
          <option value="all">All drives</option>
        </select>
        {user && (
          <label className="drive-mine-toggle">
            <input type="checkbox" checked={onlyMine} onChange={(e) => setOnlyMine(e.target.checked)} />
            Only drives for my batch
          </label>
        )}
        {branches.length > 0 && (
          <p className="drive-branch-hint">Eligible branches: {branches.join(" · ")}</p>
        )}
      </div>

      <p className="result-count">Showing {visible.length} of {drives.length} drives</p>

      {visible.length === 0 ? (
        <div className="empty-card">
          <h2>No drives match</h2>
          <p>Try clearing the filters or check back after the TPO publishes a new drive.</p>
        </div>
      ) : (
        <div className="drive-grid">
          {visible.map((drive) => {
            const days = daysUntil(drive.registrationDeadline);
            const trackedHere = trackedIds.has(drive.id);
            return (
              <article className="drive-card" key={drive.id}>
                <header className="drive-card-head">
                  <div>
                    <h2>{drive.company}</h2>
                    <p className="drive-role">{drive.role}</p>
                  </div>
                  <span className={`drive-deadline${days !== null && days < 3 ? " urgent" : ""}`}>
                    {deadlineLabel(drive.registrationDeadline)}
                  </span>
                </header>

                <ul className="drive-facts">
                  {drive.package !== null && <li><strong>{drive.package} LPA</strong></li>}
                  {drive.location && <li>{drive.location}</li>}
                  {drive.driveDate && <li>Drive: {drive.driveDate}</li>}
                </ul>

                {drive.description && <p className="drive-description">{drive.description}</p>}

                <div className="drive-eligibility">
                  <span>Eligible:</span>
                  {drive.eligibilityBranches.length === 0
                    ? <span className="pill">All branches</span>
                    : drive.eligibilityBranches.map((branch) => <span className="pill" key={branch}>{branch}</span>)}
                  {drive.graduationYears.length === 0
                    ? <span className="pill">All batches</span>
                    : drive.graduationYears.map((year) => <span className="pill" key={year}>{year}</span>)}
                </div>

                <footer className="drive-actions">
                  {drive.applyLink
                    ? <a className="btn-primary" href={drive.applyLink} target="_blank" rel="noreferrer">Apply now ↗</a>
                    : <span className="drive-hint">Application link not published yet</span>}
                  {user ? (
                    trackedHere ? (
                      <Link className="btn-secondary is-tracked" to="/my-applications">Tracking ✓</Link>
                    ) : (
                      <button
                        type="button" className="btn-secondary"
                        disabled={busyId === drive.id}
                        onClick={() => track(drive)}
                      >
                        {busyId === drive.id ? "Tracking…" : "+ Track application"}
                      </button>
                    )
                  ) : (
                    <Link className="btn-secondary" to="/signin" state={{ from: "/drives" }}>
                      Sign in to track
                    </Link>
                  )}
                </footer>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
