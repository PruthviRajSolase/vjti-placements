/*
  ============================================================
  VJTI PLACEMENTS — STEP 5 (part 1): THE DATA
  ============================================================

  This file contains NO page-building code. It is pure DATA —
  think of it as our tiny "database".

  JS concept tour (read while scrolling):
  - const          → a variable that cannot be reassigned
  - "text"         → a STRING (text)
  - 42, 32.5       → NUMBERS (no quotes!)
  - true/false     → BOOLEANS
  - [a, b, c]      → an ARRAY (an ordered list; items accessed by
                     position: COMPANIES[0] is the first one)
  - { key: value } → an OBJECT (a thing with named properties;
                     access with company.name or company["name"])
  - An ARRAY OF OBJECTS is THE standard way to store lists of
    similar things (companies, products, students...) — you will
    meet this shape in every API and database forever.
  ============================================================
*/

/* The year the site shows by default. */
const CURRENT_YEAR = "2026";

/* ------------------------------------------------------------
   SEASON SUMMARY — one object PER year.
   STATS_BY_YEAR["2026"] gives us that year's object.
   ------------------------------------------------------------ */
const STATS_BY_YEAR = {
  "2024": {
    studentsPlaced: 438,
    highest: "₹48 LPA",
    average: "₹10.8 LPA",
    companies: 74,
  },
  "2025": {
    studentsPlaced: 476,
    highest: "₹54 LPA",
    average: "₹11.6 LPA",
    companies: 81,
  },
  "2026": {
    studentsPlaced: 512,
    highest: "₹58 LPA",
    average: "₹12.4 LPA",
    companies: 87,
  },
};

/* ------------------------------------------------------------
   COMPANIES — an array of objects, one per company visit.
   "branches" is an array of strings INSIDE each object —
   nesting like this is completely normal.
   ------------------------------------------------------------ */
const COMPANIES_BY_YEAR = {
  "2026": [
    { name: "J.P. Morgan Chase & Co.", role: "Software Engineer",         package: 32.5, hired: 14, branches: ["CS", "IT", "Extc"] },
    { name: "Microsoft",               role: "Software Engineer",         package: 51.6, hired: 6,  branches: ["CS", "IT"] },
    { name: "Morgan Stanley",          role: "Technology Analyst",        package: 28.0, hired: 9,  branches: ["CS", "IT"] },
    { name: "Goldman Sachs",           role: "Analyst",                   package: 27.5, hired: 5,  branches: ["CS", "IT", "Extc"] },
    { name: "Cisco Systems",           role: "Software Engineer",         package: 24.5, hired: 8,  branches: ["CS", "IT", "Extc"] },
    { name: "Qualcomm",                role: "Hardware Engineer",         package: 22.0, hired: 7,  branches: ["Extc", "Electrical"] },
    { name: "Tata Consultancy Services", role: "Assistant System Engineer", package: 9.2, hired: 45, branches: ["CS", "IT", "Extc", "Electrical", "Mech", "Civil", "Textile"] },
    { name: "Larsen & Toubro",         role: "Graduate Engineer Trainee", package: 8.5,  hired: 22, branches: ["Mech", "Civil", "Electrical"] },
  ],

  "2025": [
    { name: "Microsoft",               role: "Software Engineer",   package: 48.0, hired: 5,  branches: ["CS", "IT"] },
    { name: "J.P. Morgan Chase & Co.", role: "Software Engineer",   package: 30.0, hired: 11, branches: ["CS", "IT", "Extc"] },
    { name: "Cisco Systems",           role: "Software Engineer",   package: 23.0, hired: 7,  branches: ["CS", "IT", "Extc"] },
    { name: "Tata Consultancy Services", role: "Assistant System Engineer", package: 9.0, hired: 40, branches: ["CS", "IT", "Extc", "Electrical", "Mech", "Civil", "Textile"] },
    { name: "Larsen & Toubro",         role: "Graduate Engineer Trainee", package: 8.0, hired: 18, branches: ["Mech", "Civil", "Electrical"] },
  ],

  "2024": [
    { name: "Microsoft",               role: "Software Engineer",   package: 45.0, hired: 4,  branches: ["CS", "IT"] },
    { name: "Goldman Sachs",           role: "Analyst",             package: 26.0, hired: 6,  branches: ["CS", "IT", "Extc"] },
    { name: "Tata Consultancy Services", role: "Assistant System Engineer", package: 8.8, hired: 38, branches: ["CS", "IT", "Extc", "Electrical", "Mech", "Civil", "Textile"] },
    { name: "Larsen & Toubro",         role: "Graduate Engineer Trainee", package: 7.6, hired: 16, branches: ["Mech", "Civil", "Electrical"] },
  ],
};

