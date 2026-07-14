// Ambient declarations for the symbols shared across content scripts.
//
// constants.js / reorder.js / checks.js / pages.js attach these to the
// global scope (the extension injects them into one shared world), and
// content.js reads them as bare globals. Declaring them here lets
// `tsc --checkJs` verify content.js without each file having to import
// the others.

type PrrcOrder = "newest" | "oldest";

interface PrrcTarget {
  el: Element;
  item: string;
  descendant: boolean;
}

interface PrrcPageConfig {
  name: string;
  pathRe: RegExp;
  getTargets(): PrrcTarget[];
}

interface PrrcChecksState {
  key: "failing" | "running" | "passing" | "unknown";
  label: string;
  color: string;
}

// constants.js — declared with `var` so they also appear on `globalThis`
// (the UMD modules read `globalThis.ORDER`).
declare var STORAGE_KEY: string;
declare var ORDER: { NEWEST: "newest"; OLDEST: "oldest" };
declare function normalizeOrder(value: unknown): PrrcOrder;

// reorder.js
declare function firstMatchingTarget(
  candidates: { container: string; item: string }[],
): PrrcTarget | null;
declare function pushedCommitTargets(root?: ParentNode): PrrcTarget[];
declare function applyOrderToTarget(target: PrrcTarget, order: string): boolean;

// pages.js
declare function getPageConfig(pathname: string): PrrcPageConfig | null;

// checks.js
declare function findChecksBox(root?: ParentNode): Element | null;
declare function getCheckLabels(root?: ParentNode): string[];
declare function deriveChecksState(labels: string[] | string): PrrcChecksState;
