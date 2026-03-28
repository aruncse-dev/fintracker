# Savings Module Deployment Guide

## Current Status ✅

**Deployment ID:** `AKfycbwYGkl4TKGj0umO1-Oz6yQ2c15B3j7QH1ZP8yApe_Nksac36Q_PXq8VIupYOhZIV93tLQ`

**URL:** `https://script.google.com/macros/s/AKfycbwYGkl4TKGj0umO1-Oz6yQ2c15B3j7QH1ZP8yApe_Nksac36Q_PXq8VIupYOhZIV93tLQ/exec`

---

## Required Manual Steps

### 1. SET GAS DEPLOYMENT PERMISSIONS (CRITICAL!)

1. Go to https://script.google.com
2. Click "Editor" in the left sidebar
3. Click the deployment selector (top area)
4. Click "Manage deployments" ⚙️
5. Click the edit icon on the latest deployment
6. Change "Who has access" from your email → **"Anyone"**
7. Click "Update"

### 2. Create Savings Sheet

1. Open your **FinanceTrackerAssets** Google Spreadsheet
2. Right-click on a sheet tab
3. Select **Insert 1 sheet**
4. Name it **"Savings"** (exact spelling)
5. Click **Create**

GAS will auto-create headers on first API call.

### 3. Test Locally

```bash
cd web && npm run dev
```

Then click "Savings" in nav → Dashboard should show with grey donut.

---

## Files Deployed

- ✅ `gas/savings.gs` (277 lines) — Full Savings CRUD
- ✅ `gas/Code.gs` (589 lines) — Routing updated
- ✅ `web/src/pages/Savings.tsx` (744 lines) — Dashboard & Transactions
- ✅ `web/src/api.ts` (115 lines) — API methods
- ✅ `web/.env` — VITE_GAS_URL updated
- ✅ `deploy.sh` — Fixed & enhanced

---

## Features

**Dashboard Tab:**
- KPI cards (Total Balance, Income, Expenses)
- 5 Account balance cards
- SVG donut chart with legend

**Transactions Tab:**
- Full-text search
- Filter pills (All/Income/Expense/Transfer)
- Mobile cards + Desktop table
- Add/Edit/Delete modal

---

## Troubleshooting

**"Moved Temporarily" response:**
→ GAS permissions not set. Go to https://script.google.com and set "Who has access" to "Anyone"

**No data showing:**
→ Create "Savings" sheet in FinanceTrackerAssets (exact spelling)

**API 401 Unauthorized:**
→ Check VITE_API_TOKEN in web/.env matches deployment
