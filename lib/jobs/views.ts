/** Job workspace views (shared by the server page and the client tabs; must not live in a "use client" file). */
export type WorkspaceView = "overview" | "list" | "board" | "timeline" | "calendar" | "dashboard";

export const VIEWS: { key: WorkspaceView; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "list", label: "List" },
  { key: "board", label: "Board" },
  { key: "timeline", label: "Timeline" },
  { key: "calendar", label: "Calendar" },
  { key: "dashboard", label: "Dashboard" },
];

export function parseView(v: string | undefined): WorkspaceView {
  return VIEWS.some((x) => x.key === v) ? (v as WorkspaceView) : "list";
}
