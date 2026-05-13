# GitHub PR Reverse Comments

Read GitHub Pull Request conversations **newest comment first**.

GitHub shows PR comments oldest-first, so on long-running PRs you have to
scroll to the bottom every time you open the page just to see what's new.
This extension flips the order. The PR description still sits at the top
where you'd expect it; only the conversation timeline gets reversed.

A small button in the bottom-right of every PR page lets you flip between
**Newest first** and **Oldest first**. Your choice is remembered across
page loads.

![Toggle button in bottom-right](https://placehold.co/600x40/1f6feb/ffffff?text=%E2%86%93+Newest+first)

Works in **Chrome**, **Edge**, **Brave**, any other Chromium browser, and
**Firefox 142+**.

---

## Install

### Chrome / Edge / Brave (any Chromium browser)

1. Download this repository — either `git clone` it or click the green
   **Code** button on GitHub and **Download ZIP**, then unzip it somewhere
   permanent (the browser keeps reading the files from disk).
2. Open `chrome://extensions` (or `edge://extensions`, `brave://extensions`).
3. Toggle **Developer mode** on in the top-right corner.
4. Click **Load unpacked** and select the `github-pr-reverse-comments` folder.
5. Open any GitHub Pull Request — you should see a blue **↓ Newest first**
   button in the bottom-right corner, and the newest comment will be at the
   top of the timeline.

### Firefox

Firefox is stricter than Chrome about installing extensions from outside
its official add-on store. You have two paths:

#### Quick: temporary install (resets when you quit Firefox)

1. Go to `about:debugging#/runtime/this-firefox`.
2. Click **Load Temporary Add-on…**.
3. Pick the `manifest.json` file inside the extension folder.

The extension works until you close Firefox.

#### Permanent: install the signed `.xpi` from the Releases page

1. Go to the [Releases page](https://github.com/ShiosOS/github-pr-reverse-comments/releases).
2. Download the `.xpi` file from the latest release.
3. Drag the `.xpi` into a Firefox window — Firefox will prompt to install it
   permanently.

> If no `.xpi` is attached yet, only the zip is available. The zip is for
> Chrome's "Load unpacked" flow, not for Firefox.

---

## How to use it

Once it's installed, you don't have to do anything. Open any Pull Request
on github.com and:

- Newest comment is at the top of the conversation.
- The PR description stays where it always was, above the timeline.
- The **↓ Newest first** button in the bottom-right corner toggles the
  order. Click it to switch to oldest-first; click again to switch back.
- Your preference is saved automatically and applies to every PR you visit.

That's it. No setup, no account, no options page to dig through.

---

## What it does (and doesn't) collect

**Nothing leaves your browser.** The only thing the extension stores is a
single preference value — either `"newest"` or `"oldest"` — saved locally
on your machine. There are no analytics, no network requests, no tracking.

The full list of permissions:

- **storage** — to remember whether you want newest-first or oldest-first.
- **access to github.com pull request pages** — to read and re-order the
  comments visible in the tab. It does not read any other tabs.

---

## Troubleshooting

**The button doesn't appear.** Make sure you're on a Pull Request page
(URL looks like `https://github.com/owner/repo/pull/123`). The extension
only runs on PR pages, not on issues, code views, or the repo home.

**The button appears but clicking it doesn't change anything.** Open the
browser's developer console (F12 → Console) and look for messages starting
with `[PRRC]`. If you see `no matching container/item selector found`,
GitHub has shipped a new design variant the extension doesn't recognize
yet — please [open an issue](https://github.com/ShiosOS/github-pr-reverse-comments/issues)
and paste those console messages so it can be fixed.

**I clicked the button and now I'm stuck on oldest-first.** Click it again
to flip back, or open the extension's popup (toolbar icon) and pick
**Newest first**.

---

## Building / contributing

There is no build step. Every file in this repo is the same file the
browser runs. To make a change, edit the source, reload the extension at
`chrome://extensions` (or re-install the temporary add-on in Firefox), and
refresh a PR page.

| File           | Purpose                                                  |
| -------------- | -------------------------------------------------------- |
| `manifest.json`| Extension definition (Manifest V3, Chrome + Firefox)     |
| `content.js`   | Runs on PR pages; reorders comments, draws the toggle    |
| `popup.html`   | Toolbar popup UI                                         |
| `popup.js`     | Popup behavior; reads/writes saved preference            |

Pull requests welcome.
