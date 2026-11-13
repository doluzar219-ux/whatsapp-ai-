import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // These packages use dynamic requires / binary data files and must be
  // resolved from node_modules at runtime instead of being bundled.
  serverExternalPackages: [
    "@whiskeysockets/baileys",
    "@hapi/boom",
    "pino",
    "pdfkit",
  ],
};

export default nextConfig;
