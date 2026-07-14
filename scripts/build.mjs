// Package the extension into a .zip (Chromium stores) and a .xpi (Firefox).
//
// The version is read from manifest.json — the single source of truth — so
// bumping the extension version never means editing this script or a
// filename by hand.
//
// The file list is derived from manifest.json (content scripts, background
// scripts, icons, popup) plus the <script src> tags of any packaged HTML
// page, rather than hand-maintained. A hand-maintained list once shipped a
// broken build by omitting checks.js; deriving the list makes that class of
// mistake impossible, and the existence check below turns a missing file
// into a build failure instead of a silently broken archive.

import { createWriteStream } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import path from "node:path";

// archiver is CommonJS without an ESM default export; require it.
const require = createRequire(import.meta.url);
const archiver = require("archiver");

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

/** Collect every file the browser loads, straight from the manifest. */
async function collectFiles(manifest) {
  const files = new Set(["manifest.json"]);

  for (const cs of manifest.content_scripts ?? []) {
    for (const f of cs.js ?? []) files.add(f);
    for (const f of cs.css ?? []) files.add(f);
  }

  if (manifest.background?.service_worker) files.add(manifest.background.service_worker);
  for (const f of manifest.background?.scripts ?? []) files.add(f);

  for (const f of Object.values(manifest.icons ?? {})) files.add(f);
  for (const f of Object.values(manifest.action?.default_icon ?? {})) files.add(f);
  if (manifest.action?.default_popup) files.add(manifest.action.default_popup);

  // HTML pages pull in their own scripts via <script src>.
  for (const f of [...files].filter((f) => f.endsWith(".html"))) {
    const html = await readFile(path.join(root, f), "utf8");
    for (const [, src] of html.matchAll(/<script\s+[^>]*src="([^"]+)"/g)) {
      files.add(src);
    }
  }

  return [...files].sort();
}

function zipTo(outPath, files) {
  return new Promise((resolve, reject) => {
    const output = createWriteStream(outPath);
    const archive = archiver("zip", { zlib: { level: 9 } });
    output.on("close", () => resolve(archive.pointer()));
    archive.on("error", reject);
    archive.pipe(output);
    for (const f of files) archive.file(path.join(root, f), { name: f });
    archive.finalize();
  });
}

const manifest = JSON.parse(await readFile(path.join(root, "manifest.json"), "utf8"));
const { version, name } = manifest;
const files = await collectFiles(manifest);

// Fail loudly if the manifest references a file that doesn't exist.
const missing = [];
for (const f of files) {
  await stat(path.join(root, f)).catch(() => missing.push(f));
}
if (missing.length) {
  console.error(`Referenced files not found: ${missing.join(", ")}`);
  process.exit(1);
}

const base = "github-pr-reverse-comments";
const zipName = `${base}.zip`;
const xpiName = `${base}-${version}.xpi`;

// Identical contents; the .xpi extension is just what Firefox expects.
const zipBytes = await zipTo(path.join(root, zipName), files);
await zipTo(path.join(root, xpiName), files);

console.log(`Built ${name} v${version} (${files.length} files)`);
console.log(`  ${zipName} (${zipBytes} bytes)`);
console.log(`  ${xpiName}`);
