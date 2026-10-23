import type { MetadataRoute } from "next";

/** "Add to Home Screen" on iPhone/Android opens the app full-screen on Today. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Remodel Planner",
    short_name: "Remodel",
    description: "Leads, projects, payments and margin for the remodel team.",
    start_url: "/today",
    display: "standalone",
    background_color: "#f7f6f3",
    theme_color: "#2f3a4f",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
