# Local Development Setup

## Quick Start

```bash
cd web
npm install
npm run dev
```

Open http://localhost:5173/fintracker/

## Configuration

### Environment Variables (.env)

```env
# Required - Google Apps Script deployment URL
VITE_GAS_URL=https://script.google.com/macros/s/{DEPLOYMENT_ID}/exec

# Optional - Direct API URL (overrides GAS_URL in dev)
VITE_API_URL=

# Google OAuth
VITE_GOOGLE_CLIENT_ID=your-client-id

# Gemini API
VITE_GEMINI_KEY=your-gemini-key

# Sheet ID (for backend configuration)
VITE_SHEET_ID=your-sheet-id

# Auth Token (for backend)
VITE_API_TOKEN=your-token

# Allowed emails (comma-separated)
VITE_ALLOWED_EMAILS=your@email.com
```

## Development Modes

### Mode 1: Using Production GAS URL (Recommended)

Set `VITE_GAS_URL` in `.env` to your deployed GAS URL:

```env
VITE_GAS_URL=https://script.google.com/macros/s/{DEPLOYMENT_ID}/exec
```

The app will directly call the production GAS URL (CORS enabled).

**Pros:**
- Works reliably
- Tests against production data
- No proxy configuration needed

**Cons:**
- Uses production data
- Can't test local GAS changes

### Mode 2: Using Local GAS URL (Advanced)

For local GAS development, set `VITE_API_URL`:

```env
VITE_API_URL=http://localhost:8080  # clasp serve port
```

Then run:
```bash
clasp serve
```

This opens the local GAS development environment without needing to deploy.

## Troubleshooting

### 404 Error on `/gas-proxy`

**Symptoms:**
```
GET http://localhost:5173/gas-proxy?action=init... → 404 Not Found
```

**Causes:**
1. `VITE_GAS_URL` is empty or invalid
2. Vite dev server restarted after env change
3. CORS blocked the request

**Solution:**

1. **Check .env file:**
   ```bash
   grep VITE_GAS_URL .env
   ```
   Should show your GAS deployment URL, not empty.

2. **Restart dev server:**
   ```bash
   npm run dev
   ```
   Env variables are loaded at startup.

3. **Verify GAS URL works:**
   ```bash
   curl "https://script.google.com/macros/s/{DEPLOYMENT_ID}/exec?action=init"
   ```
   Should return JSON, not HTML.

4. **Check browser console (F12):**
   - Network tab: See actual request/response
   - Console: Look for error messages
   - Check for CORS errors

### CORS Blocked Error

**Symptoms:**
```
Access to XMLHttpRequest blocked by CORS policy
```

**Solution:**

Go to script.google.com → Deploy → Manage deployments:
1. Click edit icon on your deployment
2. Set **"Who has access"** to **"Anyone"**
3. Click **Update**

### GAS Says "Not Deployed"

**Solution:**

Deploy the GAS backend:

```bash
# From project root
./deploy.sh
```

Follow prompts to authenticate and deploy. The script will:
1. Push code to Google Apps Script
2. Create a deployment
3. Extract the deployment ID
4. Update VITE_GAS_URL in .env

Then restart the dev server.

## API Request Flow

### Development (localhost:5173)
```
Frontend → http://localhost:5173/gas-proxy
       ↓ (Vite proxy intercepts)
       → https://script.google.com/.../exec
       ↓ (CORS allowed if "Anyone" has access)
Backend (GAS)
```

### Production (deployed)
```
Frontend → https://deployed-url/api
       ↓ (Cloudflare Worker routes)
       → https://script.google.com/.../exec
Backend (GAS)
```

## Common Commands

```bash
# Development with hot reload
npm run dev

# Build for production
npm run build

# Preview production build locally
npm run preview

# Deploy GAS backend
./deploy.sh

# Deploy GAS with local testing
clasp serve
```

## Browser DevTools Tips

### Network Tab
- Filter by XHR to see API calls
- Check response tab for error messages
- Headers show Content-Type, CORS headers

### Console
- `[API Trace]` logs appear when VITE_DEBUG=true
- Unhandled errors show setup issues

### Application → Storage → Local Storage
- `ft_auth=1` indicates logged in
- `ft_email=user@email.com` shows current user

## Debugging

Enable verbose logging:

```env
VITE_DEBUG=true
```

This will log:
- API requests (traceId)
- Response payloads
- Timing information

Check browser console (F12) → Console tab for `[API Trace]` logs.

## Architecture

- **Frontend:** React + TypeScript (Vite)
- **Backend:** Google Apps Script
- **Proxy:** Vite dev server (localhost) or Cloudflare Worker (prod)
- **Auth:** Google OAuth
- **Data:** Google Sheets
- **AI:** Gemini API

See `vite.config.ts` and `src/api.ts` for implementation details.
