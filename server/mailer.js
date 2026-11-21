import nodemailer from "nodemailer";

const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = Number(process.env.SMTP_PORT || 587);
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const MAIL_FROM = process.env.MAIL_FROM || "VJTI Placements <no-reply@vjti-placements.local>";

const smtpConfigured = Boolean(SMTP_HOST && SMTP_USER && SMTP_PASS);
const useSmtp = process.env.NODE_ENV === "production" && smtpConfigured;

let transporter;
function getTransporter() {
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
  if (!useSmtp) {
    console.log(`[mail:${process.env.NODE_ENV || "dev"}] to=${to} subject="${subject}"\n${text}`);
    return { delivered: false, logged: true };
  }
  await getTransporter().sendMail({ from: MAIL_FROM, to, subject, text });
  return { delivered: true, logged: false };
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
