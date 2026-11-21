/*
  Phase 2 — SignInPage.jsx
  Now talks to the REAL API. No more "any password works" demo auth.

  - Sign in: email + password -> POST /api/auth/login
  - Sign up: college email + password -> POST /api/auth/register
  The server sets an httpOnly cookie; AuthContext remembers the returned
  user so the Header and route guards can react immediately.
*/
import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { BRANCHES } from "../branches.js";
import { useAuth } from "../AuthContext.jsx";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function SignInPage() {
  const { user, signIn, signUp, signOut } = useAuth();
  const [mode, setMode] = useState("signin");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [branch, setBranch] = useState("");
  const [graduationYear, setGraduationYear] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from || "/";
  const isSignUp = mode === "signup";

  function switchMode() {
    setMode(isSignUp ? "signin" : "signup");
    setError("");
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");

    const name = fullName.trim();
    const mail = email.trim();
    const college = branch.trim();
    const year = graduationYear.trim();

    if (!EMAIL_PATTERN.test(mail)) {
      setError("Enter a valid email address.");
      return;
    }
    if (!mail.endsWith("@vjti.ac.in")) {
      setError("Use your @vjti.ac.in college email address.");
      return;
    }
    // The 8-character rule is for NEW passwords only. Signing in must send
    // whatever the user typed to the server — the server compares the hash
    // and returns 401 for a mismatch. The seeded TPO password is 7 chars.
    if (isSignUp && password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (isSignUp && !name) {
      setError("Enter your full name.");
      return;
    }

    setSubmitting(true);
    try {
      if (isSignUp) {
        await signUp({
          fullName: name,
          email: mail,
          password,
          branch: college,
          graduationYear: year,
        });
      } else {
        await signIn(mail, password);
      }
      navigate(from, { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (user) {
    return (
      <section className="auth-page">
        <div className="auth-card">
          <h1>You're signed in</h1>
          <p className="auth-sub">
            Signed in as <strong>{user.email}</strong> · role: <strong>{user.role}</strong>
          </p>
          <div className="auth-actions">
            {["tpo", "tpoi"].includes(user.role) && (
              <Link className="btn-primary" to="/admin">Open admin panel</Link>
            )}
            <Link className="btn-primary" to="/">Go to homepage</Link>
            <button type="button" className="btn-signout" onClick={signOut}>
              Sign out
            </button>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="auth-page">
      <div className="auth-card">
        <h1>{isSignUp ? "Create your account" : "Welcome back"}</h1>
        <p className="auth-sub">
          {isSignUp
            ? "Use your VJTI email to join the placement portal."
            : "Sign in with your VJTI email and password."}
        </p>

        <form className="auth-form" onSubmit={handleSubmit} noValidate>
          {isSignUp && (
            <>
              <div className="field">
                <label htmlFor="auth-name">Full name</label>
                <input
                  id="auth-name" type="text" autoComplete="name"
                  placeholder="Asha Patil" value={fullName}
                  onChange={(event) => setFullName(event.target.value)}
                />
              </div>
              <div className="field">
                <label htmlFor="auth-branch">Branch (optional)</label>
                <select
                  id="auth-branch"
                  value={branch}
                  onChange={(event) => setBranch(event.target.value)}
                >
                  <option value="">Select a branch</option>
                  {BRANCHES.map((item) => (
                    <option key={item} value={item}>{item}</option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="auth-year">Graduation year (optional)</label>
                <input
                  id="auth-year" type="text" inputMode="numeric" maxLength={4}
                  placeholder="2027" value={graduationYear}
                  onChange={(event) => setGraduationYear(event.target.value)}
                />
              </div>
            </>
          )}

          <div className="field">
            <label htmlFor="auth-email">College email</label>
            <input
              id="auth-email" type="email" autoComplete="email"
              placeholder="you@vjti.ac.in" value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>

          <div className="field">
            <label htmlFor="auth-password">Password</label>
            <input
              id="auth-password" type="password"
              autoComplete={isSignUp ? "new-password" : "current-password"}
              placeholder="At least 8 characters" value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </div>

          {error && <p className="form-error" role="alert">{error}</p>}

          <button className="btn-primary" type="submit" disabled={submitting}>
            {submitting
              ? "Please wait…"
              : isSignUp ? "Create account" : "Sign in"}
          </button>
        </form>

        <p className="auth-switch">
          {isSignUp ? "Already have an account?" : "New here?"}{" "}
          <button type="button" onClick={switchMode}>
            {isSignUp ? "Sign in instead" : "Create an account"}
          </button>
        </p>

        <div className="demo-accounts">
          <strong>Demo accounts</strong>
          <span>TPO: <code>tpo@vjti.ac.in</code> / <code>Tpo1234!</code></span>
          <span>Student: <code>student@vjti.ac.in</code> / <code>Student123!</code></span>
          <span>Contributor: <code>contributor@vjti.ac.in</code> / <code>Contributor123!</code></span>
          <span>Admin: <code>tpoi@vjti.ac.in</code> / <code>ChangeMe123!</code></span>
        </div>
      </div>
    </section>
  );
}

export default SignInPage;
