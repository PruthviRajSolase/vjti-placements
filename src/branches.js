/*
  Shared VJTI branch list used by registration, profile, drive eligibility and
  server-side validation/normalization. Sourced from the branch statistics data
  already present in the portal (see src/data.js BRANCH_STATS_BY_YEAR).
*/
export const BRANCHES = [
  "Civil Engineering",
  "Computer Engineering",
  "Electrical Engineering",
  "Electronics & Telecommunication",
  "Information Technology",
  "Mechanical Engineering",
  "Textile Engineering",
];

const ALIASES = new Map([
  ["civil", "Civil Engineering"],
  ["civil engineering", "Civil Engineering"],
  ["ce", "Civil Engineering"],
  ["computer engineering", "Computer Engineering"],
  ["comp", "Computer Engineering"],
  ["cs", "Computer Engineering"],
  ["cse", "Computer Engineering"],
  ["electrical engineering", "Electrical Engineering"],
  ["electrical", "Electrical Engineering"],
  ["ee", "Electrical Engineering"],
  ["electronics & telecommunication", "Electronics & Telecommunication"],
  ["electronics and telecommunication", "Electronics & Telecommunication"],
  ["electronics & telecommunication engineering", "Electronics & Telecommunication"],
  ["extc", "Electronics & Telecommunication"],
  ["etc", "Electronics & Telecommunication"],
  ["entc", "Electronics & Telecommunication"],
  ["information technology", "Information Technology"],
  ["it", "Information Technology"],
  ["mechanical engineering", "Mechanical Engineering"],
  ["mechanical", "Mechanical Engineering"],
  ["mech", "Mechanical Engineering"],
  ["textile engineering", "Textile Engineering"],
  ["textile", "Textile Engineering"],
]);

export function normalizeBranch(value) {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  if (!trimmed) return "";
  const exact = BRANCHES.find((branch) => branch.toLowerCase() === trimmed.toLowerCase());
  if (exact) return exact;
  return ALIASES.get(trimmed.toLowerCase()) || trimmed;
}
