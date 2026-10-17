import { networkInterfaces } from "node:os";
import type { NextConfig } from "next";

// This machine's own IPv4 addresses (Wi-Fi, Ethernet, WSL/Hyper-V and other virtual adapters). Read at
// start-up rather than written down, as the router may hand out a different one tomorrow.
const ownAddresses = Object.values(networkInterfaces())
  .flat()
  .filter((address) => address?.family === "IPv4" && !address.internal)
  .map((address) => address!.address);

const nextConfig: NextConfig = {
  // Development only: hosts other than localhost that may load the dev server's /_next resources (the
  // page's scripts and hot reload). Without them a page opened from a phone at http://<this machine's
  // IP>:3000 shows up but never becomes interactive.
  allowedDevOrigins: ownAddresses,
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
