import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

// Dev requests to /api are proxied to the deployed API Gateway stage.
export default defineConfig(({ mode }) => {
  const { VITE_API_PROXY_TARGET } = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [react(), tailwindcss()],
    build: { outDir: 'dist', sourcemap: true },
    server: VITE_API_PROXY_TARGET
      ? { proxy: { '/api': { target: VITE_API_PROXY_TARGET, changeOrigin: true } } }
      : {},
  }
})
