import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === "production";

const nextConfig: NextConfig = {
  output: "export",
  basePath: isProd ? "/app-rank-checker" : "",
  assetPrefix: isProd ? "/app-rank-checker" : "",
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
