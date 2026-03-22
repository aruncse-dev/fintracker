# FinTracker — Troubleshooting

---

## ⚠ "GAS access restricted" / HTML response instead of JSON

### Symptom
App shows:
> `GAS access restricted — go to script.google.com → Deploy → Manage deployments → set "Who has access" to Anyone`

Or in the network tab, the `/gas-proxy` or GAS `/exec` URL returns an HTML login page (`<!doctype html>`) instead of `{"ok":true,...}`.

### Root cause (fixed)
`appsscript.json` had `"access": "ANYONE"` — but in the Apps Script API enum, `ANYONE` means **"Any logged-in Google user"** (i.e. "Anyone with Google account"). The correct value for truly public access is `ANYONE_ANONYMOUS`.

**This is now fixed permanently.** `appsscript.json` uses `"access": "ANYONE_ANONYMOUS"` so every deploy automatically has public access — no manual UI change needed.

### Verify it's fixed
```bash
curl -sL "https://script.google.com/macros/s/AKfycbwKUQFS42Snl_DlXl1A4xk_D4HSThuTdiqd2DEtlTaX5PkkJ5Ia3ex9wHR_qpW_FfikXQ/exec?action=init" | head -c 50
# Should return: {"ok":true,"data":{"months":[...
# NOT: <!doctype html>...
```

---

## ⚠ "GAS not deployed" error

### Symptom
App shows:
> `GAS not deployed — run ./deploy.sh`

### Cause
The GAS `/exec` URL returned HTML that is **not** the Google login page — likely the Apps Script editor's default landing page. This means `Code.gs` has never been pushed, or the deployment ID in `deploy.sh` is wrong.

### Fix
```bash
./deploy.sh
```
Then check the access setting as described above.

---

## ⚠ CORS error in local dev

### Symptom
Browser console shows:
```
Access to fetch ... has been blocked by CORS policy
```

### Cause
The Vite dev proxy (`/gas-proxy`) was not running, or the `VITE_GAS_URL` in `web/.env` is missing/wrong.

### Fix
1. Check `web/.env` has `VITE_GAS_URL=https://script.google.com/macros/s/.../exec`
2. Restart the dev server: `cd web && npm run dev`

The dev server proxies `/gas-proxy` requests to GAS server-side via Node.js (no CORS restriction). This only works in development; production uses the GAS URL directly.

---

## ⚠ "Access denied: yourname@gmail.com" on login

### Symptom
After Google OAuth, the app shows an "Access denied" alert.

### Cause
`VITE_ALLOWED_EMAIL` doesn't match the Google account used to log in, or the secret is not set in GitHub Actions.

### Fix — local dev
Check `web/.env`:
```
VITE_ALLOWED_EMAIL=aruncse17@gmail.com
```

### Fix — GitHub Pages
Go to **github.com/aruncse-dev/fintracker → Settings → Secrets → Actions** → add/update `VITE_ALLOWED_EMAIL`.

---

## ⚠ Budget categories out of sync with sheet

### Symptom
New categories (e.g. `Education`) added to `_defaultBudgets()` in Code.gs don't appear in the app.

### Cause
`_defaultBudgets()` only runs when the Budget sheet is **empty**. Once data exists in the sheet, the app reads from there — code changes to defaults don't auto-apply.

### Fix
In the app → **Budget tab** → click **↺ Reset** → confirm.

This overwrites the Budget sheet with the current defaults from Code.gs.
