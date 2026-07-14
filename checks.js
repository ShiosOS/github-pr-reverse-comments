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

  // Status-phrase patterns. Word boundaries plus explicit word forms keep
  // a check *named* e.g. "failover-suite" or "cancellation-service" from
  // tripping the failure branch when its label reads "... successful in 2m"
  // (bare substring matching used to misreport those as failing). A check
  // name that itself contains a standalone status word (e.g. "error-pages")
  // is still ambiguous — labels are all GitHub's accessible rows give us.
  const FAILING_RE =
    /\b(fail(?:ed|ing|ures?|s)?|error(?:ed|s)?|timed out|cancel(?:l?ed)?|denied|action required)\b/i;
  const RUNNING_RE = /\b(in[ _]progress|pending|queued|running|waiting|expected)\b/i;
  const PASSING_RE = /\b(success(?:ful)?|passed|passing)\b/i;

  // Aggregate the check-row labels into a coarse { key, label, color }.
  // Precedence: any failure -> failing; else any in-flight -> running;
  // else any success -> passing; else unknown. Checked in that order so a
  // single red check dominates the summary, matching GitHub's own rollup.
  /** @param {string[] | string} labels */
  function deriveChecksState(labels) {
    const list = Array.isArray(labels) ? labels : [labels || ""];
    /** @param {RegExp} re */
    const any = (re) => list.some((l) => re.test(l));

    if (any(FAILING_RE)) {
      return { key: "failing", label: "✗ Checks failing", color: "#d1242f" };
    }
    if (any(RUNNING_RE)) {
      return { key: "running", label: "• Checks running", color: "#9a6700" };
    }
    if (any(PASSING_RE)) {
      return { key: "passing", label: "✓ Checks passing", color: "#1a7f37" };
    }
    return { key: "unknown", label: "• Checks status", color: "#1f6feb" };
  }

  return { findChecksBox, getCheckLabels, deriveChecksState };
});
