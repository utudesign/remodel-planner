/** Areas people rate on /feedback — the same order as the handbook. Stable keys. */
export const FEEDBACK_AREAS = [
  { key: "today", label: "Today screen", ask: "Does Today show what you need to do first?" },
  { key: "new_deal", label: "New deal + address", ask: "Is adding a client quick enough?" },
  { key: "texts", label: "Ready-made texts", ask: "Do the texts sound right? Any to add or change?" },
  { key: "visit", label: "Site visit + photos", ask: "Does the visit form match how you measure?" },
  { key: "estimate", label: "Quick estimate (add by code)", ask: "Can you build an estimate fast?" },
  { key: "handoff", label: "Job-ready checklist + Mark sold", ask: "Is everything production needs on the checklist?" },
  { key: "jobs", label: "Jobs timeline + tasks", ask: "Do the 13 job steps match how RenoDesign works?" },
  { key: "kpis", label: "KPIs", ask: "Are these the numbers you want to see?" },
  { key: "overall", label: "Overall", ask: "What should change first?" },
] as const;
export type FeedbackArea = (typeof FEEDBACK_AREAS)[number]["key"];
export const FEEDBACK_KEYS = FEEDBACK_AREAS.map((a) => a.key) as [FeedbackArea, ...FeedbackArea[]];
