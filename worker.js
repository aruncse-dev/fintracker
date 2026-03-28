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
  'Access-Control-Max-Age': '86400',
  'Content-Type': 'application/json'
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
          headers: CORS_HEADERS
        }
      )
    }

    const url = new URL(request.url)
    const targetUrl = new URL(GAS_EXEC_URL)

    // Forward all query parameters individually
    console.log('Worker: request.url=' + request.url)
    console.log('Worker: GAS_EXEC_URL=' + GAS_EXEC_URL)

    url.searchParams.forEach((value, key) => {
      console.log('Worker: setting param ' + key + '=' + value)
      targetUrl.searchParams.set(key, value)
    })

    console.log('Worker: final targetUrl=' + targetUrl.toString())

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
          ...CORS_HEADERS,
          'Cache-Control': 'no-cache, no-store, must-revalidate'
        }
      })
    } catch (error) {
      return new Response(
        JSON.stringify({ ok: false, error: error.message }),
        {
          status: 500,
          headers: CORS_HEADERS
        }
      )
    }
  }
}
