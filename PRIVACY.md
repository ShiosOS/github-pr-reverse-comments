# Privacy Policy — GitHub PR Reverse Comments

Last updated: 2026-08-17

## Summary

This extension collects nothing. No data is transmitted anywhere, and no data
is shared with or sold to anyone.

## What the extension stores

One value, on your own machine, through the browser's `storage` API: your
chosen comment order, either `"newest"` or `"oldest"`. That is the entire set
of data the extension writes. It exists so the order you picked still applies
the next time you open a pull request.

If you sync extension data through your browser account, that single preference
value may sync between your own devices via your browser vendor's sync service.
Nothing is sent to the extension author.

## What the extension does not do

- No analytics, telemetry, crash reporting, or usage tracking.
- No network requests of any kind. The extension makes no outbound connections.
- No reading, storing, or transmitting of pull request content, comments, code,
  account details, or browsing history.
- No advertising, and no sale or transfer of user data to third parties.
- No remote code. All JavaScript that runs is included in the published
  extension package.

## Site access

The extension runs only on GitHub pull request pages — URLs matching
`https://github.com/*/*/pull/*`. On those pages it reads the page's own DOM in
order to re-order the comment timeline and the commit list inside your browser
tab. That page content is never copied, stored, or sent anywhere; it is only
re-arranged on screen. The extension has no access to any other website or tab.

## Permissions

- **`storage`** — stores the single `"newest"` / `"oldest"` preference locally.
- **`https://github.com/*` host access** — required to inject the content
  script that re-orders GitHub pull request pages.

## Source code

The extension is open source and can be audited in full:
https://github.com/ShiosOS/github-pr-reverse-comments

## Contact

Questions or concerns: please open an issue at
https://github.com/ShiosOS/github-pr-reverse-comments/issues
