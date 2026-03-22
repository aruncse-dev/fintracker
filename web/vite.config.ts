import { defineConfig, loadEnv, Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import https from 'https'
import http from 'http'

// Dev plugin: proxies /gas-proxy/* to GAS server-side (Node has no CORS)
function gasProxyPlugin(gasUrl: string): Plugin {
  return {
    name: 'gas-proxy',
    configureServer(server) {
      server.middlewares.use('/gas-proxy', (req, res) => {
        const qs = (req.url || '').replace(/^\//, '') // strip leading slash Connect adds
        const target = gasUrl + qs
        const mod = target.startsWith('https') ? https : http
        const chunks: Buffer[] = []

        const follow = (url: string) => {
          mod.get(url, { headers: { 'User-Agent': 'node' } }, (r) => {
            if ((r.statusCode === 301 || r.statusCode === 302) && r.headers.location) {
              follow(r.headers.location)
              return
            }
            r.on('data', c => chunks.push(c))
            r.on('end', () => {
              const body = Buffer.concat(chunks).toString()
              res.setHeader('Content-Type', 'application/json')
              res.setHeader('Access-Control-Allow-Origin', '*')
              res.end(body)
            })
          }).on('error', (e) => {
            res.statusCode = 500
            res.end(JSON.stringify({ ok: false, error: e.message }))
          })
        }

        follow(target)
      })
    }
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd())
  const gasUrl = env.VITE_GAS_URL || ''

  return {
    plugins: [react(), ...(mode === 'development' ? [gasProxyPlugin(gasUrl)] : [])],
    base: '/fintracker/',
  }
})
