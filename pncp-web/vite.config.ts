import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // Proxy same-origin em dev → espelha a Serverless Function /api/pncp da Vercel.
      '/api/pncp': {
        target: 'https://pncp.gov.br',
        changeOrigin: true,
        secure: true,
        rewrite: (p) => p.replace(/^\/api\/pncp/, '/api/consulta/publicacao'),
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
})
