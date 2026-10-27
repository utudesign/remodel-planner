import type { MetadataRoute } from "next";

/** "Add to Home Screen" on iPhone/Android opens the app full-screen on Today. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Kitchen Sales",
    short_name: "Kitchen Sales",
    description: "RenoDesign's kitchen deals and jobs, from the first message to paid in full.",
    start_url: "/today",
    display: "standalone",
    background_color: "#f5f3ee",
    theme_color: "#1f5c46",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
