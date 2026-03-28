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

export default {
  async fetch(request, env) {
    const GAS_EXEC_URL = env.GAS_EXEC_URL

    if (!GAS_EXEC_URL) {
      return new Response(
        JSON.stringify({ ok: false, error: 'GAS_EXEC_URL not configured' }),
        {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        }
      )
    }

    const url = new URL(request.url)
    const targetUrl = new URL(GAS_EXEC_URL)

    // Forward query parameters
    targetUrl.search = url.search

    try {
      const options = {
        method: request.method,
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Cloudflare-Worker-Proxy'
        }
      }

      // Forward body for POST/PUT/PATCH requests
      if (request.method !== 'GET' && request.method !== 'HEAD') {
        options.body = await request.text()
      }

      const response = await fetch(targetUrl.toString(), options)
      const text = await response.text()

      return new Response(text, {
        status: response.status,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
          'Cache-Control': 'no-cache, no-store, must-revalidate'
        }
      })
    } catch (error) {
      return new Response(
        JSON.stringify({ ok: false, error: error.message }),
        {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        }
      )
    }
  }
}
