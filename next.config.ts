import type { NextConfig } from "next";

// cacheComponents is intentionally OFF: every screen is per-user, auth-gated and
// dynamic, so the static-shell model adds Suspense friction with no benefit.
// See docs/DECISIONS.md.
const nextConfig: NextConfig = {
  // Photos from phones (compressed on device to ~1600px) go through server actions.
  experimental: { serverActions: { bodySizeLimit: "30mb" } },
  // "Everything is a deal" (docs/DEALS.md): old lead/project URLs land on the deal jacket.
  async redirects() {
    return [
      { source: "/leads", destination: "/deals", permanent: false },
      { source: "/leads/new", destination: "/deals/new", permanent: false },
      { source: "/leads/:id", destination: "/deal/:id", permanent: false },
      { source: "/projects", destination: "/deals?seg=progress", permanent: false },
      { source: "/projects/:id", destination: "/job/:id", permanent: false },
    ];
  },
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
