#!/usr/bin/env node
/**
 * Captures viewport screenshots of every ShopFlow surface into docs/screenshots/.
 * Usage: BASE=http://localhost:3000 PAY_ORDER=7 node scripts/screenshot.mjs
 */
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const BASE = (process.env.BASE ?? "http://127.0.0.1:3000").replace(/\/$/, "");
const PAY_ORDER = process.env.PAY_ORDER ?? "7";
const OUT = "docs/screenshots";
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ args: ["--no-sandbox"] });
const ctx = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 1.5,
  colorScheme: "dark",
});

async function shot(name, path, { fullPage = false, waitFor, action, settle = 1200 } = {}) {
  const page = await ctx.newPage();
  try {
    await page.goto(BASE + path, { waitUntil: "networkidle", timeout: 45_000 });
    if (waitFor) {
      await page.waitForSelector(waitFor, { timeout: 20_000 }).catch(() => undefined);
    }
    if (action) await action(page).catch(() => undefined);
    await page.waitForTimeout(settle);
    await page.screenshot({ path: `${OUT}/${name}`, fullPage });
    console.log(`captured ${OUT}/${name}`);
  } finally {
    await page.close();
  }
}

await shot("01-landing.png", "/", { fullPage: true, settle: 2500 });
await shot("02-whatsapp-qr.png", "/whatsapp", {
  waitFor: ".bg-white svg, .bg-white",
  settle: 6500,
});
await shot("03-admin-dashboard.png", "/admin", { settle: 2500 });
await shot("04-ai-simulator.png", "/demo", {
  settle: 800,
  action: async (page) => {
    // Drive one quick prompt so the chat shows a live Dukandar reply.
    const chip = page.locator("button", { hasText: "Show me what you sell" }).first();
    await chip.click({ timeout: 3000 });
    await page.waitForTimeout(7000);
  },
});
await shot("05-payment-page.png", `/pay/${PAY_ORDER}`, { settle: 1500 });
await shot("06-payment-success.png", `/pay/${PAY_ORDER}`, {
  settle: 600,
  action: async (page) => {
    await page.locator("button", { hasText: "Complete Mock Payment" }).click({ timeout: 4000 });
    await page.waitForSelector("text=Payment received", { timeout: 12_000 });
  },
});

await browser.close();
console.log("done");
