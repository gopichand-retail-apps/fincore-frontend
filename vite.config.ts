import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

export default defineConfig(({ mode }) => {
  const environment = loadEnv(mode, process.cwd(), '')
  const proxyTarget = environment.FINCORE_API_PROXY_TARGET?.trim() || 'http://127.0.0.1:5502'

  return {
    plugins: [react()],
    server: {
      host: '127.0.0.1',
      port: 5501,
      strictPort: true,
      proxy: {
        '/api': {
          target: proxyTarget,
          changeOrigin: true,
        },
        '/actuator': {
          target: proxyTarget,
          changeOrigin: true,
        },
      },
    },
  }
})
