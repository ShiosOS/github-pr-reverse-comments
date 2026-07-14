# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Fixed

- Release packaging omitted `checks.js`, so published `.zip`/`.xpi` builds
  shipped without the status-checks helpers the content script depends on.
  The packaged file list is now derived from `manifest.json` (plus popup
  `<script>` tags) instead of being hand-maintained, missing files fail the
  build, and a packaging test verifies the archive contents in CI.
- The status-checks indicator now refreshes when GitHub updates a check's
  label in place (e.g. running → successful) instead of waiting for
  unrelated DOM changes.
- The popup now reflects a preference change made via the in-page toggle
  while it is open.
- A corrupted stored preference value no longer desyncs the toggle label
  from the actual sort order; anything unrecognized falls back to newest.

- Status-word matching in the checks indicator uses word boundaries, so a
  check _named_ e.g. `failover-suite` or `cancellation-service` that passed
  is no longer misreported as failing.

### Added

- Accessible labels (`aria-label`) on the injected toggle button and
  status-checks indicator.
- 128px toolbar icon variants wired into the action icon set.
- The popup follows the browser's light/dark preference instead of always
  rendering dark.

### Changed

- The per-page GitHub DOM selectors moved from `content.js` into a new
  `pages.js` module, and `background.js` became importable under Node —
  both are now covered by unit tests (79 tests total), including the page
  structures for the Conversation, modern Commits, and legacy Commits
  views.
- CI runs on both the minimum supported Node (22) and current (24).

## [1.1.0] - 2026-06-04

### Added

- Reverse the individual commits inside "added N commits" timeline batches on
  the Conversation page, so a batch reads newest-commit-first.
- A status-checks indicator at the top of the conversation that reflects the
  overall check state (passing / failing / running) and scrolls to the checks
  box when clicked.
- Development tooling: ESLint, Prettier, Vitest with coverage gating, JSDoc
  type-checking (`tsc --checkJs`), GitHub Actions CI, CodeQL scanning,
  Dependabot, and a tag-triggered release workflow.
- `LICENSE` file (MIT).

### Changed

- Refactored shared logic into `constants.js`, `reorder.js`, and `checks.js`
  modules with a single source of truth for the storage key and order values.

## [1.0.6] - 2026-05-19

### Added

- Reverse the Commits tab (both the day groups and the commits within each
  day), including the modern React-rendered Commits page.
- Firefox support (Manifest V3, signed `.xpi`).

[Unreleased]: https://github.com/ShiosOS/github-pr-reverse-comments/compare/v1.1.0...HEAD
[1.1.0]: https://github.com/ShiosOS/github-pr-reverse-comments/releases/tag/v1.1.0
[1.0.6]: https://github.com/ShiosOS/github-pr-reverse-comments/releases/tag/v1.0.6
