# GitHub PR Reverse Comments

A small Manifest V3 extension for **Chrome** and **Firefox** that flips the
order of comments on a GitHub Pull Request conversation page so the newest
comments appear first.

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

Clone or download this repository to a folder on disk first, then follow the
instructions for your browser.

### Chrome / Edge / Brave (any Chromium)

1. Open `chrome://extensions` (or `edge://extensions`).
2. Toggle **Developer mode** on (top-right).
3. Click **Load unpacked** and select the `github-pr-reverse-comments` folder.

### Firefox

Firefox only loads unsigned extensions **temporarily** — they vanish on the
next browser restart. To install permanently, the extension has to be signed
through [addons.mozilla.org](https://addons.mozilla.org) (or you run Firefox
Developer Edition / Nightly with `xpinstall.signatures.required` set to
`false` in `about:config`).

1. Open `about:debugging#/runtime/this-firefox`.
2. Click **Load Temporary Add-on…**.
3. Select the `manifest.json` file inside the `github-pr-reverse-comments` folder.

### Confirm it works

Open any GitHub Pull Request — the conversation will reload with the newest
comment at the top, and a floating **↓ Newest first** button will appear in
the bottom-right corner. Click it to flip the order.

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
