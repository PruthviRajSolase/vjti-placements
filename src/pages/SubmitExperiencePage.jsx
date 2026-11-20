/*
  Phase 3 — SubmitExperiencePage.jsx
  Shared by two routes: /submit (new) and /submit/:id (edit an own pending
  submission). Nothing is published here: the API always stores 'pending'
  and only TPO staff can publish it later.
*/
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../api.js";
import { useAuth } from "../AuthContext.jsx";
import { useContent } from "../ContentContext.jsx";
import { CANONICAL_TAGS } from "../tags.js";

const emptyForm = {
  company: "",
  role: "",
  placementYear: "",
  heading: "",
  body: "",
  tags: "",
  visibility: "named",
};

function SubmitExperiencePage() {
  const { id } = useParams();
  const { user } = useAuth();
  const { refresh } = useContent();
  const navigate = useNavigate();
  const editing = Boolean(id);

  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(editing);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!editing) return;
    api("/experiences/mine")
      .then(({ experiences }) => {
        const found = experiences.find((item) => String(item.id) === String(id));
        if (!found) throw new Error("That submission could not be found.");
        if (!["pending", "changes_requested"].includes(found.status)) {
          throw new Error("This submission has already been reviewed and can no longer be edited.");
        }
        setForm({
          company: found.company,
          role: found.role,
          placementYear: found.placementYear,
          heading: found.heading,
          body: found.body,
          tags: found.tags.join(", "),
          visibility: found.visibility,
        });
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [editing, id]);

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const payload = { ...form, placementYear: form.placementYear.trim() };
      if (editing) {
        await api(`/experiences/${id}`, { method: "PUT", body: payload });
      } else {
        await api("/experiences", { method: "POST", body: payload });
      }
      await refresh();
      navigate("/my-experiences", {
        replace: true,
        state: {
          notice: editing
            ? "Updated and sent back to the TPO for review."
            : "Submitted! The TPO will review it before it appears publicly.",
        },
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <p className="page-loading">Loading your submission…</p>;

  return (
    <section className="form-page">
      <Link className="back-link" to="/my-experiences">← My experiences</Link>
      <h1 className="page-title">
        {editing ? "Update your experience" : "Share your interview experience"}
      </h1>
      <p className="section-sub">
        Signed in as <strong>{user.fullName}</strong>. Your write-up helps juniors prepare —
        it goes to the TPO first, and only approved experiences appear on the public site.
      </p>

      <div className="workflow-strip">
        <span className="workflow-step current">1. You submit</span>
        <span aria-hidden="true">→</span>
        <span className="workflow-step">2. TPO reviews</span>
        <span aria-hidden="true">→</span>
        <span className="workflow-step">3. Published publicly</span>
      </div>

      <form className="experience-form" onSubmit={handleSubmit} noValidate>
        <div className="form-two-col">
          <label>
            Company <span className="required">*</span>
            <input
              type="text" required maxLength={120} placeholder="e.g. Microsoft"
              value={form.company} onChange={(e) => update("company", e.target.value)}
            />
          </label>
          <label>
            Role you interviewed for <span className="required">*</span>
            <input
              type="text" required maxLength={120} placeholder="e.g. Software Engineer"
              value={form.role} onChange={(e) => update("role", e.target.value)}
            />
          </label>
          <label>
            Placement year <span className="required">*</span>
            <input
              type="text" inputMode="numeric" maxLength={4} required placeholder="2026"
              value={form.placementYear}
              onChange={(e) => update("placementYear", e.target.value)}
            />
          </label>
          <label>
            Tags (comma separated)
            <input
              type="text" maxLength={300} list="tag-suggestions"
              placeholder="DSA, System Design, On-campus"
              value={form.tags} onChange={(e) => update("tags", e.target.value)}
            />
            <datalist id="tag-suggestions">
              {CANONICAL_TAGS.map((tag) => <option key={tag} value={tag} />)}
            </datalist>
          </label>
        </div>

        <label>
          Title <span className="required">*</span>
          <input
            type="text" required maxLength={160}
            placeholder="e.g. Microsoft — Software Engineer (2026)"
            value={form.heading} onChange={(e) => update("heading", e.target.value)}
          />
        </label>

        <label>
          What was the process like? <span className="required">*</span>
          <textarea
            rows={8} required minLength={30} maxLength={5000}
            placeholder="Rounds, question types, tips for juniors…"
            value={form.body} onChange={(e) => update("body", e.target.value)}
          />
          <span className="field-help">
            Minimum 30 characters · {form.body.trim().length}/5000
          </span>
        </label>

        <fieldset className="visibility-group">
          <legend>How should your name appear?</legend>
          <div className="choice-grid">
            <label className={`choice-card${form.visibility === "named" ? " selected" : ""}`}>
              <input
                type="radio" name="visibility" value="named"
                checked={form.visibility === "named"}
                onChange={() => update("visibility", "named")}
              />
              <strong>Named</strong>
              <span>Your name and branch appear on the public page.</span>
            </label>
            <label className={`choice-card${form.visibility === "anonymous" ? " selected" : ""}`}>
              <input
                type="radio" name="visibility" value="anonymous"
                checked={form.visibility === "anonymous"}
                onChange={() => update("visibility", "anonymous")}
              />
              <strong>Anonymous</strong>
              <span>Public page shows “Anonymous senior”. The TPO still sees your real name.</span>
            </label>
          </div>
        </fieldset>

        {error && <p className="form-error" role="alert">{error}</p>}

        <div className="form-actions">
          <button className="btn-primary" type="submit" disabled={submitting}>
            {submitting ? "Sending…" : editing ? "Resubmit for review" : "Submit for review"}
          </button>
          <Link className="btn-secondary" to="/my-experiences">Cancel</Link>
        </div>
      </form>
    </section>
  );
}

export default SubmitExperiencePage;
