import type { NextConfig } from "next";

// cacheComponents is intentionally OFF: every screen is per-user, auth-gated and
// dynamic, so the static-shell model adds Suspense friction with no benefit.
// See docs/DECISIONS.md.
const nextConfig: NextConfig = {
  // Small files go through server actions (Vercel caps a request at 4.5 MB; photos are
  // compressed on the phone). Big photo batches upload straight to Storage (signed URLs).
  experimental: { serverActions: { bodySizeLimit: "4mb" } },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
