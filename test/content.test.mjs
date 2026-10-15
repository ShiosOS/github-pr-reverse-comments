import { readFileSync } from "node:fs";
import { JSDOM } from "jsdom";
import { afterEach, describe, expect, it } from "vitest";

const scripts = ["constants.js", "reorder.js", "checks.js", "pages.js", "content.js"].map((name) =>
  readFileSync(name, "utf8"),
);
let dom;
let observers = [];
afterEach(() => {
  observers.forEach((observer) => observer.disconnect());
  observers = [];
  dom?.window.close();
});
const settle = () => new Promise((resolve) => setTimeout(resolve, 20));

async function openPage(html, { stored = {}, beforeRead = () => {} } = {}) {
  dom = new JSDOM(html, { url: "https://github.com/o/r/pull/1", runScripts: "outside-only" });
  const { window } = dom;
  const NativeObserver = window.MutationObserver;
  window.MutationObserver = class extends NativeObserver {
    constructor(callback) {
      super(callback);
      observers.push(this);
    }
  };
  const values = { prrcDefaultResetVersion: 1, ...stored };
  window.chrome = {
    storage: {
      local: {
        get: async () => {
          await beforeRead(window);
          return { ...values };
        },
        set: async (next) => Object.assign(values, next),
        remove: async (key) => delete values[key],
      },
      onChanged: { addListener() {} },
    },
  };
  scripts.forEach((script) => window.eval(script));
  await settle();
  return window;
}
const ids = (parent) => [...parent.children].map((child) => child.id);

describe("content script lifecycle", () => {
  it("reorders commits loaded inside an existing pushed-commit batch", async () => {
    const window = await openPage(`
      <div class="js-discussion">
        <div class="js-timeline-item" id="first"></div>
        <div class="js-timeline-item" id="second">
          <div id="commits-pushed-abc"></div><div id="batch">
            <div class="TimelineItem" id="a"></div><div class="TimelineItem" id="b"></div>
          </div>
        </div>
      </div>`);
    const batch = window.document.getElementById("batch");
    expect(ids(batch)).toEqual(["b", "a"]);
    batch.insertAdjacentHTML("beforeend", '<div class="TimelineItem" id="c"></div>');
    await settle();
    expect(ids(batch)).toEqual(["c", "b", "a"]);
    window.document.getElementById("pr-reverse-comments-toggle").click();
    expect(ids(batch)).toEqual(["a", "b", "c"]);
  });

  it("binds a replacement inner timeline even when its outer container is retained", async () => {
    const window = await openPage(`<div class="js-discussion"><section id="inner">
      <div class="js-timeline-item" id="a"></div><div class="js-timeline-item" id="b"></div>
    </section></div>`);
    window.document.getElementById("inner").outerHTML = `<section id="inner">
      <div class="js-timeline-item" id="c"></div><div class="js-timeline-item" id="d"></div>
    </section>`;
    await settle();
    expect(ids(window.document.getElementById("inner"))).toEqual(["d", "c"]);
  });

  it("handles new timeline entries immediately after a toggle", async () => {
    const window = await openPage(`<div class="js-discussion">
      <div class="js-timeline-item" id="a"></div><div class="js-timeline-item" id="b"></div>
    </div>`);
    const button = window.document.getElementById("pr-reverse-comments-toggle");
    button.click();
    button.click();
    window.document
      .querySelector(".js-discussion")
      .insertAdjacentHTML("beforeend", '<div class="js-timeline-item" id="c"></div>');
    await settle();
    expect(ids(window.document.querySelector(".js-discussion"))).toEqual(["c", "b", "a"]);
  });

  it("removes controls on unsupported soft navigation and rebinds on return", async () => {
    const window = await openPage(`<div class="js-discussion">
      <div class="js-timeline-item" id="a"></div><div class="js-timeline-item" id="b"></div>
    </div>`);
    window.history.pushState({}, "", "/o/r/pull/1/files");
    window.document.dispatchEvent(new window.Event("turbo:load"));
    await settle();
    expect(window.document.getElementById("pr-reverse-comments-toggle")).toBeNull();
    window.history.pushState({}, "", "/o/r/pull/1");
    window.document.dispatchEvent(new window.Event("turbo:load"));
    await settle();
    expect(window.document.getElementById("pr-reverse-comments-toggle")).not.toBeNull();
    expect(ids(window.document.querySelector(".js-discussion"))).toEqual(["b", "a"]);
  });
  it("updates check labels in place without observing its own DOM writes forever", async () => {
    const window = await openPage(`<main><div class="js-discussion">
      <div class="js-timeline-item" id="a"></div><div class="js-timeline-item" id="b"></div>
    </div></main><div class="MergeBox-module__mergePartialContainer__x">
      <ul><li aria-label="ci in progress"></li></ul>
    </div>`);
    const indicator = window.document.getElementById("pr-reverse-comments-checks-status");
    expect(indicator.textContent).toContain("running");
    window.document.querySelector("li").setAttribute("aria-label", "ci successful in 2m");
    await settle();
    expect(indicator.textContent).toContain("passing");
    let changes = 0;
    const observer = new window.MutationObserver(() => changes++);
    observer.observe(window.document.body, { subtree: true, childList: true, attributes: true });
    await settle();
    expect(changes).toBe(0);
  });
  it("waits for the saved preference before handling early navigation events", async () => {
    const window = await openPage(
      `<div class="js-discussion">
      <div class="js-timeline-item" id="a"></div><div class="js-timeline-item" id="b"></div>
    </div>`,
      {
        stored: { prCommentOrder: "oldest" },
        beforeRead: async (window) => {
          await Promise.resolve();
          window.document.dispatchEvent(new window.Event("turbo:load"));
          await settle();
        },
      },
    );
    await settle();
    const button = window.document.getElementById("pr-reverse-comments-toggle");
    expect(button.textContent).toBe("↑ Oldest first");
    expect(ids(window.document.querySelector(".js-discussion"))).toEqual(["a", "b"]);
    button.click();
    expect(button.textContent).toBe("↓ Newest first");
    expect(ids(window.document.querySelector(".js-discussion"))).toEqual(["b", "a"]);
  });
});
