/**
 * Cloudflare Worker: CORS proxy for Google Apps Script
 *
 * Environment variables (set in wrangler.toml):
 * - GAS_EXEC_URL: https://script.google.com/macros/s/DEPLOY_ID/exec
 *
 * Deploy via GitHub Actions or:
 *   npm install -g wrangler
 *   wrangler deploy
 */

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400'
}

export default {
  async fetch(request, env) {
    const GAS_EXEC_URL = env.GAS_EXEC_URL

    // Handle CORS preflight requests
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: CORS_HEADERS
      })
    }

    if (!GAS_EXEC_URL) {
      return new Response(
        JSON.stringify({ ok: false, error: 'GAS_EXEC_URL not configured' }),
        {
          status: 500,
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
        }
      )
    }

    try {
      // Preserve full URL with query parameters, replace hostname/pathname with GAS
      const url = new URL(request.url)
      const gasUrl = new URL(GAS_EXEC_URL)
      url.hostname = gasUrl.hostname
      url.pathname = gasUrl.pathname

      // Get body for non-GET requests
      const body = request.method !== 'GET' ? await request.text() : null

      const response = await fetch(url.toString(), {
        method: request.method,
        headers: request.headers,
        body: body
      })

      const text = await response.text()

      return new Response(text, {
        status: response.status,
        headers: {
          ...CORS_HEADERS,
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate'
        }
      })
    } catch (error) {
      return new Response(
        JSON.stringify({ ok: false, error: error.message }),
        {
          status: 500,
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
        }
      )
    }
  }
}
