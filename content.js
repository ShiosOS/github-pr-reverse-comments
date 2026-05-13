// GitHub PR Reverse Comments — content script
//
// Reverses the order of `.js-timeline-item` elements inside `.js-discussion`,
// while leaving non-timeline siblings (PR description, "review changes" form,
// comment composer, etc.) in their original slots.

(() => {
  const STORAGE_KEY = "prCommentOrder"; // "newest" | "oldest"
  const DISCUSSION_SELECTOR = ".js-discussion";
  const ITEM_SELECTOR = ".js-timeline-item";
  const BUTTON_ID = "pr-reverse-comments-toggle";

  let currentOrder = "newest";
  let isSorting = false; // re-entrancy guard so the observer doesn't see our own DOM writes
  let observer = null;

  function getDiscussion() {
    return document.querySelector(DISCUSSION_SELECTOR);
  }

  // Sort only `.js-timeline-item` children by their original document position.
  // Non-timeline siblings (the PR description, the comment box, etc.) keep
  // their slots — we only rewrite the positions held by timeline items.
  function applyOrder(order) {
    const container = getDiscussion();
    if (!container) return;

    const allChildren = Array.from(container.children);
    const items = allChildren.filter((el) => el.matches(ITEM_SELECTOR));
    if (items.length < 2) return;

    isSorting = true;
    try {
      // Stamp originals on first sight so repeated re-sorts are stable.
      let nextIndex = 0;
      for (const el of items) {
        const idx = el.dataset.prrcIndex;
        if (idx !== undefined) {
          const n = parseInt(idx, 10);
          if (!Number.isNaN(n) && n >= nextIndex) nextIndex = n + 1;
        }
      }
      for (const el of items) {
        if (el.dataset.prrcIndex === undefined) {
          el.dataset.prrcIndex = String(nextIndex++);
        }
      }

      // The DOM slots currently occupied by timeline items, in document order.
      const slots = allChildren
        .map((el, i) => (el.matches(ITEM_SELECTOR) ? i : -1))
        .filter((i) => i !== -1);

      // Items sorted by stored original index.
      const sortedItems = [...items].sort((a, b) => {
        const ai = parseInt(a.dataset.prrcIndex, 10);
        const bi = parseInt(b.dataset.prrcIndex, 10);
        return order === "newest" ? bi - ai : ai - bi;
      });

      // Place sortedItems[k] at slot k. We do this by rebuilding the child
      // order array and re-appending in that order.
      const newChildren = allChildren.slice();
      slots.forEach((slotIdx, k) => {
        newChildren[slotIdx] = sortedItems[k];
      });

      // Skip work if nothing actually moved.
      let changed = false;
      for (let i = 0; i < newChildren.length; i++) {
        if (newChildren[i] !== allChildren[i]) { changed = true; break; }
      }
      if (!changed) {
        isSorting = false;
        return;
      }

      for (const el of newChildren) container.appendChild(el);
    } finally {
      setTimeout(() => { isSorting = false; }, 0);
    }
  }

  function startObserver() {
    const container = getDiscussion();
    if (!container) return;
    if (observer) observer.disconnect();

    observer = new MutationObserver((mutations) => {
      if (isSorting) return;
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

    const btn = document.createElement("button");
    btn.id = BUTTON_ID;
    btn.type = "button";
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

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local" || !changes[STORAGE_KEY]) return;
    currentOrder = changes[STORAGE_KEY].newValue || "newest";
    const btn = document.getElementById(BUTTON_ID);
    if (btn) updateButtonLabel(btn);
    applyOrder(currentOrder);
  });

  function waitForDiscussion(callback) {
    if (getDiscussion()) { callback(); return; }
    const bootObs = new MutationObserver(() => {
      if (getDiscussion()) {
        bootObs.disconnect();
        callback();
      }
    });
    bootObs.observe(document.body, { childList: true, subtree: true });
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

  document.addEventListener("turbo:render", () => {
    waitForDiscussion(() => {
      applyOrder(currentOrder);
      injectToggleButton();
      startObserver();
    });
  });
})();
