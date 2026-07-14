// @ts-check
// GitHub PR Reverse Comments — background service worker
//
// Single job: keep the toolbar icon in sync with whether the current tab
// is on a PR Conversation page. Disabled (gray) by default; active
// (blue) only when the URL matches `/owner/repo/pull/N`.
//
// We use chrome.tabs events instead of messages from the content script
// so the icon updates correctly even when the user navigates to a
// non-PR URL (where the content script doesn't run).
//
// Structured like the other modules: the logic lives in a factory so
// Node tests can import and exercise it against a stubbed chrome API,
// while listener registration stays synchronous at load time (an MV3
// service-worker requirement — events fired while the worker was asleep
// are only redelivered to listeners registered during startup).

(function (root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  } else {
    Object.assign(root, api);
  }

  if (typeof chrome !== "undefined" && chrome.runtime) {
    chrome.runtime.onInstalled.addListener(api.syncAllTabs);
    chrome.runtime.onStartup.addListener(api.syncAllTabs);
    chrome.tabs.onUpdated.addListener(api.handleTabUpdated);
    chrome.tabs.onActivated.addListener(api.handleTabActivated);
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const ACTIVE_PATH = { 16: "icon-16.png", 48: "icon-48.png", 128: "icon-128.png" };
  const DISABLED_PATH = {
    16: "icon-16-disabled.png",
    48: "icon-48-disabled.png",
    128: "icon-128-disabled.png",
  };

  // Matches any PR page the extension is active on:
  //   /owner/repo/pull/N            (Conversation)
  //   /owner/repo/pull/N/commits    (Commits)
  // All other sub-paths (/files, /checks, deep diff anchors) leave the
  // toolbar icon in the disabled state.
  const ACTIVE_URL_RE =
    /^https:\/\/github\.com\/[^/]+\/[^/]+\/pull\/\d+(?:\/commits)?\/?(?:[?#].*)?$/;

  /** @param {unknown} url */
  function isActiveUrl(url) {
    return typeof url === "string" && ACTIVE_URL_RE.test(url);
  }

  /**
   * @param {number | undefined} tabId
   * @param {string | undefined} url
   */
  function setIconForTab(tabId, url) {
    const path = isActiveUrl(url) ? ACTIVE_PATH : DISABLED_PATH;
    chrome.action.setIcon({ tabId, path }).catch(() => {
      // Tab may have been closed between the event and our call; ignore.
    });
  }

  // Initial state on install / browser start: walk existing tabs.
  function syncAllTabs() {
    chrome.tabs.query({}, (tabs) => {
      for (const tab of tabs) setIconForTab(tab.id, tab.url);
    });
  }

  // URL changes — covers both full page loads and pushState/replaceState soft nav.
  /**
   * @param {number} tabId
   * @param {chrome.tabs.OnUpdatedInfo} changeInfo
   * @param {chrome.tabs.Tab} tab
   */
  function handleTabUpdated(tabId, changeInfo, tab) {
    if (changeInfo.url || changeInfo.status === "complete") {
      setIconForTab(tabId, changeInfo.url || tab.url);
    }
  }

  // Tab activation — make sure the toolbar reflects the now-focused tab
  // even if it was opened/loaded in the background.
  /** @param {{ tabId: number }} activeInfo */
  function handleTabActivated({ tabId }) {
    chrome.tabs.get(tabId, (tab) => {
      if (chrome.runtime.lastError) return;
      setIconForTab(tabId, tab.url);
    });
  }

  return { isActiveUrl, setIconForTab, syncAllTabs, handleTabUpdated, handleTabActivated };
});
