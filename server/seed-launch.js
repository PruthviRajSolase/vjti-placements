/*
  Launch seed: creates only the initial TPOI/admin account from env.
  No sample content is inserted.

    npm run seed:launch
*/
import bcrypt from "bcryptjs";
import { db } from "./db.js";

const email = (process.env.TPOI_EMAIL || "tpoi@vjti.ac.in").toLowerCase();
const password = process.env.TPOI_PASSWORD;
const fullName = process.env.TPOI_NAME || "TPO In-Charge";

if (!password || password.length < 8) {
  console.error("TPOI_PASSWORD must be set to at least 8 characters for seed:launch.");
  process.exit(1);
}

const existing = db.prepare("SELECT id FROM users WHERE email = ?").get(email);
const hash = bcrypt.hashSync(password, 10);

if (existing) {
  db.prepare(
    `UPDATE users
     SET full_name = ?, password_hash = ?, role = 'tpoi', email_verified = 1, updated_at = datetime('now')
     WHERE email = ?`
  ).run(fullName, hash, email);
  console.log(`Updated launch TPOI account: ${email}`);
} else {
  db.prepare(
    "INSERT INTO users (full_name, email, password_hash, role, email_verified) VALUES (?, ?, ?, 'tpoi', 1)"
  ).run(fullName, email, hash);
  console.log(`Created launch TPOI account: ${email}`);
}

console.log("Launch seed complete. No sample content was created.");
