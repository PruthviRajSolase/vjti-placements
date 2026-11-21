/*
  ============================================================
  src/data.js — shared placement data and slug helpers (ES modules).
  ============================================================
*/

export const CURRENT_YEAR = "2026";

export const STATS_BY_YEAR = {
  "2024": { studentsPlaced: 438, highest: "₹48 LPA", average: "₹10.8 LPA", companies: 74 },
  "2025": { studentsPlaced: 476, highest: "₹54 LPA", average: "₹11.6 LPA", companies: 81 },
  "2026": { studentsPlaced: 512, highest: "₹58 LPA", average: "₹12.4 LPA", companies: 87 },
};

export const COMPANIES_BY_YEAR = {
  "2026": [
    { name: "Summit Bank Group", role: "Software Engineer", package: 32.5, hired: 14, branches: ["CS", "IT", "Extc"] },
    { name: "Northbridge Software", role: "Software Engineer", package: 51.6, hired: 6, branches: ["CS", "IT"] },
    { name: "Crestview Capital", role: "Technology Analyst", package: 28.0, hired: 9, branches: ["CS", "IT"] },
    { name: "Ironvale Partners", role: "Analyst", package: 27.5, hired: 5, branches: ["CS", "IT", "Extc"] },
    { name: "HexaNet Systems", role: "Software Engineer", package: 24.5, hired: 8, branches: ["CS", "IT", "Extc"] },
    { name: "Orion Semiconductor", role: "Hardware Engineer", package: 22.0, hired: 7, branches: ["Extc", "Electrical"] },
    { name: "Asterline Consulting", role: "Assistant System Engineer", package: 9.2, hired: 45, branches: ["CS", "IT", "Extc", "Electrical", "Mech", "Civil", "Textile"] },
    { name: "Keystone Engineering", role: "Graduate Engineer Trainee", package: 8.5, hired: 22, branches: ["Mech", "Civil", "Electrical"] },
  ],
  "2025": [
    { name: "Northbridge Software", role: "Software Engineer", package: 48.0, hired: 5, branches: ["CS", "IT"] },
    { name: "Summit Bank Group", role: "Software Engineer", package: 30.0, hired: 11, branches: ["CS", "IT", "Extc"] },
    { name: "HexaNet Systems", role: "Software Engineer", package: 23.0, hired: 7, branches: ["CS", "IT", "Extc"] },
    { name: "Asterline Consulting", role: "Assistant System Engineer", package: 9.0, hired: 40, branches: ["CS", "IT", "Extc", "Electrical", "Mech", "Civil", "Textile"] },
    { name: "Keystone Engineering", role: "Graduate Engineer Trainee", package: 8.0, hired: 18, branches: ["Mech", "Civil", "Electrical"] },
  ],
  "2024": [
    { name: "Northbridge Software", role: "Software Engineer", package: 45.0, hired: 4, branches: ["CS", "IT"] },
    { name: "Ironvale Partners", role: "Analyst", package: 26.0, hired: 6, branches: ["CS", "IT", "Extc"] },
    { name: "Asterline Consulting", role: "Assistant System Engineer", package: 8.8, hired: 38, branches: ["CS", "IT", "Extc", "Electrical", "Mech", "Civil", "Textile"] },
    { name: "Keystone Engineering", role: "Graduate Engineer Trainee", package: 7.6, hired: 16, branches: ["Mech", "Civil", "Electrical"] },
  ],
};

export const BRANCH_STATS_BY_YEAR = {
  "2026": [
    { branch: "Computer Engineering", percent: 96 },
    { branch: "Information Technology", percent: 94 },
    { branch: "Electronics & Telecommunication", percent: 85 },
    { branch: "Electrical Engineering", percent: 78 },
    { branch: "Mechanical Engineering", percent: 74 },
    { branch: "Civil Engineering", percent: 71 },
    { branch: "Textile Engineering", percent: 65 },
  ],
  "2025": [
    { branch: "Computer Engineering", percent: 95 },
    { branch: "Information Technology", percent: 92 },
    { branch: "Electronics & Telecommunication", percent: 83 },
    { branch: "Electrical Engineering", percent: 76 },
    { branch: "Mechanical Engineering", percent: 72 },
    { branch: "Civil Engineering", percent: 69 },
    { branch: "Textile Engineering", percent: 63 },
  ],
  "2024": [
    { branch: "Computer Engineering", percent: 93 },
    { branch: "Information Technology", percent: 91 },
    { branch: "Electronics & Telecommunication", percent: 81 },
    { branch: "Electrical Engineering", percent: 74 },
    { branch: "Mechanical Engineering", percent: 70 },
    { branch: "Civil Engineering", percent: 67 },
    { branch: "Textile Engineering", percent: 61 },
  ],
};

