import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd())
  const gasUrl = env.VITE_GAS_URL || ''
  const apiUrl = env.VITE_API_URL || (mode === 'development' ? '/gas-proxy' : '')

  return {
    plugins: [react()],
    base: '/fintracker/',
    define: {
      'import.meta.env.VITE_API_URL': JSON.stringify(apiUrl)
    },
    server: mode === 'development' ? {
      proxy: {
        '/gas-proxy': {
          target: gasUrl,
          changeOrigin: true,
          secure: false,
          rewrite: (path) => path.replace(/^\/gas-proxy/, ''),
          configure: (proxy) => {
            proxy.on('proxyReq', (proxyReq, req) => {
              if (req.body) {
                const bodyData = JSON.stringify(req.body)
                proxyReq.setHeader('Content-Type', 'application/json')
                proxyReq.setHeader('Content-Length', Buffer.byteLength(bodyData))
                proxyReq.write(bodyData)
              }
            })
          }
        }
      }
    } : undefined
  }
})
