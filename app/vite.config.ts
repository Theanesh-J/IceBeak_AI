import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    // Vite's fs allow-list check misreads project paths containing ':' (e.g. this
    // hackathon folder). The dev server only listens on localhost.
    fs: { strict: !process.cwd().includes(':') },
    proxy: { '/api': 'http://localhost:8787' },
  },
})