export const EXPERIENCES = [
  {
    company: "Summit Bank Group",
    heading: "Summit Bank Group — SDE Intern + PPO",
    excerpt:
      "Two rounds: a DSA round (2 medium Leetcode-style questions) and a tech-HR round discussing my resume projects. The interviewers were friendly and pushed me to think aloud, so practising verbally helped more than silent solving.",
    tags: ["DSA", "Resume Projects", "Behavioral", "On-campus"],
    author: { name: "Aditya S.", branch: "Computer Engineering", year: "2026" },
  },
  {
    company: "Northbridge Software",
    heading: "Northbridge Software — Software Engineer",
    excerpt:
      "Online assessment first (2 coding questions in 90 minutes), then 3 interview rounds focusing on data structures, system design basics and behavioral questions. I revised my projects the night before and that paid off.",
    tags: ["Online Assessment", "DSA", "System Design", "Behavioral", "On-campus"],
    author: { name: "Priya K.", branch: "Information Technology", year: "2026" },
  },
  {
    company: "Keystone Engineering",
    heading: "Keystone Engineering — GET (Mechanical)",
    excerpt:
      "Written test on core mechanical concepts followed by a technical interview about manufacturing processes and my B.Tech project on CNC automation. Knowing why I chose each component mattered more than the final result.",
    tags: ["Core Mechanical", "Written Test", "Aptitude", "Resume Projects", "On-campus"],
    author: { name: "Rahul M.", branch: "Mechanical Engineering", year: "2026" },
  },
  {
    company: "HexaNet Systems",
    heading: "HexaNet Systems — Software Engineer",
    excerpt:
      "OA had two DSA questions, then rounds on system design, SQL and behavioural scenarios. Timed mock interviews helped me stay calm and explain trade-offs without jumping straight to code.",
    tags: ["Online Assessment", "DSA", "System Design", "SQL", "Behavioral", "On-campus"],
    author: { name: "Aditya S.", branch: "Computer Engineering", year: "2026" },
  },
  {
    company: "Crestview Capital",
    heading: "Crestview Capital — Technology Analyst",
    excerpt:
      "Aptitude and SQL written test, followed by two technical rounds on OOPS, puzzles and a deep dive into my internship project. The final HR round tested clarity and willingness to learn.",
    tags: ["Aptitude", "SQL", "Resume Projects", "HR Interview", "On-campus"],
    author: { name: "Priya K.", branch: "Information Technology", year: "2026" },
  },
  {
    company: "Ironvale Partners",
    heading: "Ironvale Partners — Analyst",
    excerpt:
      "Written aptitude and puzzle round, followed by a technical interview on DSA basics, SQL joins and a group discussion. My resume projects were the main talking point in every round.",
    tags: ["Aptitude", "Written Test", "DSA", "SQL", "Resume Projects", "Behavioral", "On-campus"],
    author: { name: "Rahul M.", branch: "Mechanical Engineering", year: "2026" },
  },
];

/* ------------------------------------------------------------
   ROUTING HELPERS (Step 8)

   slugify("Summit Bank Group") → "summit_bank_group"
   A "slug" is the URL-safe name of a thing (blogs, docs and the
   reference site all use them). Chain of steps:
     1. lowercase
     2. "&" → "and"
     3. every run of non-alphanumeric chars → ONE underscore
     4. trim underscores off the ends
   A REGEX like /[^a-z0-9]+/g means "any run of 1+ characters
   that are NOT a-z or 0-9, anywhere in the string".
   ------------------------------------------------------------ */
export function slugify(name) {
  return name
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

/* COMPANIES_BY_SLUG: a lookup index built ONCE at startup.
  slug → { year → company entry }

   e.g. COMPANIES_BY_SLUG["northbridge_software"] =
        { "2026": {...}, "2025": {...}, "2024": {...} }

   Building an index like this trades a little memory for fast
   lookups — instead of searching every year's array on every
   page visit, we pay a one-time loop cost at startup.
   ------------------------------------------------------------ */
export const COMPANIES_BY_SLUG = (() => {
  const index = {};
  for (const [year, list] of Object.entries(COMPANIES_BY_YEAR)) {
    for (const company of list) {
      const slug = slugify(company.name);
      if (!index[slug]) {
        index[slug] = {};
      }
      index[slug][year] = company;
    }
  }
  return index;
})();
