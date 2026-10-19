import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { parseEnv } from "node:util";
import type { CapacitorConfig } from "@capacitor/cli";
import { lanAddresses } from "../scripts/network.mjs";

// The app is a native shell around the Next.js site: it opens the site's address, so every change to the
// site reaches the app without a new build. The address is fixed when "npm run mobile:sync" runs:
// MOBILE_SERVER_URL from the environment or the project's .env, otherwise this machine's address on the
// local network with the dev server's port. The Capacitor CLI runs this file from the mobile/ folder.

function serverUrl() {
  const env = existsSync("../.env") ? parseEnv(readFileSync("../.env", "utf8")) : {};
  const configured = process.env.MOBILE_SERVER_URL || env.MOBILE_SERVER_URL;
  if (configured) {
    const url = new URL(configured);
    if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error(`MOBILE_SERVER_URL must be an http(s) address: ${configured}`);
    return url.origin;
  }
  const [address] = lanAddresses();
  if (!address) throw new Error("No local network address found: connect to Wi-Fi or set MOBILE_SERVER_URL.");
  return `http://${address}:${process.env.PORT ?? "3000"}`;
}

const url = serverUrl();

// Shown instead of a page that fails to load (no connection, or an error status), with a button back to
// the site. Written here so that it always carries the address this sync puts into the app.
mkdirSync("www", { recursive: true });
writeFileSync("www/index.html", readFileSync("error-page.html", "utf8").replace("__SERVER_URL__", url));

const config: CapacitorConfig = {
  appId: "io.github.copirlo20.financialmanagement",
  appName: "Financial Management",
  webDir: "www",
  server: {
    url,
    // Android refuses plain http unless allowed; only a local development server should need it.
    cleartext: url.startsWith("http:"),
    errorPath: "index.html",
  },
  plugins: {
    // "native" keeps the page clear of the system bars without writing --safe-area-inset-* onto <html>
    // (the default "css" does, before React hydrates, which React reports as a mismatch). The site uses
    // env(safe-area-inset-*) instead, which this keeps working.
    SystemBars: { insetsHandling: "native" },
  },
};

export default config;
