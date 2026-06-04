// @ts-check
// PR status-checks detection for the Conversation page (issue #1).
//
// GitHub renders the PR's status checks in the merge box near the BOTTOM
// of the conversation, not in the timeline. The box holds one row per
// check, each with an accessible label like:
//   "AutoTest - 2.0 successful in 54m"
//   "required/architect-approval waiting for status to be reported"
//   "Claude Code / claude (pull_request_review) skipped"
// We locate that box and aggregate the rows into a single coarse status so
// a small indicator can be surfaced at the top of the page and jump to it.
//
// Browser: attaches the helpers to the global scope (loaded before
// content.js). Node: exports them for tests.

(function (root, factory) {
  if (typeof module !== "undefined" && module.exports) {
    module.exports = factory();
  } else {
    Object.assign(root, factory());
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  // The whole status-checks/merge box — used as the scroll target. Class
  // names are CSS-module-hashed (`MergeBox-module__mergePartialContainer__x`)
  // so we match on the stable human-readable prefix and fall back through
  // a couple of related containers.
  /** @param {ParentNode} [root] */
  function findChecksBox(root) {
    const scope = root || document;
    return (
      scope.querySelector('[class*="MergeBox-module__mergePartialContainer"]') ||
      scope.querySelector('[class*="ExpandedChecks-module__checksContainer"]') ||
      scope.querySelector('[class*="MergeBoxExpandable-module"]') ||
      null
    );
  }

  // The accessible labels of the individual check rows within the box.
  /** @param {ParentNode} [root] */
  function getCheckLabels(root) {
    const scope = root || document;
    const box = findChecksBox(scope) || scope;
    return Array.from(box.querySelectorAll("li[aria-label]"))
      .map((li) => (li.getAttribute("aria-label") || "").trim())
      .filter(Boolean);
  }

  // Aggregate the check-row labels into a coarse { key, label, color }.
  // Precedence: any failure -> failing; else any in-flight -> running;
  // else any success -> passing; else unknown. Checked in that order so a
  // single red check dominates the summary, matching GitHub's own rollup.
  /** @param {string[] | string} labels */
  function deriveChecksState(labels) {
    const list = Array.isArray(labels) ? labels : [labels || ""];
    /** @param {RegExp} re */
    const any = (re) => list.some((l) => re.test(l));

    if (any(/(fail|error|timed out|cancel|denied|action required)/i)) {
      return { key: "failing", label: "✗ Checks failing", color: "#d1242f" };
    }
    if (any(/(in progress|in_progress|pending|queued|running|waiting|expected)/i)) {
      return { key: "running", label: "• Checks running", color: "#9a6700" };
    }
    if (any(/(success|passed|passing)/i)) {
      return { key: "passing", label: "✓ Checks passing", color: "#1a7f37" };
    }
    return { key: "unknown", label: "• Checks status", color: "#1f6feb" };
  }

  return { findChecksBox, getCheckLabels, deriveChecksState };
});
