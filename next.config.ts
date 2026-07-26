import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // Pin the workspace root so Turbopack doesn't infer it from a nested dir.
  turbopack: { root: path.resolve(process.cwd()) },
  serverExternalPackages: ["node:sqlite"],
  experimental: {
    optimizePackageImports: ["lucide-react"],
  },
};

export default nextConfig;
