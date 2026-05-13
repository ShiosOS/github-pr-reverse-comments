# GitHub PR Reverse Comments

A small Chrome (Manifest V3) extension that flips the order of comments on a
GitHub Pull Request conversation page so the newest comments appear first.

## Features

- Reverses the children of `.js-discussion` on any `https://github.com/*/*/pull/*` page.
- Re-applies the order when GitHub lazily loads more comments, using a
  `MutationObserver` with a re-entrancy flag so it never loops on its own writes.
- Floating toggle button in the bottom-right of the page to flip between
  **Newest first** and **Oldest first**.
- Preference is persisted in `chrome.storage.local`, so it survives reloads and
  syncs between the content script and the popup.
- Optional toolbar popup for switching the order without opening a PR.

## Install as an unpacked extension

1. Clone or download this repository to a folder on disk.
2. Open Chrome and navigate to `chrome://extensions`.
3. Toggle **Developer mode** on (top-right).
4. Click **Load unpacked** and select the `github-pr-reverse-comments` folder.
5. Open any GitHub Pull Request — the conversation will reload with the newest
   comment at the top, and a floating **↓ Newest first** button will appear in
   the bottom-right corner. Click it to flip the order.

> Note: The manifest references `icon.png`. If you don't ship an icon, either
> add a 128×128 PNG named `icon.png` next to `manifest.json` or remove the
> `icons` block from `manifest.json` before loading.

## Files

| File           | Purpose                                                |
| -------------- | ------------------------------------------------------ |
| `manifest.json`| Manifest V3 extension definition                       |
| `content.js`   | Runs on PR pages; sorts comments and injects the toggle|
| `popup.html`   | Toolbar popup UI                                       |
| `popup.js`     | Popup behaviour; reads/writes `chrome.storage.local`   |

## How it works

The content script captures the original DOM position of every `.js-discussion`
child the first time it sees it (stored on a `data-prrc-index` attribute), then
sorts by that index in the requested direction. Because the original order is
preserved on the element itself, repeated re-sorts after dynamic inserts are
stable and idempotent.

To avoid infinite observer loops, the script sets an `isSorting` flag and
disconnects the observer around its own DOM writes, reconnecting once they
settle.
