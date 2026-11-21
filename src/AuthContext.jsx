/*
  Phase 2 — src/AuthContext.jsx
  Replaces the Step 9 demo auth. The server owns the session (httpOnly
  cookie); this context just remembers the current user in memory and
  exposes signIn / signUp / signOut for components to call.
*/
import { createContext, useContext, useEffect, useState } from "react";
import { api } from "./api.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api("/auth/me")
      .then((data) => setUser(data.user))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  async function signIn(email, password) {
    const data = await api("/auth/login", {
      method: "POST",
      body: { email, password },
    });
    if (data.needsVerification) return data;
    setUser(data.user);
    return data;
  }

  async function signUp(fields) {
    const data = await api("/auth/register", {
      method: "POST",
      body: fields,
    });
    if (data.needsVerification) return data;
    setUser(data.user);
    return data;
  }

  async function verifyEmail(email, code) {
    return api("/auth/verify-email", {
      method: "POST",
      body: { email, code },
    });
  }

  async function resendVerification(email) {
    return api("/auth/resend-verification", {
      method: "POST",
      body: { email },
    });
  }

  async function forgotPassword(email) {
    return api("/auth/forgot-password", {
      method: "POST",
      body: { email },
    });
  }

  async function resetPassword({ email, code, newPassword }) {
    return api("/auth/reset-password", {
      method: "POST",
      body: { email, code, newPassword },
    });
  }

  async function signOut() {
    await api("/auth/logout", { method: "POST" });
    setUser(null);
  }

  // The account page uses this after PUT /api/me so the header name updates
  // immediately without waiting for a page reload.
  function updateUser(nextUser) {
    setUser(nextUser);
  }

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signUp, signOut, updateUser, verifyEmail, resendVerification, forgotPassword, resetPassword }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}
