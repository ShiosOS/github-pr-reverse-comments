import js from "@eslint/js";
import globals from "globals";
import prettier from "eslint-config-prettier";

// Shared globals our own files attach/read across script boundaries
// (see constants.js / reorder.js). Declaring them keeps `no-undef` honest.
const sharedGlobals = {
  STORAGE_KEY: "readonly",
  ORDER: "readonly",
  firstMatchingTarget: "readonly",
  pushedCommitTargets: "readonly",
  applyOrderToTarget: "readonly",
};

export default [
  { ignores: ["node_modules/**", "*.zip", "*.xpi"] },

  js.configs.recommended,

  // UMD modules: run in the browser (extension) AND under Node (tests),
  // so they legitimately reference both `globalThis`/window and module.
  {
    files: ["constants.js", "reorder.js"],
    languageOptions: {
      globals: { ...globals.browser, ...globals.node, ...sharedGlobals },
    },
  },

  // Content/popup scripts run in the page/popup with the chrome.* API.
  {
    files: ["content.js", "popup.js"],
    languageOptions: {
      globals: { ...globals.browser, chrome: "readonly", ...sharedGlobals },
    },
  },

  // Background service worker.
  {
    files: ["background.js"],
    languageOptions: {
      globals: { ...globals.serviceworker, chrome: "readonly" },
    },
  },

  // Node-side tooling.
  {
    files: ["**/*.mjs"],
    languageOptions: {
      sourceType: "module",
      globals: { ...globals.node },
    },
  },

  // Tests run under Vitest + jsdom: Node plus a browser `document`.
  {
    files: ["test/**/*.test.mjs"],
    languageOptions: {
      sourceType: "module",
      globals: { ...globals.node, ...globals.browser },
    },
  },

  prettier,
];
