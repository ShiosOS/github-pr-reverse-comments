# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
