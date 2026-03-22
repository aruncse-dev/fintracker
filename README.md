# FinTracker — Personal Finance Tracker

A React PWA that uses **Google Sheets as its database** via Google Apps Script. No server costs, no database to manage — deploy once and track your family finances from any device.

**Live app:** https://aruncse-dev.github.io/fintracker/

---

## Architecture

```
Browser (React PWA — GitHub Pages)
      │
      │  HTTPS fetch (JSON API)
      ▼
Google Apps Script (/exec endpoint)
      │
      │  SpreadsheetApp.*()
      ▼
Google Sheets (your spreadsheet)
  ├── Apr-2026, Mar-2026 …   (one tab per month, auto-created)
  ├── Budget                  (category → monthly target)
  └── Accounts                (account → opening balance)
```

- **Frontend** — React + Vite, deployed to GitHub Pages at `/fintracker/`
- **Backend** — Google Apps Script serves a JSON REST API (`?action=...`)
- **Database** — Google Sheets (data stays in your own spreadsheet)
- **Auth** — Google OAuth implicit flow (id_token) restricted to one email

---

## Features

| Feature | Details |
|---------|---------|
| **Dashboard** | Income / Expense / Savings KPI cards, SVG donut charts, budget overview |
| **Transactions** | Add / edit / delete with filters by type and payment mode |
| **Budget** | Per-category targets with progress bars and over-budget alerts |
| **Credits** | CC spend view on 19th–18th billing cycle (ICICI + HDFC) |
| **Accounts** | Balance tracking across Cash, HDFC Bank, Indian Bank, Wallet |
| **AI Assistant** | Gemini-powered chat for financial insights and quick transaction entry |
| **PWA** | Installable, mobile-optimised |

---

## Setup

### Prerequisites

- Node.js 20+
- [clasp](https://github.com/google/clasp) — `npm install -g @google/clasp`
- A Google account

---

### 1. Google Sheets + Apps Script

1. Create a new blank spreadsheet at [sheets.google.com](https://sheets.google.com)
2. Open **Extensions → Apps Script**
3. Replace `Code.gs` contents with `gas/Code.gs` from this repo
4. Create an HTML file: **File → New → HTML file** → name it `Index` → paste `gas/Index.html`
5. **Deploy → New deployment**
   - Type: **Web app**
   - Execute as: **Me**
   - Who has access: **Anyone** *(required for the React frontend to call it without auth)*
6. Copy the `/exec` URL

---

### 2. Google OAuth Client

1. Go to [console.cloud.google.com](https://console.cloud.google.com) → APIs & Services → Credentials
2. Create an **OAuth 2.0 Client ID** → Application type: **Web application**
3. Add Authorised JavaScript origins:
   - `http://localhost:5173`
   - `https://aruncse-dev.github.io`
4. Add Authorised redirect URIs:
   - `http://localhost:5173/`
   - `https://aruncse-dev.github.io/fintracker/`
5. Copy the **Client ID**

---

### 3. Local development

```bash
cd web
cp .env.example .env
# Fill in all four values in .env
npm install
npm run dev
# App runs at http://localhost:5173/fintracker/
```

**.env values:**

| Variable | Description |
|----------|-------------|
| `VITE_GAS_URL` | Your GAS `/exec` URL |
| `VITE_GOOGLE_CLIENT_ID` | OAuth client ID |
| `VITE_GEMINI_KEY` | Gemini API key (free tier at [aistudio.google.com](https://aistudio.google.com)) |
| `VITE_ALLOWED_EMAIL` | Your Google email — only this account can log in |

The dev server proxies `/gas-proxy` requests to GAS server-side (bypasses CORS).

---

### 4. Deploy to GitHub Pages

1. Fork or push this repo to your GitHub account
2. Go to **Settings → Secrets and variables → Actions** → add the four secrets above
3. Enable **GitHub Pages** → Source: `gh-pages` branch
4. Push to `main` — the workflow builds and deploys automatically

**GitHub Actions secrets needed:**

```
VITE_GAS_URL
VITE_GOOGLE_CLIENT_ID
VITE_GEMINI_KEY
VITE_ALLOWED_EMAIL
```

---

### 5. Redeploy GAS after code changes

```bash
# From repo root (requires clasp login)
./deploy.sh
```

This pushes `gas/Code.gs` and updates the existing deployment in-place. The URL stays the same.

---

## Customising

### Change account names
`gas/Code.gs` → `ACCT_NAMES` array
`web/src/constants.ts` → `ACCOUNTS` array and `TransactionModal.tsx` mode options

### Change credit cards
`web/src/constants.ts` → `CC_MODES` and `OTHER_CR` arrays
`web/src/pages/Credits.tsx` → card labels

### Change billing cycle day
`web/src/components/Nav.tsx` → `CC_CYCLE_DAY`
`web/src/utils.ts` → `currentMonthYear()` uses the same value

### Change budget categories / defaults
`gas/Code.gs` → `_defaultBudgets()` — only applied when Budget sheet is empty

---

## Sheet structure

| Tab | Created when | Columns |
|-----|-------------|---------|
| `Apr-2026`, `Mar-2026` … | First transaction for that month | ID · Date · Description · Amount · Category · Type · Mode · Notes |
| `Budget` | App first loads | Category · Budget |
| `Accounts` | App first loads | Account · Opening Balance |

---

## Tech stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, TypeScript, Vite |
| Hosting | GitHub Pages |
| Backend | Google Apps Script (JSON REST API) |
| Database | Google Sheets |
| Auth | Google OAuth (implicit flow / id_token) |
| AI | Gemini 2.0 Flash Lite (Google AI Studio free tier) |
| Charts | Pure SVG (no chart library) |
| PWA | Web App Manifest + service worker |
