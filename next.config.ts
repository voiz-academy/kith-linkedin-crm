import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'export',
  basePath: process.env.NODE_ENV === 'production' ? '/linkedin-crm' : '',
  assetPrefix: process.env.NODE_ENV === 'production' ? '/linkedin-crm/' : '',
  images: {
    unoptimized: true, // Required for static export
  },
  trailingSlash: true,
};

export default nextConfig;
