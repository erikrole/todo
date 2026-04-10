import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Transpile workspace packages (TypeScript source, not pre-compiled)
  transpilePackages: ["@todo/shared", "@todo/db"],
};

export default nextConfig;
