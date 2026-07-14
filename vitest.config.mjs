import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // reorder.js manipulates the DOM, so the helpers need a document.
    environment: "jsdom",
    include: ["test/**/*.test.mjs"],
    // Threads avoid the process-fork IPC that some sandboxed/CI runners
    // block; jsdom tests have no need for process isolation.
    pool: "threads",
    coverage: {
      // Istanbul (transform-time instrumentation) is pool-agnostic; the v8
      // provider under-reports with the threads pool in some sandboxed/CI
      // environments.
      provider: "istanbul",
      // Measure the unit-tested logic modules. content.js and popup.js are
      // thin DOM/chrome glue exercised in a real browser, not under jsdom,
      // so including them would report misleading zeros.
      include: ["constants.js", "reorder.js", "checks.js", "pages.js", "background.js"],
      reporter: ["text", "lcov"],
      // Branches sits a little lower than the rest: each module's UMD
      // wrapper has a browser-global branch that can't run under Node tests.
      thresholds: {
        statements: 90,
        branches: 85,
        functions: 95,
        lines: 90,
      },
    },
  },
});
