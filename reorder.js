// Pure DOM-reordering helpers, factored out of content.js so they can be
// unit-tested under jsdom without pulling in the chrome.* APIs or the
// content script's mutation-observer machinery.
//
// In the browser this attaches `firstMatchingTarget` and
// `applyOrderToTarget` to the global scope (loaded before content.js).
// Under Node it exports them and pulls ORDER from constants.js.

(function (root, factory) {
  if (typeof module !== "undefined" && module.exports) {
    const { ORDER } = require("./constants.js");
    module.exports = factory(ORDER);
  } else {
    Object.assign(root, factory(root.ORDER));
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function (ORDER) {
  // Try (container, item) pairs in order. For each, prefer items as
  // direct children of the container; fall back to descendant items if
  // the container has at least 2 matching descendants. Returns the first
  // pair that finds 2+ items, or null.
  function firstMatchingTarget(candidates) {
    for (const pair of candidates) {
      const el = document.querySelector(pair.container);
      if (!el) continue;
      const direct = el.querySelectorAll(`:scope > ${pair.item}`);
      if (direct.length >= 2) {
        return { el, item: pair.item, descendant: false };
      }
      const any = el.querySelectorAll(pair.item);
      if (any.length >= 2) {
        return { el, item: pair.item, descendant: true };
      }
    }
    return null;
  }

  // Reverse one specific target's items in place. Preserves the slots
  // of any non-matching siblings.
  function applyOrderToTarget(target, order) {
    const { el: container, item, descendant } = target;

    let itemParent = container;
    let items;
    if (descendant) {
      const firstItem = container.querySelector(item);
      itemParent = firstItem?.parentElement || container;
      items = Array.from(itemParent.children).filter((c) => c.matches(item));
    } else {
      items = Array.from(container.children).filter((c) => c.matches(item));
    }

    if (items.length < 2) return false;

    // Stamp original positions on first sight.
    let nextIndex = 0;
    for (const it of items) {
      const idx = it.dataset.prrcIndex;
      if (idx !== undefined) {
        const n = parseInt(idx, 10);
        if (!Number.isNaN(n) && n >= nextIndex) nextIndex = n + 1;
      }
    }
    for (const it of items) {
      if (it.dataset.prrcIndex === undefined) {
        it.dataset.prrcIndex = String(nextIndex++);
      }
    }

    const allChildren = Array.from(itemParent.children);
    const slots = allChildren.map((c, i) => (c.matches(item) ? i : -1)).filter((i) => i !== -1);

    const sortedItems = [...items].sort((a, b) => {
      const ai = parseInt(a.dataset.prrcIndex, 10);
      const bi = parseInt(b.dataset.prrcIndex, 10);
      return order === ORDER.NEWEST ? bi - ai : ai - bi;
    });

    const newChildren = allChildren.slice();
    slots.forEach((slotIdx, k) => {
      newChildren[slotIdx] = sortedItems[k];
    });

    let changed = false;
    for (let i = 0; i < newChildren.length; i++) {
      if (newChildren[i] !== allChildren[i]) {
        changed = true;
        break;
      }
    }
    if (!changed) return false;

    for (const c of newChildren) itemParent.appendChild(c);
    return true;
  }

  return { firstMatchingTarget, applyOrderToTarget };
});
