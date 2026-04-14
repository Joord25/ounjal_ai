import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 회의 57: 로컬 개발 중 /api/* → Functions 에뮬레이터 프록시 (프로덕션은 Firebase Hosting rewrites가 담당)
  async rewrites() {
    if (process.env.NODE_ENV !== "development") return [];
    return [
      {
        source: "/api/:fn*",
        destination: "http://127.0.0.1:5001/ohunjal/us-central1/:fn*",
      },
    ];
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Cross-Origin-Opener-Policy",
            value: "same-origin-allow-popups",
          },
          {
            key: "Content-Security-Policy",
            value: "upgrade-insecure-requests",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
