# Contributing to Will Abroad Japan

Thank you for taking the time to contribute! This document outlines the development workflow, commit conventions, and code standards used in this project.

---

## Table of Contents

- [Branch Strategy](#branch-strategy)
- [Commit Message Format](#commit-message-format)
- [Pull Request Workflow](#pull-request-workflow)
- [Code Standards](#code-standards)
- [Running Tests Locally](#running-tests-locally)

---

## Branch Strategy

We follow a simplified **Git Flow** with three main branch types:

```
main          ← production-ready code only
  └── develop ← integration branch (optional for large features)
        └── feature/xxx  ← individual feature work
        └── fix/xxx      ← bug fixes
        └── chore/xxx    ← maintenance (deps, config, docs)
```

### Rules

| Branch | Direct push | Requires PR | CI required |
|---|---|---|---|
| `main` | No | Yes | Yes |
| `develop` | No | Yes | Yes |
| `feature/*` | Yes | — | — |
| `fix/*` | Yes | — | — |

### Examples

```bash
# New feature
git checkout -b feature/add-deadline-reminders

# Bug fix
git checkout -b fix/checklist-status-mapping

# Dependency update
git checkout -b chore/update-helmet-to-v8
```

---

## Commit Message Format

We follow the **[Conventional Commits](https://www.conventionalcommits.org/)** specification. This produces a machine-readable git history and enables automatic changelog generation.

### Format

```
<type>(<scope>): <short summary>

[optional body — explain WHY, not WHAT]

[optional footer — e.g., BREAKING CHANGE, Closes #123]
```

### Types

| Type | When to use |
|---|---|
| `feat` | A new feature visible to users |
| `fix` | A bug fix |
| `docs` | Documentation changes only |
| `style` | Code formatting (no logic change) |
| `refactor` | Code restructure without feature/fix |
| `test` | Adding or updating tests |
| `chore` | Maintenance — deps, config, CI |
| `perf` | Performance improvement |
| `security` | Security hardening |

### Scope (optional but recommended)

Use the route or module name: `auth`, `checklist`, `diagnosis`, `simulator`, `backup`, `admin`, `middleware`

### Examples

```
feat(diagnosis): add weight/cap multipliers from admin config

fix(checklist): handle 2-arg db.query call in POST /init

docs: add architecture diagram to README

test(backup): fix done() never called when module cache reset

chore: update express to v5.2.1

security(middleware): add CSRF protection to state-mutating routes

perf(simulator): cache exchange rate response for 1 hour
```

### Breaking Changes

```
feat(auth)!: require email verification on signup

BREAKING CHANGE: Users without verified emails can no longer access protected routes.
Existing users will receive a verification email on next login.
```

---

## Pull Request Workflow

1. **Fork or branch** from `main` (or `develop` if it exists)
2. **Write tests** for new logic before opening the PR
3. **Ensure CI passes** — `npm test` must exit 0
4. **Open a PR** using the [PR template](.github/pull_request_template.md)
5. **Request review** from at least one other contributor
6. **Squash and merge** once approved (keeps git history clean)

---

## Code Standards

### General

- **No `var`** — use `const` by default, `let` only when reassignment is needed
- **Error-first callbacks** for DB queries (following mysql2 convention)
- **Always validate and sanitize** request inputs using `middleware/sanitize.js` helpers:
  - `safeId(req.params.id)` for route ID parameters
  - `safeStr(req.body.field)` for text inputs
  - `safeInt(val, min, max)` for numeric inputs
  - `sanitizeText(html)` / `sanitizeHtml(html)` for user-generated content

### Route Handlers

Keep route files **thin** — business logic should live in service modules:

```js
// Good: route delegates to service
router.get('/backup/list', requireAdmin, (req, res) => {
  const files = listBackups()
  res.json(files)
})

// Avoid: route contains complex logic inline
```

### Database Queries

- Always use **parameterized queries** — never string interpolation
- Use `db.query(sql, [params], callback)` — never `db.query('... ' + userInput)`

```js
// Good
db.query('SELECT * FROM items WHERE user_id = ?', [userId], (err, rows) => { ... })

// Never
db.query(`SELECT * FROM items WHERE user_id = ${userId}`, (err, rows) => { ... })
```

### Error Responses

Use consistent HTTP status codes:

| Situation | Status |
|---|---|
| Success | 200 |
| Created | 201 |
| Bad input (missing/invalid params) | 400 |
| Not authenticated | 401 |
| Forbidden (wrong user) | 403 |
| Resource not found | 404 |
| Conflict (duplicate) | 409 |
| Server / DB error | 500 |

---

## Running Tests Locally

```bash
# All tests
npm test

# Single test file
npx jest tests/routes/checklist.test.js

# Watch mode
npm run test:watch

# Coverage report (opens coverage/index.html)
npm run test:coverage
```

Tests mock all external dependencies (MySQL, node-fetch, fs, child_process) — no real services needed.
