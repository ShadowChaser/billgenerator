import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // ✅ This is where ESLint disable should go
  eslint: {
    ignoreDuringBuilds: true,
  },

  async headers() {
    return [
      {
        source: "/pdf.worker.min.js",
        headers: [
          {
            key: "Content-Type",
            value: "application/javascript",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
