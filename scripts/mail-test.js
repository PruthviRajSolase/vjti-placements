import { sendMail } from "../server/mailer.js";

const to = process.argv[2];
if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
  console.error("Usage: npm run mail:test -- you@example.com");
  process.exit(1);
}

const result = await sendMail({
  to,
  subject: "VJTI Placements mail test",
  text: [
    "This is a test email from VJTI Placements.",
    "",
    "If you received this, SMTP delivery is configured correctly.",
    `Sent at: ${new Date().toISOString()}`,
  ].join("\n"),
});

if (result.ok) {
  console.log(result.delivered
    ? `Test email sent to ${to}.`
    : `SMTP not configured; test message was logged instead of emailed to ${to}.`);
  process.exit(0);
}

console.error(result.error || "Mail test failed.");
process.exit(1);
