/*
  Phase 1 — server/seed.js
  Creates the first TPOI (super admin) if one does not exist yet.

  Run: npm run seed
  Override the dev defaults with environment variables, e.g.:
    TPOI_EMAIL=head@vjti.ac.in TPOI_PASSWORD=... npm run seed
*/
import bcrypt from "bcryptjs";
import { db } from "./db.js";

if (process.env.NODE_ENV === "production") {
  const provided = process.env.TPOI_PASSWORD;
  if (!provided || provided === "ChangeMe123!") {
    console.error("Refusing to seed the default TPOI password in production. Set TPOI_PASSWORD to a strong, non-default value.");
    process.exit(1);
  }
}

const email = (process.env.TPOI_EMAIL || "tpoi@vjti.ac.in").toLowerCase();
const password = process.env.TPOI_PASSWORD || "ChangeMe123!";
const fullName = process.env.TPOI_NAME || "TPO In-Charge";

const existing = db.prepare("SELECT id FROM users WHERE email = ?").get(email);

if (existing) {
  console.log(`TPOI already exists: ${email}`);
} else {
  const hash = bcrypt.hashSync(password, 10);
  db.prepare(
    "INSERT INTO users (full_name, email, password_hash, role, email_verified) VALUES (?, ?, ?, 'tpoi', 1)"
  ).run(fullName, email, hash);
  console.log(`Seeded TPOI account: ${email} / ${password}`);
  console.log("Change this password before any real deployment.");
}
