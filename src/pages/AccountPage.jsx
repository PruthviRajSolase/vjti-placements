/*
  Phase 6 — AccountPage.jsx
  Signed-in users can fix their display details and change their password.
  Email and role are intentionally shown read-only: neither is accepted by
  PUT /api/me, so this page cannot be used to escalate privileges.
*/
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api.js";
import { BRANCHES } from "../branches.js";
import { useAuth } from "../AuthContext.jsx";

function AccountPage() {
  const { user, updateUser } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState({ fullName: "", branch: "", graduationYear: "" });
  const [passwords, setPasswords] = useState({ current: "", next: "", confirm: "" });
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!user) return;
    setProfile({
      fullName: user.fullName || "",
      branch: user.branch || "",
      graduationYear: user.graduationYear || "",
    });
  }, [user]);

  async function saveProfile(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const data = await api("/me", { method: "PUT", body: profile });
      updateUser(data.user);
      setNotice("Profile updated.");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function changePassword(event) {
    event.preventDefault();
    setError("");
    setNotice("");
    if (passwords.next !== passwords.confirm) {
      setError("The new passwords do not match.");
      return;
    }
    if (passwords.next.length < 8) {
      setError("New password must be at least 8 characters.");
      return;
    }
    setBusy(true);
    try {
      await api("/me/password", {
        method: "POST",
        body: { currentPassword: passwords.current, newPassword: passwords.next },
      });
      setPasswords({ current: "", next: "", confirm: "" });
      setNotice("Password changed — use it next time you sign in.");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }


  async function deleteAccount() {
    setError("");
    setNotice("");
    if (!window.confirm("Delete your account? Your bookmarks and notifications will be removed, and your published experiences will be anonymized. This cannot be undone.")) return;
    setDeleting(true);
    try {
      await api("/me", { method: "DELETE" });
      updateUser(null);
      navigate("/", { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setDeleting(false);
    }
  }
  return (
    <section className="form-page account-page">
      <div className="page-intro">
        <h1 className="page-title">Account settings</h1>
        <p className="section-sub">
          Keep your byline up to date and manage your password.
        </p>
      </div>

      {notice && <p className="form-success" role="status">{notice}</p>}
      {error && <p className="form-error" role="alert">{error}</p>}

      <form className="experience-form account-form" onSubmit={saveProfile}>
        <h2>Your details</h2>
        <label>
          Full name
          <input
            type="text"
            value={profile.fullName}
            maxLength={80}
            onChange={(event) => setProfile({ ...profile, fullName: event.target.value })}
            required
          />
        </label>
        <label>
          Branch
          <select
            value={profile.branch}
            onChange={(event) => setProfile({ ...profile, branch: event.target.value })}
          >
            <option value="">Select a branch</option>
            {BRANCHES.map((item) => (
              <option key={item} value={item}>{item}</option>
            ))}
          </select>
        </label>
        <label>
          Graduation year
          <input
            type="text"
            inputMode="numeric"
            maxLength={4}
            value={profile.graduationYear}
            placeholder="2027"
            onChange={(event) => setProfile({ ...profile, graduationYear: event.target.value })}
          />
        </label>
        <label>
          College email
          <input type="email" value={user?.email || ""} readOnly aria-readonly="true" />
        </label>
        <p className="field-hint">
          Your email and role are managed by the placement office and cannot be changed here.
        </p>
        <button type="submit" className="btn-primary" disabled={busy}>
          {busy ? "Saving…" : "Save details"}
        </button>
      </form>

      <form className="experience-form account-form" onSubmit={changePassword}>
        <h2>Change password</h2>
        <label>
          Current password
          <input
            type="password"
            value={passwords.current}
            autoComplete="current-password"
            onChange={(event) => setPasswords({ ...passwords, current: event.target.value })}
            required
          />
        </label>
        <label>
          New password (at least 8 characters)
          <input
            type="password"
            value={passwords.next}
            minLength={8}
            autoComplete="new-password"
            onChange={(event) => setPasswords({ ...passwords, next: event.target.value })}
            required
          />
        </label>
        <label>
          Confirm new password
          <input
            type="password"
            value={passwords.confirm}
            minLength={8}
            autoComplete="new-password"
            onChange={(event) => setPasswords({ ...passwords, confirm: event.target.value })}
            required
          />
        </label>
        <button type="submit" className="btn-secondary" disabled={busy}>
          {busy ? "Updating…" : "Update password"}
        </button>
      </form>

      <section className="experience-form account-form danger-zone" aria-label="Delete account">
        <h2>Delete my account</h2>
        <p className="field-hint">
          This removes your account, bookmarks, and notifications. Your published experiences will be anonymized and no longer attributed to you.
        </p>
        <button type="button" className="btn-danger" onClick={deleteAccount} disabled={deleting || busy}>
          {deleting ? "Deleting…" : "Delete my account"}
        </button>
      </section>
    </section>
  );
}

export default AccountPage;
