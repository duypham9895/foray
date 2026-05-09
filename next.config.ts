import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Standalone output for slim Docker production image (see Dockerfile)
  output: "standalone",
};

export default nextConfig;
