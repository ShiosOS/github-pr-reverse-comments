// background.js is exercised against a stubbed chrome API: the stub is
// installed before the (dynamic) import so the module's synchronous
// listener registration runs against it, exactly as it does in the browser.

import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";

const setIcon = vi.fn(() => Promise.resolve());
const tabsQuery = vi.fn();
const tabsGet = vi.fn();
const fakeEvent = () => ({ addListener: vi.fn() });

const chromeStub = {
  runtime: { onInstalled: fakeEvent(), onStartup: fakeEvent(), lastError: undefined },
  tabs: { onUpdated: fakeEvent(), onActivated: fakeEvent(), query: tabsQuery, get: tabsGet },
  action: { setIcon },
};

let background;

beforeAll(async () => {
  globalThis.chrome = chromeStub;
  background = (await import("../background.js")).default;
});

beforeEach(() => {
  setIcon.mockClear();
  tabsQuery.mockClear();
  tabsGet.mockClear();
  chromeStub.runtime.lastError = undefined;
});

describe("module load", () => {
  it("registers all four event listeners synchronously", () => {
    // MV3 requirement: listeners must attach during worker startup.
    expect(chromeStub.runtime.onInstalled.addListener).toHaveBeenCalledWith(background.syncAllTabs);
    expect(chromeStub.runtime.onStartup.addListener).toHaveBeenCalledWith(background.syncAllTabs);
    expect(chromeStub.tabs.onUpdated.addListener).toHaveBeenCalledWith(background.handleTabUpdated);
    expect(chromeStub.tabs.onActivated.addListener).toHaveBeenCalledWith(
      background.handleTabActivated,
    );
  });
});

describe("isActiveUrl", () => {
  it.each([
    "https://github.com/owner/repo/pull/1",
    "https://github.com/owner/repo/pull/123/",
    "https://github.com/owner/repo/pull/123?diff=split",
    "https://github.com/owner/repo/pull/123#issuecomment-1",
    "https://github.com/owner/repo/pull/123/commits",
    "https://github.com/owner/repo/pull/123/commits/?page=2",
  ])("accepts %s", (url) => {
    expect(background.isActiveUrl(url)).toBe(true);
  });

  it.each([
    "https://github.com/owner/repo/pull/123/files",
    "https://github.com/owner/repo/pull/123/checks",
    "https://github.com/owner/repo/pull/123/commits/abc123",
    "https://github.com/owner/repo/issues/123",
    "https://github.com/owner/repo",
    "https://github.com/owner/repo/pulls",
    "http://github.com/owner/repo/pull/1", // not https
    "https://example.com/owner/repo/pull/1", // not github.com
    "https://github.evil.example/owner/repo/pull/1",
    undefined,
    42,
  ])("rejects %s", (url) => {
    expect(background.isActiveUrl(url)).toBe(false);
  });
});

describe("setIconForTab", () => {
  it("sets the active icon set on PR pages", () => {
    background.setIconForTab(7, "https://github.com/o/r/pull/1");
    expect(setIcon).toHaveBeenCalledWith({
      tabId: 7,
      path: { 16: "icon-16.png", 48: "icon-48.png", 128: "icon-128.png" },
    });
  });

  it("sets the disabled icon set elsewhere (including unknown URLs)", () => {
    background.setIconForTab(7, undefined);
    expect(setIcon).toHaveBeenCalledWith({
      tabId: 7,
      path: {
        16: "icon-16-disabled.png",
        48: "icon-48-disabled.png",
        128: "icon-128-disabled.png",
      },
    });
  });

  it("swallows setIcon rejections (tab closed mid-flight)", async () => {
    setIcon.mockImplementationOnce(() => Promise.reject(new Error("No tab with id")));
    background.setIconForTab(9, "https://github.com/o/r/pull/1");
    // Must not surface as an unhandled rejection.
    await new Promise((r) => setTimeout(r, 0));
  });
});

describe("handleTabUpdated", () => {
  it("updates on URL change", () => {
    background.handleTabUpdated(1, { url: "https://github.com/o/r/pull/2" }, { id: 1 });
    expect(setIcon).toHaveBeenCalledTimes(1);
  });

  it("updates on load completion using the tab's URL", () => {
    background.handleTabUpdated(1, { status: "complete" }, { url: "https://github.com/o/r" });
    expect(setIcon).toHaveBeenCalledTimes(1);
  });

  it("ignores unrelated updates (e.g. title changes)", () => {
    background.handleTabUpdated(1, { title: "New title" }, { id: 1 });
    expect(setIcon).not.toHaveBeenCalled();
  });
});

describe("handleTabActivated", () => {
  it("looks the tab up and sets its icon", () => {
    tabsGet.mockImplementation((tabId, cb) => cb({ id: tabId, url: "https://github.com/o/r" }));
    background.handleTabActivated({ tabId: 3 });
    expect(tabsGet).toHaveBeenCalledWith(3, expect.any(Function));
    expect(setIcon).toHaveBeenCalledTimes(1);
  });

  it("bails out when the tab is already gone (runtime.lastError)", () => {
    tabsGet.mockImplementation((tabId, cb) => {
      chromeStub.runtime.lastError = { message: "No tab with id" };
      cb(undefined);
    });
    background.handleTabActivated({ tabId: 3 });
    expect(setIcon).not.toHaveBeenCalled();
  });
});

describe("syncAllTabs", () => {
  it("sets the icon for every open tab", () => {
    tabsQuery.mockImplementation((_filter, cb) =>
      cb([
        { id: 1, url: "https://github.com/o/r/pull/1" },
        { id: 2, url: "https://example.com" },
      ]),
    );
    background.syncAllTabs();
    expect(setIcon).toHaveBeenCalledTimes(2);
  });
});
