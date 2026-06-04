// Package the extension into a .zip (Chromium stores) and a .xpi (Firefox).
//
// The version is read from manifest.json — the single source of truth — so
// bumping the extension version never means editing this script or a
// filename by hand.

import { createWriteStream } from "node:fs";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import path from "node:path";

// archiver is CommonJS without an ESM default export; require it.
const require = createRequire(import.meta.url);
const archiver = require("archiver");

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

// Files the browser actually loads. Everything else (tests, configs,
// node_modules, docs) is dev-only and must not ship.
const INCLUDE = [
  "manifest.json",
  "constants.js",
  "reorder.js",
  "content.js",
  "background.js",
  "popup.html",
  "popup.js",
  "icon-16.png",
  "icon-16-disabled.png",
  "icon-48.png",
  "icon-48-disabled.png",
  "icon-128.png",
  "icon-128-disabled.png",
];

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
const base = "github-pr-reverse-comments";

const zipName = `${base}.zip`;
const xpiName = `${base}-${version}.xpi`;

// Identical contents; the .xpi extension is just what Firefox expects.
const zipBytes = await zipTo(path.join(root, zipName), INCLUDE);
await zipTo(path.join(root, xpiName), INCLUDE);

console.log(`Built ${name} v${version}`);
console.log(`  ${zipName} (${zipBytes} bytes)`);
console.log(`  ${xpiName}`);
