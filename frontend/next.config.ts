import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Development only: hosts other than localhost that may load the dev server's /_next resources
  // (HMR). 172.29.112.1 is the Windows host's virtual adapter address seen from WSL/Hyper-V.
  allowedDevOrigins: ["172.29.112.1", "192.168.0.240"],
  // Code shared with the backend (formatting, translations, labels) is plain TypeScript source.
  transpilePackages: ["@fm/shared"],
  // No "X-Powered-By: Next.js": there is no reason to tell visitors what the server runs.
  poweredByHeader: false,
  // Security headers that are the same for every response. The Content Security Policy needs a fresh
  // nonce per page, so proxy.ts sets that one.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          // Old browsers' version of CSP frame-ancestors 'none': the app may not be shown inside a frame.
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
        ],
      },
    ];
  },
  experimental: {
    serverActions: {
      // Statement uploads are capped at 5 MB by the backend; the rest is multipart overhead.
      bodySizeLimit: "6mb",
    },
  },
};

export default nextConfig;
