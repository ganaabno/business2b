import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: '/', // 👈 very important for SPA routing
  build: {
    outDir: 'dist', // 👈 make sure output is dist
  },
})
