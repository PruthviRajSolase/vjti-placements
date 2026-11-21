/*
  Alumni outreach (TPO-initiated).
  TPO imports past placed-student/alumni contacts and reaches out by email
  asking them to help bring their current company for placement/internship
  campus drives. This page supports CSV import, outreach templates (mailto/
  copy), and tracking responses/referrals.
*/
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api.js";
import { useAuth } from "../AuthContext.jsx";

const STATUS_OPTIONS = [
  ["not_contacted", "Not contacted"],
  ["contacted", "Contacted"],
  ["responded", "Responded"],
  ["interested", "Interested"],
  ["referred", "Referred"],
  ["not_interested", "Not interested"],
  ["no_response", "No response"],
];

const STATUS_LABEL = Object.fromEntries(STATUS_OPTIONS);

const TYPE_OPTIONS = [
  ["", "—"],
  ["placement", "Placement"],
  ["internship", "Internship"],
  ["both", "Placement + Internship"],
];

const TEMPLATES = {
  placement: {
    label: "Placement drive",
    subject: "Invitation to participate in VJTI {drive_label} campus drive",
    body: `Dear {name},

Greetings from the Training & Placement Office, VJTI.

We are reaching out to you as a {placed_company} alum ({grad_year} batch{branch_note}) and would really value your support. We would like to invite {company_target} to participate in our upcoming campus placement drive.

If possible, could you help us by connecting us with your HR/campus recruiting team, or by sharing the right contact person? Even a brief introduction or forwarding this message internally would be a big help.

We would be happy to share the placement brochure, student profiles, and schedule at your convenience.

Thank you for supporting VJTI students.

Warm regards,
TPO Office
VJTI, Mumbai`,
  },
  internship: {
    label: "Internship drive",
    subject: "Invitation to offer internships to VJTI students",
    body: `Dear {name},

Greetings from the Training & Placement Office, VJTI.

As a {placed_company} alum from the {grad_year} batch{branch_note}, we hope you might be able to help us connect with {company_target} for internship opportunities for our students.

If you could introduce us to the relevant recruiter/manager or share a contact, it would greatly help us explore an internship drive or openings with your team.

We can share student profiles, timelines, and any details your team may need.

Thank you for your time and support.

Warm regards,
TPO Office
VJTI, Mumbai`,
  },
  both: {
    label: "Placement + internship",
    subject: "VJTI campus placement & internship opportunity",
    body: `Dear {name},

Greetings from the Training & Placement Office, VJTI.

We are contacting you as a {placed_company} alum ({grad_year} batch{branch_note}) to seek your support in connecting VJTI with {company_target} for campus placement and/or internship opportunities.

Could you help us reach the appropriate HR or campus recruiting contact, or forward this note to the right team? We would be glad to share our brochure and coordinate based on your company's hiring plans.

Thank you for helping current VJTI students.

Warm regards,
TPO Office
VJTI, Mumbai`,
  },
};

function fillTemplate(text, person, driveKey) {
  const driveLabel =
    driveKey === "internship" ? "internship"
      : driveKey === "both" ? "placement & internship"
        : "placement";
  const branchNote = person.branch ? `, ${person.branch}` : "";
  const companyTarget = person.currentCompany || person.placedCompany || "your company";
  const map = {
    "{name}": person.fullName || "there",
    "{email}": person.email || "",
    "{branch}": person.branch || "",
    "{grad_year}": person.graduationYear || person.placedYear || "",
    "{placed_company}": person.placedCompany || "your",
    "{placed_role}": person.placedRole || "",
    "{placed_year}": person.placedYear || "",
    "{current_company}": person.currentCompany || "",
    "{company_target}": companyTarget,
    "{branch_note}": branchNote,
    "{drive_label}": driveLabel,
  };
  let out = text || "";
  for (const [key, value] of Object.entries(map)) out = out.split(key).join(value);
  return out;
}

