import { describe, it, expect, beforeEach } from "vitest";
import reorder from "../reorder.js";
import constants from "../constants.js";

const { firstMatchingTarget, applyOrderToTarget } = reorder;
const { ORDER } = constants;

beforeEach(() => {
  document.body.innerHTML = "";
});

// Build a container with `n` <li> children plus optional leading/trailing
// non-matching siblings, returning the container element.
function buildList(n, { item = "li", lead = 0, trail = 0 } = {}) {
  const ul = document.createElement("ul");
  for (let i = 0; i < lead; i++) ul.appendChild(el("div", `lead-${i}`));
  for (let i = 0; i < n; i++) ul.appendChild(el(item, `item-${i}`));
  for (let i = 0; i < trail; i++) ul.appendChild(el("div", `trail-${i}`));
  document.body.appendChild(ul);
  return ul;
}

function el(tag, text) {
  const node = document.createElement(tag);
  node.textContent = text;
  return node;
}

const texts = (parent, sel) => Array.from(parent.querySelectorAll(sel)).map((n) => n.textContent);

describe("firstMatchingTarget", () => {
  it("returns null when no candidate container exists", () => {
    expect(firstMatchingTarget([{ container: ".missing", item: "li" }])).toBeNull();
  });

  it("returns null when the container has fewer than 2 matching items", () => {
    buildList(1).classList.add("box");
    expect(firstMatchingTarget([{ container: ".box", item: "li" }])).toBeNull();
  });

  it("matches direct children when 2+ are present", () => {
    const ul = buildList(3);
    ul.classList.add("box");
    const t = firstMatchingTarget([{ container: ".box", item: "li" }]);
    expect(t).toMatchObject({ el: ul, item: "li", descendant: false });
  });

  it("falls back to descendants when direct children don't match", () => {
    const wrapper = document.createElement("section");
    wrapper.className = "box";
    const inner = document.createElement("div");
    inner.appendChild(el("li", "a"));
    inner.appendChild(el("li", "b"));
    wrapper.appendChild(inner);
    document.body.appendChild(wrapper);

    const t = firstMatchingTarget([{ container: ".box", item: "li" }]);
    expect(t).toMatchObject({ el: wrapper, item: "li", descendant: true });
  });

  it("tries candidates in order and returns the first that matches", () => {
    const ul = buildList(2);
    ul.id = "second";
    const t = firstMatchingTarget([
      { container: "#first", item: "li" },
      { container: "#second", item: "li" },
    ]);
    expect(t.el).toBe(ul);
  });
});

describe("applyOrderToTarget", () => {
  it("reverses items for ORDER.NEWEST", () => {
    const ul = buildList(3);
    const changed = applyOrderToTarget({ el: ul, item: "li", descendant: false }, ORDER.NEWEST);
    expect(changed).toBe(true);
    expect(texts(ul, "li")).toEqual(["item-2", "item-1", "item-0"]);
  });

  it("restores original order for ORDER.OLDEST after reversing", () => {
    const ul = buildList(3);
    applyOrderToTarget({ el: ul, item: "li", descendant: false }, ORDER.NEWEST);
    applyOrderToTarget({ el: ul, item: "li", descendant: false }, ORDER.OLDEST);
    expect(texts(ul, "li")).toEqual(["item-0", "item-1", "item-2"]);
  });

  it("returns false when there are fewer than 2 items", () => {
    const ul = buildList(1);
    expect(applyOrderToTarget({ el: ul, item: "li", descendant: false }, ORDER.NEWEST)).toBe(false);
  });

  it("returns false (no-op) when already in the requested order", () => {
    const ul = buildList(3);
    applyOrderToTarget({ el: ul, item: "li", descendant: false }, ORDER.NEWEST);
    const again = applyOrderToTarget({ el: ul, item: "li", descendant: false }, ORDER.NEWEST);
    expect(again).toBe(false);
  });

  it("preserves the slots of non-matching siblings", () => {
    const ul = buildList(3, { lead: 1, trail: 1 });
    applyOrderToTarget({ el: ul, item: "li", descendant: false }, ORDER.NEWEST);
    // Lead/trail <div>s keep their positions; only the <li>s flip.
    expect(Array.from(ul.children).map((n) => n.textContent)).toEqual([
      "lead-0",
      "item-2",
      "item-1",
      "item-0",
      "trail-0",
    ]);
  });

  it("keeps original positions stable across re-stamping (idempotent index)", () => {
    const ul = buildList(3);
    applyOrderToTarget({ el: ul, item: "li", descendant: false }, ORDER.NEWEST);
    // Re-apply oldest twice — index stamps must not drift.
    applyOrderToTarget({ el: ul, item: "li", descendant: false }, ORDER.OLDEST);
    applyOrderToTarget({ el: ul, item: "li", descendant: false }, ORDER.OLDEST);
    expect(texts(ul, "li")).toEqual(["item-0", "item-1", "item-2"]);
  });

  it("reorders descendant items via their actual parent", () => {
    const wrapper = document.createElement("section");
    const inner = document.createElement("div");
    ["a", "b", "c"].forEach((t) => inner.appendChild(el("li", t)));
    wrapper.appendChild(inner);
    document.body.appendChild(wrapper);

    applyOrderToTarget({ el: wrapper, item: "li", descendant: true }, ORDER.NEWEST);
    expect(texts(inner, "li")).toEqual(["c", "b", "a"]);
  });
});
