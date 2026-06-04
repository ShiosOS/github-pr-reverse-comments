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

const ACTIVE_PATH = { 16: "icon-16.png", 48: "icon-48.png" };
const DISABLED_PATH = { 16: "icon-16-disabled.png", 48: "icon-48-disabled.png" };

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

chrome.runtime.onInstalled.addListener(syncAllTabs);
chrome.runtime.onStartup.addListener(syncAllTabs);

// URL changes — covers both full page loads and pushState/replaceState soft nav.
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.url || changeInfo.status === "complete") {
    setIconForTab(tabId, changeInfo.url || tab.url);
  }
});

// Tab activation — make sure the toolbar reflects the now-focused tab
// even if it was opened/loaded in the background.
chrome.tabs.onActivated.addListener(({ tabId }) => {
  chrome.tabs.get(tabId, (tab) => {
    if (chrome.runtime.lastError) return;
    setIconForTab(tabId, tab.url);
  });
});
