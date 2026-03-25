## Summary

<!-- What does this PR do? 1-3 bullet points. -->

-
-

## Motivation

<!-- Why is this change needed? Link to related issue if applicable. -->

Closes #

## Type of Change

<!-- Check all that apply -->

- [ ] `feat` — New feature
- [ ] `fix` — Bug fix
- [ ] `refactor` — Code restructure (no feature/fix)
- [ ] `test` — Tests only
- [ ] `docs` — Documentation only
- [ ] `chore` — Maintenance (deps, config, CI)
- [ ] `security` — Security improvement
- [ ] `perf` — Performance improvement
- [ ] Breaking change (existing functionality changes)

## Changes Made

<!-- List the files changed and what was done. -->

| File | Change |
|---|---|
| `routes/xxx.js` | |
| `tests/routes/xxx.test.js` | |

## Test Plan

<!-- How was this tested? Check all that apply. -->

- [ ] `npm test` passes (all existing tests green)
- [ ] New unit tests added for new logic
- [ ] New integration tests added for new routes/endpoints
- [ ] Manually tested in browser
- [ ] Edge cases covered (empty input, DB error, auth failure)

## Security Checklist

<!-- Check all that apply for changes touching data flow -->

- [ ] User inputs sanitized via `middleware/sanitize.js`
- [ ] DB queries use parameterized statements (no string interpolation)
- [ ] Auth check (`req.user` / `req.session.admin`) present on protected routes
- [ ] No secrets or credentials added to source code
- [ ] Rate limiting considered for new public endpoints

## Screenshots (if UI change)

<!-- Add before/after screenshots for any frontend changes -->

## Notes for Reviewer

<!-- Anything the reviewer should know or look out for -->
