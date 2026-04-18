import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep native addons as external requires so they are never bundled.
  // better-sqlite3 is only used in DEV_DB=sqlite mode; without this,
  // webpack attempts to bundle the native binding and breaks production builds.
  serverExternalPackages: ["better-sqlite3"],
  experimental: {
    // Use system TLS certificates so next/font/google can be fetched
    // in environments where the default node TLS store is incomplete.
    turbopackUseSystemTlsCerts: true,
  },
};

export default nextConfig;
