// @ts-check
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
  const CHECKS_STATUS_ID = "pr-reverse-comments-checks-status";

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
        const targets = t ? [t] : [];

        // The batch as a whole is one .js-timeline-item (reversed by the
        // target above); also reverse the individual commits inside each
        // "added N commits" batch so they read newest-first too.
        targets.push(...pushedCommitTargets());

        return targets;
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
  /** @type {MutationObserver[]} */
  let observers = [];
  /** @type {PrrcTarget[]} */
  let activeTargets = []; // [{ el, item, ... }]

  function getCurrentPageConfig() {
    const path = location.pathname;
    return PAGE_CONFIGS.find((c) => c.pathRe.test(path)) || null;
  }

  function onSupportedPage() {
    return getCurrentPageConfig() !== null;
  }

  /** @param {string} order */
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

  // Where to put the checks indicator: at the very top of the conversation
  // column, above the PR description. We insert *before* one of these
  // anchors within its parent.
  function getChecksIndicatorAnchor() {
    const candidates = [
      '[data-testid="issue-viewer-issue-container"] [data-testid="pr-timeline"]',
      ".js-discussion",
      ".pull-discussion-timeline",
    ];
    for (const sel of candidates) {
      const el = document.querySelector(sel);
      if (el && el.parentElement) return el;
    }
    return null;
  }

  function scrollToChecksBox() {
    const box = /** @type {HTMLElement | null} */ (findChecksBox());
    if (!box) return;
    box.scrollIntoView({ behavior: "smooth", block: "center" });
    box.style.outline = "2px solid #1f6feb";
    box.style.borderRadius = "6px";
    setTimeout(() => {
      box.style.outline = "";
    }, 1500);
  }

  function injectOrUpdateChecksIndicator() {
    const existing = document.getElementById(CHECKS_STATUS_ID);
    const cfg = getCurrentPageConfig();
    if (!cfg || cfg.name !== "conversation") {
      if (existing) existing.remove();
      return;
    }

    const anchor = getChecksIndicatorAnchor();
    if (!findChecksBox() || !anchor || !anchor.parentElement) {
      if (existing) existing.remove();
      return;
    }

    const state = deriveChecksState(getCheckLabels());
    const indicator = /** @type {HTMLButtonElement} */ (
      existing || document.createElement("button")
    );
    if (!existing) {
      indicator.id = CHECKS_STATUS_ID;
      indicator.type = "button";
      indicator.style.cssText = [
        "display: inline-block",
        "margin: 8px 0 12px 0",
        "padding: 6px 10px",
        "background: var(--bgColor-muted, #f6f8fa)",
        "border-radius: 6px",
        "font: 12px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        "cursor: pointer",
      ].join(";");
      indicator.title = "Click to jump to the PR status checks";
      indicator.addEventListener("click", scrollToChecksBox);
    }

    // Only write to the DOM when the status actually changed; otherwise the
    // body MutationObserver that calls us would see our own text/style
    // mutations and reschedule forever.
    if (indicator.dataset.prrcState !== state.key) {
      indicator.dataset.prrcState = state.key;
      indicator.textContent = state.label;
      indicator.style.border = `1px solid ${state.color}`;
      indicator.style.color = state.color;
      // The visible label leans on color and a glyph (✓/✗/•); spell the
      // status out for assistive tech.
      indicator.setAttribute("aria-label", `PR status checks: ${state.key}. Jump to checks`);
    }

    if (indicator !== anchor.previousElementSibling) {
      anchor.parentElement.insertBefore(indicator, anchor);
    }
  }

  /** @param {HTMLElement} btn */
  function updateButtonLabel(btn) {
    const next = currentOrder === ORDER.NEWEST ? ORDER.OLDEST : ORDER.NEWEST;
    btn.textContent = currentOrder === ORDER.NEWEST ? "↓ Newest first" : "↑ Oldest first";
    btn.title = `Click to switch to ${next} first`;
    // The arrow glyph is decorative; give assistive tech a plain-text label.
    btn.setAttribute("aria-label", `Comment order: ${currentOrder} first. Switch to ${next} first`);
  }

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local" || !changes[STORAGE_KEY]) return;
    currentOrder = normalizeOrder(changes[STORAGE_KEY].newValue);
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
        const checks = document.getElementById(CHECKS_STATUS_ID);
        if (checks) checks.remove();
        disconnectObservers();
        activeTargets = [];
        return;
      }

      if (!document.getElementById(BUTTON_ID)) {
        injectToggleButton();
      }
      injectOrUpdateChecksIndicator();

      const cfg = getCurrentPageConfig();
      if (!cfg) return;
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
    // aria-label is watched because GitHub updates a check row's label in
    // place (e.g. "in progress" -> "successful") without any structural
    // mutation; without it the checks indicator would go stale until some
    // unrelated DOM churn happened to fire the observer.
    bodyObs.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["aria-label"],
    });
  }

  async function init() {
    const stored = await chrome.storage.local.get([STORAGE_KEY, RESET_VERSION_KEY]);
    if (stored[RESET_VERSION_KEY] !== CURRENT_RESET_VERSION) {
      await chrome.storage.local.remove(STORAGE_KEY);
      await chrome.storage.local.set({ [RESET_VERSION_KEY]: CURRENT_RESET_VERSION });
      currentOrder = ORDER.NEWEST;
    } else {
      currentOrder = normalizeOrder(stored[STORAGE_KEY]);
    }

    startBodyWatcher();
    if (onSupportedPage()) {
      injectToggleButton();
      injectOrUpdateChecksIndicator();
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
