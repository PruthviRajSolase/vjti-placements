/*
  Shared tag normalization for experience write-ups and prep insights.
  "One canonical key" means case, whitespace, simple plurals and aliases all
  resolve to the same canonical tag so identical themes count once.
*/
export const CANONICAL_TAGS = [
  "DSA",
  "Online Assessment",
  "System Design",
  "Resume Projects",
  "Behavioral",
  "SQL",
  "Aptitude",
  "Written Test",
  "Core Mechanical",
  "HR Interview",
  "On-campus",
  "3 rounds",
];

const ALIASES = new Map([
  ["oa", "Online Assessment"],
  ["online assessments", "Online Assessment"],
  ["online test", "Online Assessment"],
  ["online tests", "Online Assessment"],
  ["coding test", "Online Assessment"],
  ["coding tests", "Online Assessment"],
  ["data structures", "DSA"],
  ["data structures and algorithms", "DSA"],
  ["data structure and algorithms", "DSA"],
  ["algorithms", "DSA"],
  ["system designs", "System Design"],
  ["resume project", "Resume Projects"],
  ["projects", "Resume Projects"],
  ["project", "Resume Projects"],
  ["behavioural", "Behavioral"],
  ["hr", "HR Interview"],
  ["hr interviews", "HR Interview"],
  ["hr round", "HR Interview"],
  ["hr rounds", "HR Interview"],
  ["aptitude test", "Aptitude"],
  ["aptitude tests", "Aptitude"],
  ["written tests", "Written Test"],
  ["on campus", "On-campus"],
  ["oncampus", "On-campus"],
  ["three rounds", "3 rounds"],
  ["3 round", "3 rounds"],
]);

const CANONICAL_LOOKUP = new Map();
for (const tag of CANONICAL_TAGS) {
  CANONICAL_LOOKUP.set(tag.toLowerCase(), tag);
}

function clean(value) {
  return String(value || "").trim().replace(/\s+/g, " ");
}

function singularize(key) {
  if (key.endsWith("ies") && key.length > 4) return `${key.slice(0, -3)}y`;
  if (key.endsWith("sses") || key.endsWith("ss")) return key;
  if (key.endsWith("s") && key.length > 3) return key.slice(0, -1);
  return key;
}

function titleCaseUnknown(cleaned) {
  return cleaned
    .split(" ")
    .map((word) => {
      if (/^[A-Z0-9]{2,5}$/.test(word)) return word;
      if (/^\d/.test(word)) return word;
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(" ");
}

export function normalizeTag(value) {
  const cleaned = clean(value);
  if (!cleaned) return "";
  const key = cleaned.toLowerCase();
  const direct = CANONICAL_LOOKUP.get(key) || ALIASES.get(key);
  if (direct) return direct;
  const singular = singularize(key);
  const singularMatch = CANONICAL_LOOKUP.get(singular) || ALIASES.get(singular);
  if (singularMatch) return singularMatch;
  return titleCaseUnknown(cleaned);
}

export function normalizeTags(values, limit = 8) {
  const items = Array.isArray(values)
    ? values
    : String(values || "").split(",");
  const seen = new Set();
  const result = [];
  for (const item of items) {
    const tag = normalizeTag(item);
    if (!tag) continue;
    const key = tag.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(tag);
    if (result.length >= limit) break;
  }
  return result;
}
