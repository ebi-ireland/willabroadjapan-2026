# Will Abroad Japan

[![CI](https://github.com/your-username/willabroadjapan/actions/workflows/ci.yml/badge.svg)](https://github.com/your-username/willabroadjapan/actions/workflows/ci.yml)
[![Node.js](https://img.shields.io/badge/Node.js-18%2B-339933?logo=node.js)](https://nodejs.org)
[![License: ISC](https://img.shields.io/badge/License-ISC-blue.svg)](LICENSE)

**Will Abroad Japan** is a full-stack web platform designed to help Japanese students navigate the overseas university application process — from school discovery and cost simulation to document checklist management and scholarship search.

---

## Table of Contents

- [Features](#features)
- [Architecture](#architecture)
- [Tech Stack & Rationale](#tech-stack--rationale)
- [Security Practices](#security-practices)
- [Getting Started](#getting-started)
- [Running Tests](#running-tests)
- [Environment Variables](#environment-variables)
- [Project Structure](#project-structure)
- [Contributing](#contributing)

---

## Features

| Feature | Description |
|---|---|
| **Admission Diagnosis** | Score-based college match engine with configurable weights and caps |
| **Cost Simulator** | Exchange-rate-aware tuition/living cost estimator |
| **Scholarship Search** | Curated scholarship database with eligibility filtering |
| **Document Checklist** | Per-university task tracker with status/note persistence |
| **Application Deadlines** | Calendar view of submission deadlines by school |
| **University Ranking** | Sortable ranking table with region/field filters |
| **Experience Threads** | Community Q&A board for study-abroad experiences |
| **Admin Dashboard** | Secure admin panel for content, backup, and config management |

---

## Architecture

```
Browser (Vanilla JS + Fetch API)
        │
        ▼
Express.js Server (server.js)
        │
   ┌────┴────────────────────────────────────┐
   │  Security Layer                          │
   │  Helmet · Rate Limiter · Bot Protection  │
   │  CSRF · DOMPurify · Input Sanitizer      │
   └────┬────────────────────────────────────┘
        │
   ┌────┴─────────────────────────────────────┐
   │  Route Handlers  (routes/)               │
   │  auth · diagnosis · checklist · simulator│
   │  scholarships · ranking · articles ...   │
   └────┬─────────────────────────────────────┘
        │
   ┌────┴───────────┐   ┌──────────────────────┐
   │   MySQL (DB)   │   │  External APIs       │
   │   mysql2       │   │  Stripe · Mapbox     │
   └────────────────┘   │  Google OAuth        │
                        └──────────────────────┘

Admin Panel (admin-server.js — separate Express process)
  └── MySQL-backed session store (survives server restarts)
  └── Scheduled DB backup via node-cron + mysqldump (90-day retention)

Offline Data Pipeline (Python · localhost only · never deployed)
  └── Flask-based data entry utilities → JSON → master dataset (xlsx/csv)
```

The main server and admin panel run as **separate Node.js processes** so a crash in the admin panel never affects end-users.

---

## Tech Stack & Rationale

### Runtime & Framework

| Technology | Why chosen |
|---|---|
| **Node.js 18 LTS** | Long-term support, stable ES2022 features, broad npm ecosystem |
| **Express.js 5** | Minimal, well-understood HTTP framework; async error propagation built-in in v5 |
| **mysql2** | Promise/async support, prepared statements prevent SQL injection out of the box |

### Security

| Technology | Why chosen |
|---|---|
| **Helmet** | Sets 15+ HTTP security headers (CSP, HSTS, X-Frame-Options) in one call |
| **express-rate-limit** | Tiered rate limiting — stricter on auth/contact endpoints |
| **DOMPurify + jsdom** | Server-side HTML sanitization; strips XSS payloads from user-submitted content |
| **csrf-csrf** | Double-submit CSRF token pattern for all state-mutating endpoints |
| **passport + Google OAuth 2.0** | Delegates credential storage to Google — no plaintext passwords for social login |

### Reliability & Observability

| Technology | Why chosen |
|---|---|
| **Winston + DailyRotateFile** | Structured JSON logs with automatic daily rotation and retention |
| **node-cron** | Pure-JS cron scheduler for automated MySQL backups (no system cron dependency) |
| **Stripe** | PCI-DSS compliant payment processing; zero card data touches our servers |

### Frontend

Intentionally **no frontend build step** — vanilla JavaScript with native `fetch()` and ES modules. This choice keeps the deployment simple (no webpack/vite in production) while remaining fully debuggable in DevTools without source maps.

---

## Security Practices

- **Parameterized queries** everywhere — no string-concatenated SQL
- **Input sanitization** via `middleware/sanitize.js` (`safeId`, `safeStr`, `safeInt`, `sanitizeHtml`, `sanitizeText`) on all route parameters and request bodies
- **Helmet CSP** with strict allow-lists per resource type
- **Rate limiting** — 100 req/15min general, 10 req/15min auth, 5 req/hour contact
- **Bot protection** on high-value data endpoints (scholarship, ranking)
- **Admin session** backed by MySQL (`admin_sessions` table) — survives server restarts, expires on browser close, auto-logs out after 8-hour inactivity (sleep detection via Page Visibility API)
- **90-day backup retention** with automated `mysqldump` via `services/backup.js`
- **Dependency auditing** — run `npm audit` before each release

---

## Getting Started

### Prerequisites

- Node.js 18+
- MySQL 8.0+

### Installation

```bash
git clone https://github.com/your-username/willabroadjapan.git
cd willabroadjapan
npm install
```

### Database Setup

```bash
mysql -u root -p < db/schema.sql
```

### Environment Variables

Copy the example file and fill in your values:

```bash
cp .env.example .env
```

See [Environment Variables](#environment-variables) for the full list.

### Start Development Servers

```bash
# Main application (port 3000)
npm run dev

# Admin panel (port 3001) — separate terminal
npm run admin
```

---

## Running Tests

Tests use **Jest** with mocked database connections — no real MySQL required.

```bash
# Run all tests
npm test

# Watch mode (re-runs on file save)
npm run test:watch

# Coverage report
npm run test:coverage
```

Coverage report is generated to `coverage/index.html`.

### Test Structure

```
tests/
├── unit/
│   ├── sanitize.test.js       # Input sanitization functions
│   ├── backup.test.js         # Backup service (fs + child_process mocked)
│   └── diagnosis-calc.test.js # Score calculation pure functions
├── routes/
│   ├── checklist.test.js      # Checklist CRUD + status mapping
│   ├── diagnosis.test.js      # Diagnosis endpoints + webhook
│   └── simulator.test.js      # Cost simulation + exchange rate fallback
├── admin/
│   └── auth.test.js           # Admin login/logout/session
└── __mocks__/
    ├── jsdom-mock.js           # Avoids ESM incompatibility with jsdom@29
    └── dompurify-mock.js      # Regex-based DOMPurify substitute for tests
```

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `DB_HOST` | Yes | MySQL host |
| `DB_USER` | Yes | MySQL username |
| `DB_PASSWORD` | Yes | MySQL password |
| `DB_NAME` | Yes | Database name |
| `SESSION_SECRET` | Yes | Express session secret (min 32 chars) |
| `ADMIN_PASSWORD` | Yes | Admin panel password |
| `GOOGLE_CLIENT_ID` | Yes | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Yes | Google OAuth client secret |
| `STRIPE_SECRET_KEY` | Yes | Stripe secret key |
| `MAPBOX_TOKEN` | No | Mapbox access token for maps |
| `DISCORD_WEBHOOK` | No | Discord webhook for general notifications |
| `DISCORD_CONTACT_WEBHOOK` | No | Discord webhook for contact form |
| `BASE_URL` | No | Public base URL (default: `http://localhost:3000`) |
| `NODE_ENV` | No | `development` or `production` |

See `.env.example` for the complete list including all Discord webhook channels.

---

## Project Structure

```
willabroadjapan/
├── server.js               # Main Express app entry point
├── admin-server.js         # Admin panel (separate process)
├── routes/                 # One file per feature domain
│   ├── auth.js             #   Google OAuth + session
│   ├── diagnosis.js        #   College match scoring
│   ├── checklist.js        #   Document checklist CRUD
│   ├── simulator.js        #   Cost calculation
│   ├── scholarships.js     #   Scholarship search
│   ├── ranking.js          #   University rankings
│   ├── articles.js         #   Blog/article content
│   ├── threads.js          #   Community Q&A
│   ├── deadlines.js        #   Application deadlines
│   └── ...
├── middleware/
│   ├── sanitize.js         # Input sanitization helpers
│   ├── rateLimiter.js      # Tiered rate limiting
│   ├── botProtection.js    # Anti-scraping middleware
│   └── logger.js           # Winston structured logger
├── services/
│   └── backup.js           # Scheduled MySQL backup
├── db/
│   └── connection.js       # mysql2 connection pool
├── public/                 # Static frontend (no build step)
│   └── scripts/pages/      # Per-page vanilla JS
├── admin/                  # Admin panel HTML/CSS/JS
├── tests/                  # Jest test suite
├── GetData/                # Offline data pipeline (Python, not deployed)
│   ├── CreateTable/        #   Master dataset generation
│   └── ...                 #   Data entry utilities (Flask, localhost only)
└── .github/
    ├── workflows/ci.yml    # GitHub Actions CI
    └── ISSUE_TEMPLATE/     # Bug report / feature request forms
```

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for:
- Branch strategy
- Commit message format (Conventional Commits)
- Pull request checklist
- Code style guidelines
