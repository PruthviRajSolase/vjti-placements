/*
  Phase 2 — SignInPage.jsx
  Handles sign-in, sign-up, email verification, and password reset.
*/
import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { BRANCHES } from "../branches.js";
import { useAuth } from "../AuthContext.jsx";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function SignInPage() {
  const { user, signIn, signUp, signOut, verifyEmail, resendVerification, forgotPassword, resetPassword } = useAuth();
  const [mode, setMode] = useState("signin");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [branch, setBranch] = useState("");
  const [graduationYear, setGraduationYear] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [verifyEmailAddr, setVerifyEmailAddr] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [newPassword, setNewPassword] = useState("");

  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from || "/";
  const isSignUp = mode === "signup";
  const isVerify = mode === "verify";
  const isForgot = mode === "forgot";
  const isReset = mode === "reset";

  function switchMode(next) {
    setMode(next);
    setError("");
    setInfo("");
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setInfo("");

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
        const data = await signUp({
          fullName: name, email: mail, password, branch: college, graduationYear: year,
        });
        if (data?.needsVerification) {
          setVerifyEmailAddr(data.email || mail);
          setOtpCode("");
          setMode("verify");
          setInfo("We sent a 6-digit verification code to your college email.");
          return;
        }
      } else {
        const data = await signIn(mail, password);
        if (data?.needsVerification) {
          setVerifyEmailAddr(data.email || mail);
          setOtpCode("");
          setMode("verify");
          setInfo("Verify your email to continue.");
          return;
        }
      }
      navigate(from, { replace: true });
    } catch (err) {
      if (err.status === 403 && err.data?.needsVerification) {
        setVerifyEmailAddr(err.data.email || mail);
        setOtpCode("");
        setMode("verify");
        setInfo("Verify your email to continue.");
      } else {
        setError(err.message);
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleVerify(event) {
    event.preventDefault();
    setError(""); setInfo("");
    const code = otpCode.trim();
    if (!/^\d{6}$/.test(code)) { setError("Enter the 6-digit code from your email."); return; }
    setSubmitting(true);
    try {
      await verifyEmail(verifyEmailAddr, code);
      if (password) {
        await signIn(verifyEmailAddr, password);
        navigate(from, { replace: true });
        return;
      }
      setMode("signin");
      setEmail(verifyEmailAddr);
      setInfo("Email verified. Sign in with your password.");
    } catch (err) { setError(err.message); }
    finally { setSubmitting(false); }
  }

  async function handleResend() {
    setError(""); setInfo(""); setSubmitting(true);
    try { await resendVerification(verifyEmailAddr); setInfo("If the account needs verification, a new code was sent."); }
    catch (err) { setError(err.message); }
    finally { setSubmitting(false); }
  }

  async function handleForgot(event) {
    event.preventDefault();
    setError(""); setInfo("");
    const mail = email.trim().toLowerCase();
    if (!mail.endsWith("@vjti.ac.in")) { setError("Use your @vjti.ac.in college email address."); return; }
    setSubmitting(true);
    try {
      await forgotPassword(mail);
      setVerifyEmailAddr(mail);
      setOtpCode("");
      setNewPassword("");
      setMode("reset");
      setInfo("If an account exists for that email, a reset code was sent.");
    } catch (err) { setError(err.message); }
    finally { setSubmitting(false); }
  }

  async function handleReset(event) {
    event.preventDefault();
    setError(""); setInfo("");
    const code = otpCode.trim();
    if (!/^\d{6}$/.test(code)) { setError("Enter the 6-digit code from your email."); return; }
    if (newPassword.length < 8) { setError("Password must be at least 8 characters."); return; }
    setSubmitting(true);
    try {
      await resetPassword({ email: verifyEmailAddr, code, newPassword });
      setMode("signin");
      setEmail(verifyEmailAddr);
      setPassword("");
      setNewPassword("");
      setOtpCode("");
      setInfo("Password reset. Sign in with your new password.");
    } catch (err) { setError(err.message); }
    finally { setSubmitting(false); }
  }

  if (user) {
    return (
      <section className="auth-page">
        <div className="auth-card">
          <h1>You're signed in</h1>
          <p className="auth-sub">Signed in as <strong>{user.email}</strong> — role: <strong>{user.role}</strong></p>
          <div className="auth-actions">
            {["tpo", "tpoi"].includes(user.role) && <Link className="btn-primary" to="/admin">Open admin panel</Link>}
            <Link className="btn-primary" to="/">Go to homepage</Link>
            <button type="button" className="btn-signout" onClick={signOut}>Sign out</button>
          </div>
        </div>
      </section>
    );
  }

  if (isVerify) {
    return (
      <section className="auth-page">
        <div className="auth-card">
          <h1>Verify your email</h1>
          <p className="auth-sub">Enter the 6-digit code sent to <strong>{verifyEmailAddr}</strong>.</p>
          <form className="auth-form" onSubmit={handleVerify} noValidate>
            <div className="field">
              <label htmlFor="verify-code">Verification code</label>
              <input id="verify-code" type="text" inputMode="numeric" autoComplete="one-time-code" maxLength={6}
                placeholder="123456" value={otpCode} onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ""))} />
            </div>
            {error && <p className="form-error" role="alert">{error}</p>}
            {info && <p className="auth-sub" role="status">{info}</p>}
            <button className="btn-primary" type="submit" disabled={submitting}>{submitting ? "Please wait…" : "Verify email"}</button>
          </form>
          <div className="auth-actions" style={{ marginTop: 12 }}>
            <button type="button" className="btn-ghost" onClick={handleResend} disabled={submitting}>Resend code</button>
            <button type="button" className="btn-ghost" onClick={() => switchMode("signin")} disabled={submitting}>Back to sign in</button>
          </div>
        </div>
      </section>
    );
  }

  if (isForgot || isReset) {
    return (
      <section className="auth-page">
        <div className="auth-card">
          <h1>{isForgot ? "Reset your password" : "Set a new password"}</h1>
          <p className="auth-sub">
            {isForgot ? "Enter your college email and we’ll send a reset code if an account exists." : <>Enter the code sent to <strong>{verifyEmailAddr}</strong> and your new password.</>}
          </p>
          <form className="auth-form" onSubmit={isForgot ? handleForgot : handleReset} noValidate>
            {isForgot ? (
              <div className="field">
                <label htmlFor="reset-email">College email</label>
                <input id="reset-email" type="email" autoComplete="email" placeholder="you@vjti.ac.in" value={email}
                  onChange={(e) => setEmail(e.target.value)} />
              </div>
            ) : (
              <>
                <div className="field">
                  <label htmlFor="reset-code">Reset code</label>
                  <input id="reset-code" type="text" inputMode="numeric" autoComplete="one-time-code" maxLength={6}
                    placeholder="123456" value={otpCode} onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ""))} />
                </div>
                <div className="field">
                  <label htmlFor="reset-password">New password</label>
                  <input id="reset-password" type="password" autoComplete="new-password" placeholder="At least 8 characters"
                    value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
                </div>
              </>
            )}
            {error && <p className="form-error" role="alert">{error}</p>}
            {info && <p className="auth-sub" role="status">{info}</p>}
            <button className="btn-primary" type="submit" disabled={submitting}>
              {submitting ? "Please wait…" : isForgot ? "Send reset code" : "Reset password"}
            </button>
          </form>
          <p className="auth-switch">
            <button type="button" onClick={() => switchMode("signin")}>Back to sign in</button>
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="auth-page">
      <div className="auth-card">
        <h1>{isSignUp ? "Create your account" : "Welcome back"}</h1>
        <p className="auth-sub">{isSignUp ? "Use your VJTI email to join the placement portal." : "Sign in with your VJTI email and password."}</p>

        <form className="auth-form" onSubmit={handleSubmit} noValidate>
          {isSignUp && (
            <>
              <div className="field">
                <label htmlFor="auth-name">Full name</label>
                <input id="auth-name" type="text" autoComplete="name" placeholder="Asha Patil" value={fullName}
                  onChange={(e) => setFullName(e.target.value)} />
              </div>
              <div className="field">
                <label htmlFor="auth-branch">Branch (optional)</label>
                <select id="auth-branch" value={branch} onChange={(e) => setBranch(e.target.value)}>
                  <option value="">Select a branch</option>
                  {BRANCHES.map((item) => <option key={item} value={item}>{item}</option>)}
                </select>
              </div>
              <div className="field">
                <label htmlFor="auth-year">Graduation year (optional)</label>
                <input id="auth-year" type="text" inputMode="numeric" maxLength={4} placeholder="2027" value={graduationYear}
                  onChange={(e) => setGraduationYear(e.target.value)} />
              </div>
            </>
          )}

          <div className="field">
            <label htmlFor="auth-email">College email</label>
            <input id="auth-email" type="email" autoComplete="email" placeholder="you@vjti.ac.in" value={email}
              onChange={(e) => setEmail(e.target.value)} />
          </div>

          <div className="field">
            <label htmlFor="auth-password">Password</label>
            <input id="auth-password" type="password" autoComplete={isSignUp ? "new-password" : "current-password"}
              placeholder="At least 8 characters" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>

          {error && <p className="form-error" role="alert">{error}</p>}
          {info && <p className="auth-sub" role="status">{info}</p>}

          <button className="btn-primary" type="submit" disabled={submitting}>
            {submitting ? "Please wait…" : isSignUp ? "Create account" : "Sign in"}
          </button>
        </form>

        {!isSignUp && (
          <p className="auth-switch">
            <button type="button" onClick={() => { setEmail(email); switchMode("forgot"); }}>Forgot password?</button>
          </p>
        )}

        <p className="auth-switch">
          {isSignUp ? "Already have an account?" : "New here?"}{" "}
          <button type="button" onClick={() => switchMode(isSignUp ? "signin" : "signup")}>
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
