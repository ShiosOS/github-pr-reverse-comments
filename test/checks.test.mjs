import { describe, it, expect, beforeEach } from "vitest";
import checks from "../checks.js";

const { findChecksBox, getCheckLabels, deriveChecksState } = checks;

beforeEach(() => {
  document.body.innerHTML = "";
});

// Build a merge/checks box (CSS-module-style class) with the given check
// aria-labels, mirroring GitHub's real structure.
function buildChecksBox(labels) {
  const box = document.createElement("div");
  box.className = "MergeBox-module__mergePartialContainer__MTXP9 border";
  const ul = document.createElement("ul");
  ul.setAttribute("data-listview-component", "items-list");
  for (const label of labels) {
    const li = document.createElement("li");
    li.setAttribute("aria-label", label);
    ul.appendChild(li);
  }
  box.appendChild(ul);
  document.body.appendChild(box);
  return box;
}

// The 17 real check labels captured from a live cognito PR.
const REAL_LABELS = [
  "AutoTest - 2.0 successful in 54m",
  "AutoTest - 2.0 (Build Build Cognito.sln) successful in 5m",
  "AutoTest - 2.0 (Run Service Tests Run Service Tests) successful in 35m",
  "Claude Code / claude (pull_request_review) skipped",
  "Main-CI successful in 3m",
  "required/architect-approval waiting for status to be reported",
  "required/work-item-link",
];

describe("deriveChecksState", () => {
  it("reports passing when all checks succeeded (or skipped)", () => {
    const s = deriveChecksState([
      "AutoTest successful in 54m",
      "Main-CI successful in 3m",
      "x skipped",
    ]);
    expect(s.key).toBe("passing");
    expect(s.label).toContain("passing");
  });

  it("reports running when a check is still in flight", () => {
    expect(deriveChecksState(["a successful", "b in progress"]).key).toBe("running");
    expect(deriveChecksState(["a successful", "b waiting for status to be reported"]).key).toBe(
      "running",
    );
    expect(deriveChecksState(["a pending"]).key).toBe("running");
  });

  it("reports failing when any check failed", () => {
    expect(deriveChecksState(["a successful", "b failing after 2m"]).key).toBe("failing");
    expect(deriveChecksState(["a errored"]).key).toBe("failing");
  });

  it("lets failure win over success and in-flight", () => {
    const s = deriveChecksState(["a successful", "b in progress", "c failing"]);
    expect(s.key).toBe("failing");
  });

  it("returns unknown for an empty or statusless set", () => {
    expect(deriveChecksState([]).key).toBe("unknown");
    expect(deriveChecksState(["required/work-item-link"]).key).toBe("unknown");
  });

  it("accepts a single string as well as an array", () => {
    expect(deriveChecksState("everything successful").key).toBe("passing");
  });

  it("matches the real captured check set (running: one is waiting)", () => {
    expect(deriveChecksState(REAL_LABELS).key).toBe("running");
  });
});

describe("findChecksBox / getCheckLabels", () => {
  it("finds the merge box by its stable class prefix", () => {
    const box = buildChecksBox(["AutoTest successful in 1m"]);
    expect(findChecksBox()).toBe(box);
  });

  it("returns null when there is no checks box", () => {
    expect(findChecksBox()).toBeNull();
  });

  it("collects the trimmed, non-empty check labels", () => {
    buildChecksBox(["AutoTest successful in 1m", "  Main-CI successful  ", ""]);
    expect(getCheckLabels()).toEqual(["AutoTest successful in 1m", "Main-CI successful"]);
  });

  it("end-to-end: real labels in a box derive to running", () => {
    buildChecksBox(REAL_LABELS);
    expect(deriveChecksState(getCheckLabels()).key).toBe("running");
  });
});