/* ------------------------------------------------------------
   BRANCH-WISE placement percentage, per year.
   ------------------------------------------------------------ */
const BRANCH_STATS_BY_YEAR = {
  "2026": [
    { branch: "Computer Engineering",            percent: 96 },
    { branch: "Information Technology",          percent: 94 },
    { branch: "Electronics & Telecommunication", percent: 85 },
    { branch: "Electrical Engineering",          percent: 78 },
    { branch: "Mechanical Engineering",          percent: 74 },
    { branch: "Civil Engineering",               percent: 71 },
    { branch: "Textile Engineering",             percent: 65 },
  ],
  "2025": [
    { branch: "Computer Engineering",            percent: 95 },
    { branch: "Information Technology",          percent: 92 },
    { branch: "Electronics & Telecommunication", percent: 83 },
    { branch: "Electrical Engineering",          percent: 76 },
    { branch: "Mechanical Engineering",          percent: 72 },
    { branch: "Civil Engineering",               percent: 69 },
    { branch: "Textile Engineering",             percent: 63 },
  ],
  "2024": [
    { branch: "Computer Engineering",            percent: 93 },
    { branch: "Information Technology",          percent: 91 },
    { branch: "Electronics & Telecommunication", percent: 81 },
    { branch: "Electrical Engineering",          percent: 74 },
    { branch: "Mechanical Engineering",          percent: 70 },
    { branch: "Civil Engineering",               percent: 67 },
    { branch: "Textile Engineering",             percent: 61 },
  ],
};

/* ------------------------------------------------------------
   INTERVIEW EXPERIENCES — array of objects.
   "tags" is an array of strings; "author" is itself a small
   nested object (name, branch, year) — objects inside objects.
   ------------------------------------------------------------ */
const EXPERIENCES = [
  {
    company: "J.P. Morgan Chase & Co.",
    heading: "J.P. Morgan Chase & Co. — SDE Intern + PPO",
    excerpt:
      "Two rounds: a DSA round (2 medium Leetcode-style questions) and a tech-HR round discussing my resume projects. The interviewers were friendly and pushed me to think aloud...",
    tags: ["DSA", "Resume Projects", "On-campus"],
    author: { name: "Aditya S.", branch: "Computer Engineering", year: "2026" },
  },
  {
    company: "Microsoft",
    heading: "Microsoft — Software Engineer",
    excerpt:
      "Online assessment first (2 coding questions in 90 minutes), then 3 interview rounds focusing on data structures, system design basics and behavioral questions...",
    tags: ["Online Assessment", "3 Rounds", "On-campus"],
    author: { name: "Priya K.", branch: "Information Technology", year: "2026" },
  },
  {
    company: "Larsen & Toubro",
    heading: "Larsen & Toubro — GET (Mechanical)",
    excerpt:
      "Written test on core mechanical concepts followed by a technical interview about manufacturing processes and my B.Tech project on CNC automation...",
    tags: ["Core Mechanical", "Written Test", "On-campus"],
    author: { name: "Rahul M.", branch: "Mechanical Engineering", year: "2026" },
  },
];