function todayLocalInput() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function toDbDateTime(localValue) {
  if (!localValue) return null;
  // datetime-local gives YYYY-MM-DDTHH:mm; store as YYYY-MM-DD HH:mm:00
  return localValue.replace("T", " ") + (localValue.length === 16 ? ":00" : "");
}

function toLocalInput(dbValue) {
  if (!dbValue) return "";
  // "YYYY-MM-DD HH:MM:SS" -> "YYYY-MM-DDTHH:MM"
  return String(dbValue).replace(" ", "T").slice(0, 16);
}

export default function AdminAlumniPage() {
  const { user } = useAuth();
  const [alumni, setAlumni] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState(null);
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [csvText, setCsvText] = useState("");
  const [csvFileName, setCsvFileName] = useState("");

  const [selectedId, setSelectedId] = useState(null);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [bulkStatus, setBulkStatus] = useState("");
  const [bulkType, setBulkType] = useState("");
  const [bulkFollowUp, setBulkFollowUp] = useState("");
  const [driveKey, setDriveKey] = useState("placement");
  const [subject, setSubject] = useState(TEMPLATES.placement.subject);
  const [body, setBody] = useState(TEMPLATES.placement.body);
  const [edit, setEdit] = useState(null);

  const load = useCallback(async () => {
    const data = await api("/admin/alumni");
    setAlumni(data.alumni || []);
  }, []);

  useEffect(() => {
    load()
      .catch((err) => setMessage({ type: "error", text: err.message }))
      .finally(() => setLoading(false));
  }, [load]);

  const selected = useMemo(
    () => alumni.find((a) => a.id === selectedId) || null,
    [alumni, selectedId]
  );

  useEffect(() => {
    if (selected) {
      setEdit({
        outreachStatus: selected.outreachStatus || "not_contacted",
        outreachType: selected.outreachType || "",
        lastContactedAt: toLocalInput(selected.lastContactedAt),
        followUpAt: toLocalInput(selected.followUpAt),
        currentCompany: selected.currentCompany || "",
        responseNote: selected.responseNote || "",
        referralCompany: selected.referralCompany || "",
        referralContact: selected.referralContact || "",
        referralDetails: selected.referralDetails || "",
      });
    } else {
      setEdit(null);
    }
  }, [selected]);

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return alumni.filter((a) => {
      if (statusFilter !== "all" && a.outreachStatus !== statusFilter) return false;
      if (!needle) return true;
      return [
        a.fullName, a.email, a.branch, a.graduationYear, a.placedCompany,
        a.placedRole, a.currentCompany, a.referralCompany,
      ].some((v) => String(v || "").toLowerCase().includes(needle));
    });
  }, [alumni, search, statusFilter]);

  const counts = useMemo(() => {
    const c = { all: alumni.length };
    for (const [key] of STATUS_OPTIONS) c[key] = alumni.filter((a) => a.outreachStatus === key).length;
    return c;
  }, [alumni]);

  const visibleIds = useMemo(() => visible.map((a) => a.id), [visible]);
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.has(id));
  const someVisibleSelected = visibleIds.some((id) => selectedIds.has(id));
  const selectedCount = selectedIds.size;

  function toggleSelect(id) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleSelectAllVisible() {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) {
        for (const id of visibleIds) next.delete(id);
      } else {
        for (const id of visibleIds) next.add(id);
      }
      return next;
    });
  }

  function clearSelection() {
    setSelectedIds(new Set());
  }

  async function copySelectedEmails() {
    const emails = alumni
      .filter((a) => selectedIds.has(a.id))
      .map((a) => a.email)
      .filter(Boolean);
    if (emails.length === 0) {
      setMessage({ type: "error", text: "No selected contacts with emails." });
      return;
    }
    await copyText(emails.join(", "), `${emails.length} email(s)`);
  }

  async function applyBulk(markContacted = false) {
    const ids = [...selectedIds];
    if (ids.length === 0) {
      setMessage({ type: "error", text: "Select at least one contact." });
      return;
    }
    const payload = { ids };
    if (markContacted) {
      payload.markContacted = true;
      if (bulkType) payload.outreachType = bulkType;
    } else {
      if (bulkStatus) payload.outreachStatus = bulkStatus;
      if (bulkType !== "") payload.outreachType = bulkType;
      if (bulkFollowUp) payload.followUpAt = toDbDateTime(bulkFollowUp);
      if (!bulkStatus && bulkType === "" && !bulkFollowUp) {
        setMessage({ type: "error", text: "Choose a status, type, or follow-up to apply (or use Mark contacted)." });
        return;
      }
    }

    setBusy(true);
    setMessage(null);
    try {
      const result = await api("/admin/alumni/bulk", { method: "PUT", body: payload });
      await load();
      setMessage({
        type: "success",
        text: markContacted
          ? `Marked ${result.updated} contact(s) as contacted.`
          : `Updated ${result.updated} contact(s).`,
      });
      if (markContacted) setBulkType(bulkType);
    } catch (err) {
      setMessage({ type: "error", text: err.message });
    } finally {
      setBusy(false);
    }
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
      const result = await api("/admin/alumni/import", {
        method: "POST",
        body: { csv: csvText },
      });
      await load();
      setMessage({
        type: "success",
        text: `Imported ${result.imported} contact(s): ${result.created} new, ${result.updated} updated.`,
      });
      setCsvText("");
      setCsvFileName("");
    } catch (err) {
      setMessage({ type: "error", text: err.message, details: err.details });
    } finally {
      setBusy(false);
    }
  }

  function applyTemplate(key) {
    setDriveKey(key);
    setSubject(TEMPLATES[key].subject);
    setBody(TEMPLATES[key].body);
  }

  const previewSubject = selected ? fillTemplate(subject, selected, driveKey) : "";
  const previewBody = selected ? fillTemplate(body, selected, driveKey) : "";

  async function copyText(text, label) {
    try {
      await navigator.clipboard.writeText(text);
      setMessage({ type: "success", text: `${label} copied.` });
    } catch {
      setMessage({ type: "error", text: `Couldn't copy ${label.toLowerCase()} automatically.` });
    }
  }

  function openMailto() {
    if (!selected) return;
    const href = `mailto:${encodeURIComponent(selected.email)}?subject=${encodeURIComponent(previewSubject)}&body=${encodeURIComponent(previewBody)}`;
    window.location.href = href;
  }

  async function saveEdit(markContacted = false) {
    if (!selected || !edit) return;
    setBusy(true);
    setMessage(null);
    const payload = {
      ...edit,
      followUpAt: toDbDateTime(edit.followUpAt),
      lastContactedAt: toDbDateTime(edit.lastContactedAt),
    };
    if (markContacted) {
      payload.outreachStatus = payload.outreachStatus === "not_contacted" ? "contacted" : payload.outreachStatus;
      payload.lastContactedAt = toDbDateTime(todayLocalInput());
      payload.outreachType = payload.outreachType || driveKey;
      setEdit((e) => ({
        ...e,
        outreachStatus: e.outreachStatus === "not_contacted" ? "contacted" : e.outreachStatus,
        lastContactedAt: todayLocalInput(),
        outreachType: e.outreachType || driveKey,
      }));
    }
    try {
      await api(`/admin/alumni/${selected.id}`, { method: "PUT", body: payload });
      await load();
      setMessage({ type: "success", text: markContacted ? "Outreach marked as contacted." : "Alumni outreach updated." });
    } catch (err) {
      setMessage({ type: "error", text: err.message });
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <p className="page-loading">Loading alumni contacts…</p>;

  return (
    <section className="admin-page">
      <div className="page-intro">
        <Link className="back-link" to="/admin">← Admin</Link>
        <h1 className="page-title">Alumni outreach</h1>
        <p className="section-sub">
          TPO-initiated outreach: contact previously placed alumni and ask them to help
          bring their current company for <strong>placement</strong> or <strong>internship</strong> campus drives.
          Signed in as <strong>{user.fullName}</strong>.
        </p>
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

      <div className="admin-grid">
        <form className="admin-card admin-card-wide csv-import-card" onSubmit={importCsv}>
          <h2 className="section-title">Import alumni contacts (CSV)</h2>
          <p className="section-sub">
            Upload the TPO’s list of previously placed students/alumni. Re-importing
            the same email updates contact details but keeps outreach status/notes.
          </p>
          <p className="csv-format">
            Required: <code>full_name,email</code>. Optional: <code>phone,branch,graduation_year,placed_company,placed_role,placed_year,current_company</code>.
          </p>
          <div className="csv-controls">
            <label className="csv-file-label">
              Choose .csv file
              <input type="file" accept=".csv,text/csv" aria-label="Choose alumni CSV file" onChange={chooseCsv} />
            </label>
            {csvFileName && <span className="csv-file-name">{csvFileName}</span>}
          </div>
          <label className="csv-paste-label">
            Or paste CSV rows
            <textarea
              aria-label="Paste alumni CSV"
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
              rows={4}
              placeholder={'full_name,email,branch,graduation_year,placed_company,placed_role,placed_year,current_company\nNeha Kulkarni,neha@example.com,Computer Engineering,2022,Northbridge Software,SDE,2022,Northbridge Software'}
            />
          </label>
          <button className="btn-primary admin-submit" type="submit" disabled={busy}>Import contacts</button>
        </form>

        <div className="admin-card admin-card-wide">
          <h2 className="section-title">Outreach composer</h2>
          <p className="section-sub">
            Pick an alumni contact from the list, personalize the message, then send via your mail client
            (mailto) or copy it. Mark as contacted to track progress.
          </p>
          <div className="alumni-template-bar">
            <span>Template:</span>
            {Object.entries(TEMPLATES).map(([key, t]) => (
              <button key={key} type="button" className={`pill ${driveKey === key ? "active" : ""}`} onClick={() => applyTemplate(key)}>
                {t.label}
              </button>
            ))}
          </div>
          {!selected ? (
            <p className="empty-state-compact">Select a contact below to preview and send an email.</p>
          ) : (
            <div className="alumni-composer">
              <p className="section-sub"><strong>To:</strong> {selected.fullName} &lt;{selected.email}&gt;</p>
              <label>
                Subject
                <input type="text" value={subject} onChange={(e) => setSubject(e.target.value)} />
              </label>
              <label>
                Message
                <textarea rows={10} value={body} onChange={(e) => setBody(e.target.value)} />
              </label>
              <div className="alumni-actions">
                <button type="button" className="btn-primary" onClick={openMailto}>Open in mail app</button>
                <button type="button" className="btn-secondary" onClick={() => copyText(previewSubject, "Subject")}>Copy subject</button>
                <button type="button" className="btn-secondary" onClick={() => copyText(previewBody, "Message")}>Copy message</button>
                <button type="button" className="btn-secondary" onClick={() => copyText(selected.email, "Email")}>Copy email</button>
                <button type="button" className="btn-secondary" onClick={() => saveEdit(true)} disabled={busy}>Mark contacted now</button>
              </div>
              <details className="alumni-preview">
                <summary>Preview personalized message</summary>
                <p><strong>Subject:</strong> {previewSubject}</p>
                <pre>{previewBody}</pre>
              </details>
            </div>
          )}
        </div>

        <div className="admin-card admin-card-wide">
          <h2 className="section-title">Contacts &amp; responses ({visible.length})</h2>
          <div className="alumni-filters">
            <input
              type="search" className="search-input" placeholder="Search name, email, company, branch…"
              value={search} onChange={(e) => setSearch(e.target.value)}
            />
            <div className="alumni-status-pills">
              <button type="button" className={`pill ${statusFilter === "all" ? "active" : ""}`} onClick={() => setStatusFilter("all")}>
                All ({counts.all || 0})
              </button>
              {STATUS_OPTIONS.map(([key, label]) => (
                <button key={key} type="button" className={`pill ${statusFilter === key ? "active" : ""}`} onClick={() => setStatusFilter(key)}>
                  {label} ({counts[key] || 0})
                </button>
              ))}
            </div>
          </div>

          <div className={`alumni-bulk-bar${selectedCount > 0 ? " alumni-bulk-bar-active" : ""}`} role="group" aria-label="Bulk actions">
            <div className="alumni-bulk-summary">
              <span className="alumni-bulk-count"><strong>{selectedCount}</strong> selected</span>
              <button type="button" className="btn-secondary" onClick={toggleSelectAllVisible} disabled={visible.length === 0}>
                {allVisibleSelected ? "Unselect visible" : "Select all visible"}
              </button>
              <button type="button" className="btn-secondary" onClick={clearSelection} disabled={selectedCount === 0}>Clear</button>
              <button type="button" className="btn-secondary" onClick={copySelectedEmails} disabled={selectedCount === 0}>Copy emails</button>
            </div>
            <div className="alumni-bulk-controls">
              <label>
                <span className="sr-only">Bulk status</span>
                <select value={bulkStatus} onChange={(e) => setBulkStatus(e.target.value)} aria-label="Bulk status">
                  <option value="">Set status…</option>
                  {STATUS_OPTIONS.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
                </select>
              </label>
              <label>
                <span className="sr-only">Bulk outreach type</span>
                <select value={bulkType} onChange={(e) => setBulkType(e.target.value)} aria-label="Bulk outreach type">
                  <option value="">Set type…</option>
                  {TYPE_OPTIONS.filter(([k]) => k).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
                </select>
              </label>
              <label>
                <span className="sr-only">Bulk follow-up</span>
                <input type="datetime-local" value={bulkFollowUp} onChange={(e) => setBulkFollowUp(e.target.value)} aria-label="Bulk follow-up date" />
              </label>
              <button type="button" className="btn-secondary" onClick={() => applyBulk(false)} disabled={busy || selectedCount === 0}>Apply to selected</button>
              <button type="button" className="btn-primary" onClick={() => applyBulk(true)} disabled={busy || selectedCount === 0}>Mark contacted now</button>
            </div>
          </div>

          <div className="table-scroll">
            <table className="company-table admin-table alumni-table">
              <thead>
                <tr>
                  <th scope="col">
                    <input
                      type="checkbox"
                      aria-label="Select all visible contacts"
                      checked={allVisibleSelected}
                      ref={(el) => { if (el) el.indeterminate = !allVisibleSelected && someVisibleSelected; }}
                      onChange={toggleSelectAllVisible}
                    />
                  </th>
                  <th scope="col">Alumni</th>
                  <th scope="col">Batch / Placed at</th>
                  <th scope="col">Current company</th>
                  <th scope="col">Status</th>
                  <th scope="col">Referral / Notes</th>
                  <th scope="col">Action</th>
                </tr>
              </thead>
              <tbody>
                {visible.length === 0 ? (
                  <tr><td colSpan={7} className="no-results">No alumni contacts match.</td></tr>
                ) : (
                  visible.map((a) => (
                    <tr key={a.id} className={selectedId === a.id ? "alumni-row-selected" : ""}>
                      <td>
                        <input
                          type="checkbox"
                          aria-label={`Select ${a.fullName}`}
                          checked={selectedIds.has(a.id)}
                          onChange={() => toggleSelect(a.id)}
                        />
                      </td>
                      <td>
                        <strong>{a.fullName}</strong><br />
                        <small>{a.email}</small>
                        {a.phone ? <><br /><small>{a.phone}</small></> : null}
                      </td>
                      <td>
                        <small>{a.graduationYear || "—"} {a.branch ? `· ${a.branch}` : ""}</small><br />
                        <small>{a.placedCompany || "—"}{a.placedRole ? ` · ${a.placedRole}` : ""}{a.placedYear ? ` (${a.placedYear})` : ""}</small>
                      </td>
                      <td>{a.currentCompany || "—"}</td>
                      <td>
                        <span className={`status-badge status-${a.outreachStatus}`}>{STATUS_LABEL[a.outreachStatus] || a.outreachStatus}</span><br />
                        <small>{a.outreachType ? TYPE_OPTIONS.find((o) => o[0] === a.outreachType)?.[1] : ""}</small>
                        {a.lastContactedAt ? <><br /><small>Last: {a.lastContactedAt.slice(0, 10)}</small></> : null}
                      </td>
                      <td>
                        {a.referralCompany ? <><strong>{a.referralCompany}</strong><br /></> : null}
                        {a.referralContact ? <><small>{a.referralContact}</small><br /></> : null}
                        <small>{a.responseNote || a.referralDetails || "—"}</small>
                      </td>
                      <td>
                        <button type="button" className="btn-secondary" onClick={() => setSelectedId(a.id)}>
                          {selectedId === a.id ? "Selected" : "Select"}
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {selected && edit && (
            <form
              className="alumni-edit-card"
              onSubmit={(e) => { e.preventDefault(); saveEdit(false); }}
            >
              <h3>Update outreach: {selected.fullName}</h3>
              <div className="admin-fields">
                <label>
                  Status
                  <select value={edit.outreachStatus} onChange={(e) => setEdit({ ...edit, outreachStatus: e.target.value })}>
                    {STATUS_OPTIONS.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
                  </select>
                </label>
                <label>
                  Drive type
                  <select value={edit.outreachType} onChange={(e) => setEdit({ ...edit, outreachType: e.target.value })}>
                    {TYPE_OPTIONS.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
                  </select>
                </label>
                <label>
                  Last contacted
                  <input type="datetime-local" value={edit.lastContactedAt} onChange={(e) => setEdit({ ...edit, lastContactedAt: e.target.value })} />
                </label>
                <label>
                  Follow-up
                  <input type="datetime-local" value={edit.followUpAt} onChange={(e) => setEdit({ ...edit, followUpAt: e.target.value })} />
                </label>
                <label>
                  Current company
                  <input type="text" value={edit.currentCompany} onChange={(e) => setEdit({ ...edit, currentCompany: e.target.value })} />
                </label>
                <label>
                  Referral company
                  <input type="text" value={edit.referralCompany} onChange={(e) => setEdit({ ...edit, referralCompany: e.target.value })} placeholder="Company alumni can help bring" />
                </label>
                <label>
                  Referral contact
                  <input type="text" value={edit.referralContact} onChange={(e) => setEdit({ ...edit, referralContact: e.target.value })} placeholder="HR/recruiter name, email, etc." />
                </label>
              </div>
              <label className="csv-paste-label">
                Response / notes
                <textarea rows={3} value={edit.responseNote} onChange={(e) => setEdit({ ...edit, responseNote: e.target.value })} placeholder="What did the alumni say? Any intro offered?" />
              </label>
              <label className="csv-paste-label">
                Referral details
                <textarea rows={3} value={edit.referralDetails} onChange={(e) => setEdit({ ...edit, referralDetails: e.target.value })} placeholder="Role/season, hiring plan, next steps…" />
              </label>
              <div className="alumni-actions">
                <button className="btn-primary" type="submit" disabled={busy}>Save outreach update</button>
                <button type="button" className="btn-secondary" onClick={() => saveEdit(true)} disabled={busy}>Mark contacted now</button>
              </div>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}
