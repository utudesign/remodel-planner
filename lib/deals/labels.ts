import type { DealFolder } from "@/lib/deals/dealNumber";

export const FOLDER_LABEL: Record<DealFolder, string> = {
  photos: "Photos",
  estimates: "Estimates",
  design: "Design",
  contract: "Contract",
  permits: "Permits",
  invoices_receipts: "Invoices & receipts",
  payments: "Payments",
  change_orders: "Change orders",
  warranty: "Warranty",
  other: "Other",
};

/** Folders crew can see (DEALS.md §6). */
export const CREW_FOLDERS: DealFolder[] = ["photos", "design", "permits", "warranty"];

export const PHOTO_TAG_LABEL: Record<string, string> = {
  before: "Before",
  measurement: "Measurement",
  sketch: "Sketch",
  appliance_label: "Appliance label",
  under_sink: "Under sink",
  panel: "Panel",
  delivery: "Delivery",
  progress: "Progress",
  issue: "Issue",
  after: "After",
  other: "Other",
};

export const GATE_LABEL: Record<string, string> = {
  before_order: "Before order",
  before_start: "Before start",
  before_close: "Before close",
};
