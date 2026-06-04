import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // reorder.js manipulates the DOM, so the helpers need a document.
    environment: "jsdom",
    include: ["test/**/*.test.mjs"],
    // Threads avoid the process-fork IPC that some sandboxed/CI runners
    // block; jsdom tests have no need for process isolation.
    pool: "threads",
  },
});
