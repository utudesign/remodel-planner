import type { NextConfig } from "next";

// cacheComponents is intentionally OFF: every screen is per-user, auth-gated and
// dynamic, so the static-shell model adds Suspense friction with no benefit.
// See docs/DECISIONS.md.
const nextConfig: NextConfig = {
  // Photos from phones (compressed on device to ~1600px) go through server actions.
  experimental: { serverActions: { bodySizeLimit: "12mb" } },
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
