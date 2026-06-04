// GitHub PR Reverse Comments — content script
//
// Reverses chronological lists on GitHub PR pages so the newest entry
// appears first. Currently supports:
//
//   /owner/repo/pull/N            (Conversation)  — reverse .js-timeline-item
//   /owner/repo/pull/N/commits    (Commits)       — reverse .js-commit-group
//                                                   AND reverse <li> commits
//                                                   within each group
//
// The same toggle preference (newest vs oldest) drives every supported
// page. Non-supported PR sub-tabs (Files Changed, Checks) are ignored.

(() => {
  // STORAGE_KEY and ORDER come from constants.js (loaded first);
  // firstMatchingTarget and applyOrderToTarget come from reorder.js.
  const RESET_VERSION_KEY = "prrcDefaultResetVersion";
  const CURRENT_RESET_VERSION = 1;
  const BUTTON_ID = "pr-reverse-comments-toggle";

  // Per-page configuration. `getTargets()` returns an array of
  //   { el, item, descendant }
  // — one entry per DOM region that should be reversed. Conversation has
  // exactly one (the timeline); Commits has many (the list of date
  // groups, plus the inner <ol> of every individual date group).
  const PAGE_CONFIGS = [
    {
      name: "conversation",
      pathRe: /^\/[^/]+\/[^/]+\/pull\/\d+\/?$/,
      getTargets: () => {
        const candidates = [
          { container: ".js-discussion", item: ".js-timeline-item" },
          {
            container: '[data-testid="issue-viewer-issue-container"]',
            item: '[data-testid^="issue-viewer-comment"]',
          },
          { container: '[data-testid="pr-timeline"]', item: '[data-testid^="pr-timeline-item"]' },
          { container: ".pull-discussion-timeline", item: ".js-timeline-item" },
        ];
        const t = firstMatchingTarget(candidates);
        return t ? [t] : [];
      },
    },
    {
      name: "commits",
      pathRe: /^\/[^/]+\/[^/]+\/pull\/\d+\/commits\/?$/,
      getTargets: () => {
        const targets = [];

        // Modern React-rendered Commits page. Structure (May 2026):
        //   <div data-testid="commits-list">
        //     <div class="prc-Timeline-Timeline-...">              ← Timeline wrapper
        //       <div class="… Timeline-Item …">                    ← day group N
        //         <h3 data-testid="commit-group-title">Commits on …</h3>
        //         <ul data-listview-component="items-list">
        //           <li data-testid="commit-row-item">…</li>       ← commit within day
        //           …
        //         </ul>
        //       </div>
        //       <div class="… Timeline-Item …">…</div>             ← day group N+1
        //       …
        //     </div>
        //   </div>
        //
        // To make "newest first" feel right we have to reverse two
        // levels at once: the .Timeline-Item day groups (so the most
        // recent day moves to the top), AND the <li> commits inside
        // each day's <ul> (so within a day the latest commit is on
        // top). Doing only one of them gives a confusing half-flipped
        // result.
        const commitsList = document.querySelector('[data-testid="commits-list"]');
        if (commitsList) {
          const dayGroups = commitsList.querySelectorAll(".Timeline-Item");

          // 1) Reverse the day groups themselves (only meaningful if 2+).
          if (dayGroups.length >= 2) {
            const dayParent = dayGroups[0].parentElement;
            if (dayParent) {
              targets.push({
                el: dayParent,
                item: ".Timeline-Item",
                descendant: false,
              });
            }
          }

          // 2) Reverse commits within each day's <ul>.
          for (const group of dayGroups) {
            const ul = group.querySelector('ul[data-listview-component="items-list"]');
            if (
              ul &&
              ul.querySelectorAll(':scope > li[data-testid="commit-row-item"]').length >= 2
            ) {
              targets.push({
                el: ul,
                item: 'li[data-testid="commit-row-item"]',
                descendant: false,
              });
            }
          }

          if (targets.length) return targets;
        }

        // Legacy Rails-rendered Commits page: .js-commit-group date
        // groups wrapping per-day ordered lists.
        const groupTarget = firstMatchingTarget([
          { container: ".js-commits-list", item: ".js-commit-group" },
          { container: "#commits_bucket", item: ".js-commit-group" },
        ]);
        if (groupTarget) targets.push(groupTarget);

        for (const group of document.querySelectorAll(".js-commit-group")) {
          const ol = group.querySelector("ol");
          if (ol && ol.querySelectorAll(":scope > li").length >= 2) {
            targets.push({
              el: ol,
              item: ":scope > li",
              descendant: false,
            });
          }
        }

        return targets;
      },
    },
  ];

  let currentOrder = ORDER.NEWEST;
  let isSorting = false;
  let observers = [];
  let activeTargets = []; // [{ el, item, ... }]

  function getCurrentPageConfig() {
    const path = location.pathname;
    return PAGE_CONFIGS.find((c) => c.pathRe.test(path)) || null;
  }

  function onSupportedPage() {
    return getCurrentPageConfig() !== null;
  }

  function applyOrder(order) {
    const cfg = getCurrentPageConfig();
    if (!cfg) return;

    const targets = cfg.getTargets();
    if (!targets.length) return;

    activeTargets = targets;

    isSorting = true;
    try {
      for (const t of targets) applyOrderToTarget(t, order);
    } finally {
      setTimeout(() => {
        isSorting = false;
      }, 0);
    }
  }

  function disconnectObservers() {
    for (const o of observers) o.disconnect();
    observers = [];
  }

  function startObservers() {
    disconnectObservers();
    if (!activeTargets.length) return;

    for (const target of activeTargets) {
      const watch = target.descendant
        ? target.el.querySelector(target.item)?.parentElement || target.el
        : target.el;

      const obs = new MutationObserver((mutations) => {
        if (isSorting) return;
        const structural = mutations.some(
          (m) => m.type === "childList" && (m.addedNodes.length || m.removedNodes.length),
        );
        if (!structural) return;

        disconnectObservers();
        applyOrder(currentOrder);
        startObservers();
      });
      obs.observe(watch, { childList: true });
      observers.push(obs);
    }
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
      "box-shadow: 0 2px 8px rgba(0,0,0,0.3)",
    ].join(";");
    updateButtonLabel(btn);

    btn.addEventListener("click", () => {
      currentOrder = currentOrder === ORDER.NEWEST ? ORDER.OLDEST : ORDER.NEWEST;
      chrome.storage.local.set({ [STORAGE_KEY]: currentOrder });
      updateButtonLabel(btn);
      applyOrder(currentOrder);
    });

    document.body.appendChild(btn);
  }

  function updateButtonLabel(btn) {
    btn.textContent = currentOrder === ORDER.NEWEST ? "↓ Newest first" : "↑ Oldest first";
    btn.title = `Click to switch to ${currentOrder === ORDER.NEWEST ? ORDER.OLDEST : ORDER.NEWEST} first`;
  }

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local" || !changes[STORAGE_KEY]) return;
    currentOrder = changes[STORAGE_KEY].newValue || ORDER.NEWEST;
    const btn = document.getElementById(BUTTON_ID);
    if (btn) updateButtonLabel(btn);
    applyOrder(currentOrder);
  });

  // React to GitHub's soft-navigation by re-applying our work when a
  // fresh target container appears (the old element gets detached and
  // the new one isn't sorted yet).
  let rebindScheduled = false;
  function scheduleRebindIfNeeded() {
    if (rebindScheduled) return;
    rebindScheduled = true;
    queueMicrotask(() => {
      rebindScheduled = false;

      // Off a supported page — tear down everything we put up.
      if (!onSupportedPage()) {
        const btn = document.getElementById(BUTTON_ID);
        if (btn) btn.remove();
        disconnectObservers();
        activeTargets = [];
        return;
      }

      if (!document.getElementById(BUTTON_ID)) {
        injectToggleButton();
      }

      const cfg = getCurrentPageConfig();
      const freshTargets = cfg.getTargets();
      if (!freshTargets.length) return;

      // Compare the new target set to the active one by element identity.
      // If every element matches an active target's element, nothing to do.
      const activeEls = new Set(activeTargets.map((t) => t.el));
      const sameSet =
        freshTargets.length === activeTargets.length &&
        freshTargets.every((t) => activeEls.has(t.el));

      if (sameSet) return;

      activeTargets = [];
      applyOrder(currentOrder);
      startObservers();
    });
  }

  function startBodyWatcher() {
    const bodyObs = new MutationObserver(scheduleRebindIfNeeded);
    bodyObs.observe(document.body, { childList: true, subtree: true });
  }

  async function init() {
    const stored = await chrome.storage.local.get([STORAGE_KEY, RESET_VERSION_KEY]);
    if (stored[RESET_VERSION_KEY] !== CURRENT_RESET_VERSION) {
      await chrome.storage.local.remove(STORAGE_KEY);
      await chrome.storage.local.set({ [RESET_VERSION_KEY]: CURRENT_RESET_VERSION });
      currentOrder = ORDER.NEWEST;
    } else {
      currentOrder = stored[STORAGE_KEY] || ORDER.NEWEST;
    }

    startBodyWatcher();
    if (onSupportedPage()) {
      injectToggleButton();
    }
    scheduleRebindIfNeeded();
  }

  init();

  // Fast paths for the soft-nav events GitHub does fire — avoid waiting
  // for the next DOM mutation tick. The body watcher above is the real
  // safety net; these just shave latency when the events arrive.
  ["turbo:render", "turbo:load", "pjax:end", "soft-nav:end"].forEach((evt) => {
    document.addEventListener(evt, () => {
      activeTargets = [];
      scheduleRebindIfNeeded();
    });
  });
})();
