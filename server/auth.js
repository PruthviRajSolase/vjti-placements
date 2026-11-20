/*
  Phase 1 — server/auth.js
  Authentication = "who are you?"   (JWT in an httpOnly cookie)
  Authorisation  = "may you do this?" (requireRole middleware)

  The token contains only the user id. On EVERY request we reload the
  user from the database, so if the TPOI revokes someone's role it takes
  effect immediately — no waiting for a token to expire.
*/
import jwt from "jsonwebtoken";
import { findUserById, publicUser } from "./db.js";

const configuredSecret = process.env.JWT_SECRET;
if (process.env.NODE_ENV === "production" && (!configuredSecret || configuredSecret.length < 32)) {
  throw new Error("JWT_SECRET must be set to at least 32 characters in production.");
}

export const JWT_SECRET = configuredSecret || "dev-only-change-me";
export const TOKEN_COOKIE = "vjti_token";

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export function setAuthCookie(res, user) {
  const token = jwt.sign({ sub: user.id }, JWT_SECRET, { expiresIn: "7d" });
  res.cookie(TOKEN_COOKIE, token, {
    httpOnly: true, // JavaScript cannot read it -> XSS can't steal the session
    sameSite: "lax", // basic CSRF protection: cookie not sent on cross-site POSTs
    secure: process.env.NODE_ENV === "production", // HTTPS only in production
    maxAge: SEVEN_DAYS_MS,
    path: "/",
  });
}

export function clearAuthCookie(res) {
  res.clearCookie(TOKEN_COOKIE, { path: "/" });
}

function userFromRequest(req) {
  const token = req.cookies?.[TOKEN_COOKIE];
  if (!token) return null;
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    return publicUser(findUserById(payload.sub));
  } catch {
    return null;
  }
}

// Attaches req.user when a valid session exists, but never blocks.
export function optionalAuth(req, _res, next) {
  req.user = userFromRequest(req);
  next();
}

export function requireAuth(req, res, next) {
  const user = userFromRequest(req);
  if (!user) {
    return res.status(401).json({ error: "Please sign in to continue." });
  }
  req.user = user;
  next();
}

// Usage: requireAuth, requireRole("tpo", "tpoi")
export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: "Please sign in to continue." });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: "You do not have permission for this action." });
    }
    next();
  };
}
