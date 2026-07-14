// Integration test for scripts/build.mjs: run the real packaging script
// and verify the archive contains every file the browser will ask for.
// This guards against the class of bug where a script is added to
// manifest.json but the release archive doesn't ship it (which once
// happened with checks.js, producing broken store builds).

import { describe, it, expect, beforeAll } from "vitest";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const run = promisify(execFile);
const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const zipPath = path.join(root, "github-pr-reverse-comments.zip");

/** @type {string[]} */
let entries = [];
let manifest;

beforeAll(async () => {
  manifest = JSON.parse(await readFile(path.join(root, "manifest.json"), "utf8"));
  await run("node", [path.join(root, "scripts", "build.mjs")]);
  const { stdout } = await run("unzip", ["-Z1", zipPath]);
  entries = stdout.split(/\r?\n/).filter(Boolean);
}, 30_000);

describe("packaged archive", () => {
  it("contains the manifest itself", () => {
    expect(entries).toContain("manifest.json");
  });

  it("contains every content script listed in manifest.json", () => {
    for (const cs of manifest.content_scripts) {
      for (const f of cs.js) expect(entries).toContain(f);
    }
  });

  it("contains the background scripts", () => {
    expect(entries).toContain(manifest.background.service_worker);
    for (const f of manifest.background.scripts) expect(entries).toContain(f);
  });

  it("contains the popup page and the scripts it loads", async () => {
    const popup = manifest.action.default_popup;
    expect(entries).toContain(popup);
    const html = await readFile(path.join(root, popup), "utf8");
    for (const [, src] of html.matchAll(/<script\s+[^>]*src="([^"]+)"/g)) {
      expect(entries).toContain(src);
    }
  });

  it("contains every icon referenced by the manifest", () => {
    for (const f of Object.values(manifest.icons)) expect(entries).toContain(f);
    for (const f of Object.values(manifest.action.default_icon)) expect(entries).toContain(f);
  });

  it("ships no dev-only files", () => {
    const forbidden = entries.filter(
      (e) =>
        e.startsWith("node_modules/") ||
        e.startsWith("test/") ||
        e.startsWith(".github/") ||
        /\.(mjs|md|lock)$/.test(e) ||
        e.startsWith("."),
    );
    expect(forbidden).toEqual([]);
  });
});
