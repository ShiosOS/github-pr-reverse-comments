// @ts-check
// Shared constants for the extension.
//
// Loaded as a plain (non-module) script before content.js and popup.js.
// Browser extensions inject content scripts into a shared scope, so the
// values attached here on `globalThis` are visible to content.js; the
// same file is <script>-included by popup.html for popup.js. Under Node
// (tests) the module.exports branch is taken instead. This is the single
// source of truth — neither content.js nor popup.js hard-codes these.

(function (root, factory) {
  if (typeof module !== "undefined" && module.exports) {
    module.exports = factory();
  } else {
    Object.assign(root, factory());
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  // chrome.storage.local key holding the user's order preference.
  const STORAGE_KEY = "prCommentOrder";
  // Allowed values for that preference.
  const ORDER = { NEWEST: "newest", OLDEST: "oldest" };

  // Coerce whatever came out of storage into a valid order value. Storage
  // is a system boundary: a stale or corrupted value must not leave the
  // button label saying one thing while the sort does another.
  /** @param {unknown} value */
  function normalizeOrder(value) {
    return value === ORDER.OLDEST ? ORDER.OLDEST : ORDER.NEWEST;
  }

  return { STORAGE_KEY, ORDER, normalizeOrder };
});
