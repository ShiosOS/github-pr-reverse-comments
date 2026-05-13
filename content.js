// GitHub PR Reverse Comments — content script
// Reverses children of `.js-discussion` based on a stored preference, and
// re-applies the order whenever GitHub dynamically inserts new items.

(() => {
  const STORAGE_KEY = "prCommentOrder"; // "newest" | "oldest"
  const DISCUSSION_SELECTOR = ".js-discussion";
  const BUTTON_ID = "pr-reverse-comments-toggle";

  let currentOrder = "newest";
  let isSorting = false; // re-entrancy guard so the observer doesn't see our own DOM writes
  let observer = null;

  function getDiscussion() {
    return document.querySelector(DISCUSSION_SELECTOR);
  }

  // Sort children of `.js-discussion` by their original document position.
  // We stash the original index on a data attribute the first time we see a
  // node so subsequent re-sorts are stable regardless of current DOM order.
  function applyOrder(order) {
    const container = getDiscussion();
    if (!container) return;

    isSorting = true;
    try {
      const children = Array.from(container.children);

      let nextIndex = 0;
      // Find the highest assigned index so newly-inserted nodes keep increasing.
      for (const el of children) {
        const idx = el.dataset.prrcIndex;
        if (idx !== undefined) {
          const n = parseInt(idx, 10);
          if (!Number.isNaN(n) && n >= nextIndex) nextIndex = n + 1;
        }
      }
      for (const el of children) {
        if (el.dataset.prrcIndex === undefined) {
          el.dataset.prrcIndex = String(nextIndex++);
        }
      }

      children.sort((a, b) => {
        const ai = parseInt(a.dataset.prrcIndex, 10);
        const bi = parseInt(b.dataset.prrcIndex, 10);
        return order === "newest" ? bi - ai : ai - bi;
      });

      // Re-append in the desired order. Appending a node already in the
      // container just moves it, so this is cheap.
      for (const el of children) container.appendChild(el);
    } finally {
      // Defer clearing the flag until after the observer fires for our writes.
      setTimeout(() => { isSorting = false; }, 0);
    }
  }

  function startObserver() {
    const container = getDiscussion();
    if (!container) return;
    if (observer) observer.disconnect();

    observer = new MutationObserver((mutations) => {
      if (isSorting) return;
      // Only re-sort if children were added/removed (not for attribute churn
      // inside existing comments — GitHub does a lot of that).
      const structural = mutations.some(
        (m) => m.type === "childList" && (m.addedNodes.length || m.removedNodes.length)
      );
      if (!structural) return;

      observer.disconnect();
      applyOrder(currentOrder);
      observer.observe(container, { childList: true });
    });

    observer.observe(container, { childList: true });
  }

  function injectToggleButton() {
    if (document.getElementById(BUTTON_ID)) return;

    // Anchor the button near the PR title actions if available, otherwise
    // fall back to a fixed-position floating button.
    const btn = document.createElement("button");
    btn.id = BUTTON_ID;
    btn.type = "button";
    btn.className = "btn btn-sm";
    btn.style.cssText = [
      "position: fixed",
      "bottom: 16px",
      "right: 16px",
      "z-index: 9999",
      "padding: 6px 12px",
      "background: #1f6feb",
      "color: #fff",
      "border: 1px solid rgba(255,255,255,0.1)",
      "border-radius: 6px",
      "font: 12px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      "cursor: pointer",
      "box-shadow: 0 2px 6px rgba(0,0,0,0.2)"
    ].join(";");
    updateButtonLabel(btn);

    btn.addEventListener("click", () => {
      currentOrder = currentOrder === "newest" ? "oldest" : "newest";
      chrome.storage.local.set({ [STORAGE_KEY]: currentOrder });
      updateButtonLabel(btn);
      applyOrder(currentOrder);
    });

    document.body.appendChild(btn);
  }

  function updateButtonLabel(btn) {
    const label = currentOrder === "newest" ? "↓ Newest first" : "↑ Oldest first";
    btn.textContent = label;
    btn.title = `Click to switch to ${currentOrder === "newest" ? "oldest" : "newest"} first`;
  }

  // React to changes made from the popup.
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local" || !changes[STORAGE_KEY]) return;
    currentOrder = changes[STORAGE_KEY].newValue || "newest";
    const btn = document.getElementById(BUTTON_ID);
    if (btn) updateButtonLabel(btn);
    applyOrder(currentOrder);
  });

  // GitHub uses Turbo navigation — `.js-discussion` may not exist at
  // `document_idle` on first paint. Wait for it to appear.
  function waitForDiscussion(callback) {
    if (getDiscussion()) { callback(); return; }
    const bootObs = new MutationObserver(() => {
      if (getDiscussion()) {
        bootObs.disconnect();
        callback();
      }
    });
    bootObs.observe(document.body, { childList: true, subtree: true });
    // Safety timeout — stop watching after 30s to avoid leaks on non-PR pages.
    setTimeout(() => bootObs.disconnect(), 30000);
  }

  async function init() {
    const stored = await chrome.storage.local.get(STORAGE_KEY);
    currentOrder = stored[STORAGE_KEY] || "newest";

    waitForDiscussion(() => {
      applyOrder(currentOrder);
      injectToggleButton();
      startObserver();
    });
  }

  init();

  // Handle Turbo navigation between PR pages without a full reload.
  document.addEventListener("turbo:render", () => {
    // Re-inject and re-bind on the new page.
    waitForDiscussion(() => {
      applyOrder(currentOrder);
      injectToggleButton();
      startObserver();
    });
  });
})();
