import { describe, it, expect, beforeEach } from "vitest";
import pages from "../pages.js";

const { getPageConfig } = pages;

beforeEach(() => {
  document.body.innerHTML = "";
});

describe("getPageConfig — path routing", () => {
  it("matches the Conversation page, with and without a trailing slash", () => {
    expect(getPageConfig("/owner/repo/pull/123")?.name).toBe("conversation");
    expect(getPageConfig("/owner/repo/pull/123/")?.name).toBe("conversation");
  });

  it("matches the Commits page, with and without a trailing slash", () => {
    expect(getPageConfig("/owner/repo/pull/123/commits")?.name).toBe("commits");
    expect(getPageConfig("/owner/repo/pull/123/commits/")?.name).toBe("commits");
  });

  it("rejects unsupported PR sub-tabs and other pages", () => {
    expect(getPageConfig("/owner/repo/pull/123/files")).toBeNull();
    expect(getPageConfig("/owner/repo/pull/123/checks")).toBeNull();
    expect(getPageConfig("/owner/repo/pull/123/commits/abc123")).toBeNull();
    expect(getPageConfig("/owner/repo/issues/123")).toBeNull();
    expect(getPageConfig("/owner/repo/pull/not-a-number")).toBeNull();
    expect(getPageConfig("/owner/repo")).toBeNull();
    expect(getPageConfig("/")).toBeNull();
  });
});

describe("conversation targets", () => {
  function buildTimeline(itemCount) {
    const timeline = document.createElement("div");
    timeline.className = "js-discussion";
    for (let i = 0; i < itemCount; i++) {
      const item = document.createElement("div");
      item.className = "js-timeline-item";
      timeline.appendChild(item);
    }
    document.body.appendChild(timeline);
    return timeline;
  }

  it("targets the classic .js-discussion timeline", () => {
    const timeline = buildTimeline(3);
    const targets = getPageConfig("/o/r/pull/1").getTargets();
    expect(targets).toHaveLength(1);
    expect(targets[0]).toMatchObject({ el: timeline, item: ".js-timeline-item" });
  });

  it("falls back to the React issue-viewer container", () => {
    const container = document.createElement("div");
    container.setAttribute("data-testid", "issue-viewer-issue-container");
    for (const id of ["issue-viewer-comment-1", "issue-viewer-comment-2"]) {
      const item = document.createElement("div");
      item.setAttribute("data-testid", id);
      container.appendChild(item);
    }
    document.body.appendChild(container);

    const targets = getPageConfig("/o/r/pull/1").getTargets();
    expect(targets).toHaveLength(1);
    expect(targets[0].el).toBe(container);
  });

  it("adds a target per pushed-commit batch alongside the timeline", () => {
    buildTimeline(2);
    // "added N commits" batch: header + sibling wrapper of .TimelineItem.
    const header = document.createElement("div");
    header.id = "commits-pushed-abc123";
    const wrapper = document.createElement("div");
    for (let i = 0; i < 2; i++) {
      const commit = document.createElement("div");
      commit.className = "TimelineItem";
      wrapper.appendChild(commit);
    }
    document.body.append(header, wrapper);

    const targets = getPageConfig("/o/r/pull/1").getTargets();
    expect(targets).toHaveLength(2);
    expect(targets[1]).toMatchObject({ el: wrapper, item: ".TimelineItem" });
  });

  it("returns no targets on an unrecognized DOM", () => {
    document.body.innerHTML = "<main><p>not a PR timeline</p></main>";
    expect(getPageConfig("/o/r/pull/1").getTargets()).toEqual([]);
  });
});

describe("commits targets — modern React page", () => {
  // Mirrors the May 2026 structure documented in pages.js.
  function buildModernCommitsPage(commitsPerDay) {
    const list = document.createElement("div");
    list.setAttribute("data-testid", "commits-list");
    const timeline = document.createElement("div");
    timeline.className = "prc-Timeline-Timeline-x";
    for (const count of commitsPerDay) {
      const day = document.createElement("div");
      day.className = "Timeline-Item";
      const ul = document.createElement("ul");
      ul.setAttribute("data-listview-component", "items-list");
      for (let i = 0; i < count; i++) {
        const li = document.createElement("li");
        li.setAttribute("data-testid", "commit-row-item");
        ul.appendChild(li);
      }
      day.appendChild(ul);
      timeline.appendChild(day);
    }
    list.appendChild(timeline);
    document.body.appendChild(list);
    return { timeline };
  }

  it("targets the day groups AND each day's multi-commit list", () => {
    const { timeline } = buildModernCommitsPage([2, 3]);
    const targets = getPageConfig("/o/r/pull/1/commits").getTargets();
    // 1 day-group target + 2 per-day list targets.
    expect(targets).toHaveLength(3);
    expect(targets[0]).toMatchObject({ el: timeline, item: ".Timeline-Item" });
  });

  it("skips the day-group target when there is a single day", () => {
    buildModernCommitsPage([2]);
    const targets = getPageConfig("/o/r/pull/1/commits").getTargets();
    expect(targets).toHaveLength(1);
    expect(targets[0].item).toBe('li[data-testid="commit-row-item"]');
  });

  it("skips per-day lists holding fewer than 2 commits", () => {
    buildModernCommitsPage([2, 1]);
    const targets = getPageConfig("/o/r/pull/1/commits").getTargets();
    // Day-group target + only the 2-commit day's list.
    expect(targets).toHaveLength(2);
  });
});

describe("commits targets — legacy Rails page", () => {
  function buildLegacyCommitsPage(commitsPerGroup) {
    const list = document.createElement("div");
    list.className = "js-commits-list";
    for (const count of commitsPerGroup) {
      const group = document.createElement("div");
      group.className = "js-commit-group";
      const ol = document.createElement("ol");
      for (let i = 0; i < count; i++) ol.appendChild(document.createElement("li"));
      group.appendChild(ol);
      list.appendChild(group);
    }
    document.body.appendChild(list);
    return list;
  }

  it("targets the group list and each multi-commit group", () => {
    const list = buildLegacyCommitsPage([2, 3]);
    const targets = getPageConfig("/o/r/pull/1/commits").getTargets();
    expect(targets).toHaveLength(3);
    expect(targets[0]).toMatchObject({ el: list, item: ".js-commit-group" });
  });

  it("skips single-commit groups", () => {
    buildLegacyCommitsPage([2, 1]);
    const targets = getPageConfig("/o/r/pull/1/commits").getTargets();
    expect(targets).toHaveLength(2);
  });

  it("falls through to legacy when a modern commits-list is present but empty", () => {
    const empty = document.createElement("div");
    empty.setAttribute("data-testid", "commits-list");
    document.body.appendChild(empty);
    buildLegacyCommitsPage([2, 2]);

    const targets = getPageConfig("/o/r/pull/1/commits").getTargets();
    expect(targets).toHaveLength(3);
  });

  it("returns no targets on an unrecognized DOM", () => {
    document.body.innerHTML = "<main><p>nothing commit-shaped</p></main>";
    expect(getPageConfig("/o/r/pull/1/commits").getTargets()).toEqual([]);
  });
});
