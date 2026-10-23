/** Notification kinds a person can mute (More → Notifications). Matrix: CONTEXT §4. */
export const NOTIFY_KINDS = [
  { key: "new_deal", label: "New lead" },
  { key: "assigned", label: "Lead assigned to me" },
  { key: "mention", label: "@mentions and replies" },
  { key: "money", label: "Deposits and payments received" },
  { key: "meeting", label: "Meetings booked or moved" },
  { key: "blocked", label: "Blocked tasks on my jobs" },
  { key: "reminder", label: "Scheduled message reminders" },
  { key: "digest", label: "7:00 AM daily digest" },
] as const;
