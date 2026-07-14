# GitHub PR Reverse Comments

Read GitHub Pull Request conversations **newest comment first**.

GitHub shows PR comments oldest-first, so on long-running PRs you have to
scroll to the bottom every time you open the page just to see what's new.
This extension flips the order. The PR description still sits at the top
where you'd expect it; only the conversation timeline gets reversed.

A small button in the bottom-right of every PR page lets you flip between
**Newest first** and **Oldest first**. Your choice is remembered across
page loads. When a PR has status checks, an indicator at the top of the
conversation shows their overall state and jumps to the checks box.

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

1. Go to the [latest release](https://github.com/ShiosOS/github-pr-reverse-comments/releases/latest).
2. Download the file ending in `.xpi` (e.g. `github-pr-reverse-comments-1.1.0.xpi`).
3. Drag the downloaded `.xpi` into a Firefox window. Firefox will show a
   permission prompt — click **Add** to install it permanently.

The `.xpi` is signed by Mozilla, so Firefox treats it the same way it would
treat anything installed from addons.mozilla.org.

---

## How to use it

Once it's installed, you don't have to do anything. Open any Pull Request
on github.com and:

- Newest comment is at the top of the conversation.
- The PR description stays where it always was, above the timeline.
- If the PR has status checks, a status indicator near the top shows
  their overall state (passing / failing / running). Click it to jump
  to the checks box.
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

**The button appears but clicking it doesn't change anything.** GitHub has
likely shipped a new design variant whose timeline/commit containers the
extension doesn't recognize yet — please
[open an issue](https://github.com/ShiosOS/github-pr-reverse-comments/issues)
with the PR URL so the selectors can be updated.

**I clicked the button and now I'm stuck on oldest-first.** Click it again
to flip back, or open the extension's popup (toolbar icon) and pick
**Newest first**.

---

## Building / contributing

There is **no build step for the shipped extension** — the browser runs the
source files in this repo as-is. To make a change, edit the source, reload
the extension at `chrome://extensions` (or re-install the temporary add-on
in Firefox), and refresh a PR page.

| File            | Purpose                                               |
| --------------- | ----------------------------------------------------- |
| `manifest.json` | Extension definition (Manifest V3, Chrome + Firefox)  |
| `constants.js`  | Shared constants (storage key, order values)          |
| `reorder.js`    | Pure DOM-reordering helpers (unit-tested)             |
| `checks.js`     | PR status-checks detection helpers (unit-tested)      |
| `content.js`    | Runs on PR pages; reorders comments, draws the toggle |
| `background.js` | Keeps the toolbar icon in sync with the current tab   |
| `popup.html`    | Toolbar popup UI                                      |
| `popup.js`      | Popup behavior; reads/writes saved preference         |

### Dev tooling (optional)

Linting, formatting, and tests use Node and are **not** required to run the
extension — they only help when contributing.

```sh
npm install      # install dev dependencies
npm run lint     # ESLint
npm run format   # Prettier (writes)
npm run typecheck # tsc --checkJs over the extension sources
npm test         # Vitest unit tests (reorder, checks, constants, packaging)
npm run build    # produce the .zip / .xpi (version read from manifest.json)
```

Pull requests welcome.
