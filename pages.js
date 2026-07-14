// @ts-check
// Per-page target configuration: which URL paths the extension acts on and
// which DOM regions get reversed there. This is where all the GitHub DOM
// selectors live — the part most likely to break when GitHub ships a UI
// change — so it is factored out of content.js and unit-tested under jsdom
// with fixtures mirroring the real page structures.
//
// `getTargets()` returns an array of { el, item, descendant } — one entry
// per DOM region that should be reversed. Conversation has one (the
// timeline) plus one per "added N commits" batch; Commits has many (the
// list of date groups, plus the inner list of every individual date group).
//
// Browser: attaches getPageConfig to the global scope (loaded after
// reorder.js, before content.js). Node: exports it for tests.

(function (root, factory) {
  if (typeof module !== "undefined" && module.exports) {
    const { firstMatchingTarget, pushedCommitTargets } = require("./reorder.js");
    module.exports = factory(firstMatchingTarget, pushedCommitTargets);
  } else {
    const r = /** @type {*} */ (root);
    Object.assign(root, factory(r.firstMatchingTarget, r.pushedCommitTargets));
  }
})(
  typeof globalThis !== "undefined" ? globalThis : this,
  function (
    /** @type {(candidates: { container: string; item: string }[]) => PrrcTarget | null} */
    firstMatchingTarget,
    /** @type {(root?: ParentNode) => PrrcTarget[]} */
    pushedCommitTargets,
  ) {
    /** @type {PrrcPageConfig[]} */
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
            {
              container: '[data-testid="pr-timeline"]',
              item: '[data-testid^="pr-timeline-item"]',
            },
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
          /** @type {PrrcTarget[]} */
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

    // The config whose pathRe matches the given location.pathname, or null
    // on unsupported pages (Files Changed, Checks, issues, everything else).
    /** @param {string} pathname */
    function getPageConfig(pathname) {
      return PAGE_CONFIGS.find((c) => c.pathRe.test(pathname)) || null;
    }

    return { getPageConfig };
  },
);
