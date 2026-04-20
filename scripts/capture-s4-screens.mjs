/**
 * Staging screenshots for Tess docs (s4-tech.tess.im).
 *
 * Run from any directory where the `playwright` package resolves, for example:
 *   mkdir -p /tmp/pw-cap && cd /tmp/pw-cap && npm init -y && npm i playwright@1.49.1
 *   IMAGE_DIR=/absolute/path/to/mintlify-docs/images node /absolute/path/to/mintlify-docs/scripts/capture-s4-screens.mjs
 *
 * Optional: set TESS_S4_EMAIL / TESS_S4_PASSWORD later to extend this script with post-login captures.
 */
import { chromium } from "playwright";
import { mkdir } from "fs/promises";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const base = "https://s4-tech.tess.im";
const imagesDir =
  process.env.IMAGE_DIR || join(__dirname, "..", "images");
const paths = [
  { path: "/", name: "te44-s4-home" },
  { path: "/login", name: "te44-s4-login" },
];

await mkdir(imagesDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  locale: "en-US",
});
const page = await context.newPage();

for (const { path: p, name } of paths) {
  const url = `${base}${p === "/" ? "" : p}`;
  await page.goto(url, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(2000);
  const file = join(imagesDir, `${name}.png`);
  await page.screenshot({ path: file, fullPage: true });
  process.stdout.write(`Wrote ${file}\n`);
}

await browser.close();
