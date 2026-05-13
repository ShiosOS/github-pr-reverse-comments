// GitHub PR Reverse Comments — content script
//
// Reverses the order of timeline items on a PR conversation page. GitHub
// ships several variants of this page (classic Rails, partial React, full
// React rollout), so we try a list of candidate container/item selector
// pairs and use the first one that matches.

(() => {
  const STORAGE_KEY = "prCommentOrder"; // "newest" | "oldest"
  const BUTTON_ID = "pr-reverse-comments-toggle";
  const LOG = (...args) => console.log("[PRRC]", ...args);

  // Ordered list of (container, item) selector pairs to try. First match wins.
  const SELECTOR_CANDIDATES = [
    { container: ".js-discussion", item: ".js-timeline-item" },
    { container: '[data-testid="issue-viewer-issue-container"]', item: '[data-testid^="issue-viewer-comment"]' },
    { container: '[data-testid="pr-timeline"]', item: '[data-testid^="pr-timeline-item"]' },
    // Fallback: any element that looks like a timeline list.
    { container: ".pull-discussion-timeline", item: ".js-timeline-item" },
  ];

  let currentOrder = "newest";
  let isSorting = false;
  let observer = null;
  let activeSelectors = null;

  function findContainer() {
    for (const pair of SELECTOR_CANDIDATES) {
      const el = document.querySelector(pair.container);
      if (!el) continue;
      const directItems = el.querySelectorAll(`:scope > ${pair.item}`);
      if (directItems.length >= 2) {
        return { el, item: pair.item, containerSel: pair.container, descendant: false };
      }
      const anyItems = el.querySelectorAll(pair.item);
      if (anyItems.length >= 2) {
        return { el, item: pair.item, containerSel: pair.container, descendant: true };
      }
    }
    return null;
  }

  function applyOrder(order) {
    const found = findContainer();
    if (!found) {
      LOG("no matching container/item selector found on this page");
      return;
    }
    if (!activeSelectors) {
      activeSelectors = found;
      LOG("using selectors", {
        containerSel: found.containerSel,
        containerTag: found.el.tagName + (found.el.className ? "." + String(found.el.className).split(/\s+/).slice(0, 3).join(".") : ""),
        itemSel: found.item,
        descendant: found.descendant,
      });
    }

    const { el: container, item, descendant } = found;

    // Get the items and the parent that actually holds them as direct children.
    let itemParent = container;
    let items;
    if (descendant) {
      const firstItem = container.querySelector(item);
      itemParent = firstItem?.parentElement || container;
      items = Array.from(itemParent.children).filter((el) => el.matches(item));
    } else {
      items = Array.from(container.children).filter((el) => el.matches(item));
    }

    if (items.length < 2) {
      LOG("fewer than 2 items, nothing to sort", items.length);
      return;
    }

    isSorting = true;
    try {
      // Stamp original positions on first sight.
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

      const allChildren = Array.from(itemParent.children);
      const slots = allChildren
        .map((el, i) => (el.matches(item) ? i : -1))
        .filter((i) => i !== -1);

      const sortedItems = [...items].sort((a, b) => {
        const ai = parseInt(a.dataset.prrcIndex, 10);
        const bi = parseInt(b.dataset.prrcIndex, 10);
        return order === "newest" ? bi - ai : ai - bi;
      });

      const newChildren = allChildren.slice();
      slots.forEach((slotIdx, k) => {
        newChildren[slotIdx] = sortedItems[k];
      });

      let changed = false;
      for (let i = 0; i < newChildren.length; i++) {
        if (newChildren[i] !== allChildren[i]) { changed = true; break; }
      }
      if (!changed) {
        LOG("already in", order, "order, no DOM changes");
        isSorting = false;
        return;
      }

      for (const el of newChildren) itemParent.appendChild(el);
      LOG("re-ordered", items.length, "items as", order);
    } finally {
      setTimeout(() => { isSorting = false; }, 0);
    }
  }

  function startObserver() {
    const found = findContainer();
    if (!found) return;
    if (observer) observer.disconnect();

    const target = found.descendant
      ? (found.el.querySelector(found.item)?.parentElement || found.el)
      : found.el;

    observer = new MutationObserver((mutations) => {
      if (isSorting) return;
      const structural = mutations.some(
        (m) => m.type === "childList" && (m.addedNodes.length || m.removedNodes.length)
      );
      if (!structural) return;

      observer.disconnect();
      applyOrder(currentOrder);
      observer.observe(target, { childList: true });
    });

    observer.observe(target, { childList: true });
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
      "z-index: 2147483647",
      "padding: 8px 14px",
      "background: #1f6feb",
      "color: #fff",
      "border: 1px solid rgba(255,255,255,0.1)",
      "border-radius: 6px",
      "font: 12px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      "cursor: pointer",
      "box-shadow: 0 2px 8px rgba(0,0,0,0.3)"
    ].join(";");
    updateButtonLabel(btn);

    btn.addEventListener("click", () => {
      currentOrder = currentOrder === "newest" ? "oldest" : "newest";
      chrome.storage.local.set({ [STORAGE_KEY]: currentOrder });
      updateButtonLabel(btn);
      applyOrder(currentOrder);
    });

    document.body.appendChild(btn);
    LOG("toggle button injected");
  }

  function updateButtonLabel(btn) {
    btn.textContent = currentOrder === "newest" ? "↓ Newest first" : "↑ Oldest first";
    btn.title = `Click to switch to ${currentOrder === "newest" ? "oldest" : "newest"} first`;
  }

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local" || !changes[STORAGE_KEY]) return;
    currentOrder = changes[STORAGE_KEY].newValue || "newest";
    const btn = document.getElementById(BUTTON_ID);
    if (btn) updateButtonLabel(btn);
    applyOrder(currentOrder);
  });

  function waitForContainer(callback, timeoutMs = 30000) {
    if (findContainer()) { callback(); return; }
    LOG("waiting for timeline container to appear…");
    const bootObs = new MutationObserver(() => {
      if (findContainer()) {
        bootObs.disconnect();
        callback();
      }
    });
    bootObs.observe(document.body, { childList: true, subtree: true });
    setTimeout(() => bootObs.disconnect(), timeoutMs);
  }

  async function init() {
    LOG("content script loaded on", location.href);
    const stored = await chrome.storage.local.get(STORAGE_KEY);
    currentOrder = stored[STORAGE_KEY] || "newest";
    LOG("initial order:", currentOrder);

    // Inject the button immediately so the user can see the extension is alive,
    // even before the timeline finishes rendering.
    injectToggleButton();

    waitForContainer(() => {
      applyOrder(currentOrder);
      startObserver();
    });
  }

  init();

  document.addEventListener("turbo:render", () => {
    LOG("turbo:render — re-binding");
    activeSelectors = null;
    waitForContainer(() => {
      applyOrder(currentOrder);
      injectToggleButton();
      startObserver();
    });
  });
})();
