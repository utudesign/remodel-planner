/** Matches the business_expenses.category check in 0006. */
export const EXPENSE_CATEGORIES = [
  { key: "marketing", label: "Marketing / ads" },
  { key: "phone", label: "Phone" },
  { key: "software", label: "Software" },
  { key: "vehicle", label: "Vehicle (not mileage)" },
  { key: "tools", label: "Tools + measuring" },
  { key: "samples", label: "Samples" },
  { key: "meals", label: "Meals" },
  { key: "office", label: "Office" },
  { key: "license_fees", label: "License fees" },
  { key: "other", label: "Other" },
] as const;

export function expenseLabel(key: string) {
  return EXPENSE_CATEGORIES.find((c) => c.key === key)?.label ?? key;
}
