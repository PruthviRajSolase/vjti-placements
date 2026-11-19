/*
  Phase 11 — server/insights.js
  Turns the tags on APPROVED experiences into ranked preparation advice.

  Input is the already-shaped public experience list from content.js, so no
  real names, emails or staff notes can reach this module. The output is part
  of GET /api/content and is shared by the homepage section and /prep-insights.
*/

// Advice is keyed by the tag seniors actually use when they submit. Unknown
// tags still appear in the ranking with a generic prompt, so a new topic is
// never silently dropped.
const TOPIC_ADVICE = {
  "dsa": {
    category: "Technical",
    advice: "Coding rounds repeatedly test arrays, strings, trees, graphs and dynamic programming. Interviewers care as much about your reasoning as the final answer.",
    action: "Solve two timed problems a day and explain one out loud before the drive.",
  },
  "online assessment": {
    category: "Process",
    advice: "OAs mix coding and aptitude under a strict timer. Most students lose marks by debugging too late rather than by not knowing the concept.",
    action: "Take two full-length mock OAs on a timer and reserve the last 10 minutes for tests.",
  },
  "system design": {
    category: "Technical",
    advice: "For freshers, design rounds stay at the basics: requirements, data storage, caching and trade-offs. A repeatable structure matters more than buzzwords.",
    action: "Whiteboard one small system a day and explain it in five minutes.",
  },
  "resume projects": {
    category: "Project",
    advice: "Interviewers choose one project and dig into every decision. Knowing the stack is not enough — be ready to defend the metric, the trade-off and the bug you fixed.",
    action: "Write a three-line story (problem, choice, result) for each major project.",
  },
  "behavioral": {
    category: "Interview",
    advice: "Conflict, leadership and deadline stories come up across companies. Six well-rehearsed STAR stories can answer most of these questions.",
    action: "Record two STAR answers and ask a peer to challenge them.",
  },
  "behavioural": {
    category: "Interview",
    advice: "Conflict, leadership and deadline stories come up across companies. Six well-rehearsed STAR stories can answer most of these questions.",
    action: "Record two STAR answers and ask a peer to challenge them.",
  },
  "sql": {
    category: "Technical",
    advice: "Analyst and tech roles keep returning to joins, grouping, window functions and NULL behaviour. Speed comes from writing queries by hand, not from reading notes.",
    action: "Practise ten SQL problems without an editor autocomplete.",
  },
  "aptitude": {
    category: "Test",
    advice: "Quant, logic and puzzle questions are usually the first filter. Accuracy under time pressure is the skill, not difficulty of the individual question.",
    action: "Do one 25-minute aptitude set daily and review every mistake.",
  },
  "written test": {
    category: "Test",
    advice: "Written rounds combine core concepts with aptitude. Seniors mention that revising fundamentals beat last-minute new topics.",
    action: "Revise one core subject chapter and take a short mixed test each day.",
  },
  "core mechanical": {
    category: "Core",
    advice: "Core branches are tested on fundamentals and applied examples from manufacturing, thermodynamics or design — often through a project discussion.",
    action: "Prepare one diagram-backed explanation for each core subject you studied.",
  },
  "hr interview": {
    category: "Interview",
    advice: "Final rounds check clarity, honesty and fit. Short, specific answers about why this role and why this company land better than generic enthusiasm.",
    action: "Write and rehearse a 30-second answer to 'Why this company?'",
  },
  "on-campus": {
    category: "Process",
    advice: "On-campus drives move quickly — shortlists and document checks happen the same week. Keep your resume, marksheets and eligibility proof ready before the drive is announced.",
    action: "Keep a single folder with updated resume, ID proof and all semester marksheets.",
    actionable: false,
  },
  "3 rounds": {
    category: "Process",
    advice: "Expect a screening round followed by technical discussions and a final interaction. Energy management across rounds is a real advantage.",
    action: "Sleep properly between rounds and carry water — it is a marathon, not one interview.",
    actionable: false,
  },
};

function adviceFor(tag, count, total) {
  const match = TOPIC_ADVICE[tag.trim().toLowerCase()];
  if (match) return match;
  return {
    category: "Emerging topic",
    advice: `This theme appeared in ${count} of ${total} write-ups. Ask a placed senior what they actually practised before adding hours to it.`,
    action: `Find one approved write-up mentioning ${tag} and mirror its prep plan.`,
    actionable: true,
  };
}

export function buildPrepInsights(experiences = []) {
  const total = experiences.length;
  const byTag = new Map();

  for (const experience of experiences) {
    const tags = [...new Set((experience.tags || [])
      .filter((tag) => typeof tag === "string" && tag.trim())
      .map((tag) => tag.trim()))];

    for (const tag of tags) {
      const key = tag.toLowerCase();
      if (!byTag.has(key)) {
        byTag.set(key, { tag, count: 0, companies: new Set(), experienceIds: [] });
      }
      const entry = byTag.get(key);
      entry.count += 1;
      entry.companies.add(experience.company);
      entry.experienceIds.push(experience.id);
    }
  }

  const topics = [...byTag.values()]
    .map((entry) => {
      const advice = adviceFor(entry.tag, entry.count, total);
      return {
        tag: entry.tag,
        category: advice.category,
        count: entry.count,
        share: total ? Math.round((entry.count / total) * 100) : 0,
        companies: [...entry.companies].sort(),
        experienceIds: entry.experienceIds,
        advice: advice.advice,
        action: advice.action,
        actionable: advice.actionable !== false,
      };
    })
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));

  // A theme is "common" when at least half the write-ups mention it (and at
  // least two do), so a single lucky senior cannot define the advice.
  const commonThreshold = Math.max(2, Math.ceil(total / 2));
  const commonTopics = topics.filter((topic) => topic.count >= commonThreshold);

  const checklist = topics
    .filter((topic) => topic.actionable)
    .slice(0, 5)
    .map((topic) => ({
      tag: topic.tag,
      category: topic.category,
      why: `Mentioned in ${topic.count} of ${total} write-ups`,
      action: topic.action,
      companies: topic.companies,
      experienceIds: topic.experienceIds,
    }));

  return {
    totalExperiences: total,
    topicCount: topics.length,
    commonCount: commonTopics.length,
    topics,
    commonTopics,
    checklist,
  };
}
