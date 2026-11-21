import nodemailer from "nodemailer";

const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = Number(process.env.SMTP_PORT || 587);
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const MAIL_FROM = process.env.MAIL_FROM || "VJTI Placements <no-reply@vjti-placements.local>";

export const smtpConfigured = Boolean(SMTP_HOST && SMTP_USER && SMTP_PASS);
const isProduction = process.env.NODE_ENV === "production";
export const isLaunchProduction = isProduction && process.env.APP_MODE === "launch";

export function smtpStartupIssues() {
  if (isLaunchProduction && !smtpConfigured) {
    return ["SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, and MAIL_FROM must be configured for OTP/reset email delivery."];
  }
  return [];
}

let transporter;
let injectedTransporter;

export function _setTransporterForTest(t) {
  injectedTransporter = t;
}

export function _resetTransporterForTest() {
  injectedTransporter = undefined;
  transporter = undefined;
}

function getTransporter() {
  if (injectedTransporter) return injectedTransporter;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_PORT === 465,
      auth: { user: SMTP_USER, pass: SMTP_PASS },
    });
  }
  return transporter;
}

export async function sendMail({ to, subject, text }) {
  const canSend = smtpConfigured || Boolean(injectedTransporter);
  if (!canSend) {
    // Outside production, log codes for local/dev use. Never log in production.
    if (!isProduction) {
      console.log(`[mail:${process.env.NODE_ENV || "dev"}] to=${to} subject="${subject}"\n${text}`);
      return { ok: true, delivered: false, logged: true };
    }
    return { ok: false, delivered: false, logged: false, error: "Email delivery is not configured." };
  }
  try {
    await getTransporter().sendMail({ from: MAIL_FROM, to, subject, text });
    return { ok: true, delivered: true, logged: false };
  } catch (err) {
    console.error(`[mail] send failed to=${to} subject="${subject}": ${err?.message || "unknown error"}`);
    return { ok: false, delivered: false, logged: false, error: "We couldn't send the email right now. Please try again later." };
  }
}

export async function sendOtpEmail({ to, purpose, code }) {
  const action = purpose === "reset_password" ? "reset your password" : "verify your email";
  const subject = purpose === "reset_password"
    ? "Your VJTI Placements password reset code"
    : "Your VJTI Placements verification code";
  const text = [
    `Use this 6-digit code to ${action}: ${code}`,
    "",
    "This code expires in 10 minutes.",
    "If you did not request this, you can ignore this email.",
  ].join("\n");
  return sendMail({ to, subject, text });
}
