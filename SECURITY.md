# Security Policy

## Supported versions

Only the latest released version of the extension is supported. Please
update before reporting an issue.

## Reporting a vulnerability

Please **do not** open a public issue for security problems.

Instead, report privately via GitHub's
[private vulnerability reporting](https://github.com/ShiosOS/github-pr-reverse-comments/security/advisories/new)
("Report a vulnerability" under the **Security** tab). You can expect an
initial response within a few days.

## Scope

This is a client-side browser extension. It requests only the `storage`
permission and access to `github.com` pull request pages, stores a single
local preference (`"newest"` or `"oldest"`), and makes no network requests.

Relevant reports include, for example: a way for a malicious page to run
code in the extension's context, exfiltrate the stored preference, or abuse
the `github.com` host permission. Please include the affected version, the
browser, and reproduction steps.
