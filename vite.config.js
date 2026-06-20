import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // When running `vite dev` directly (without vercel dev), proxy /api to port 3000
  // where vercel dev would be running the serverless functions.
  server: {
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
})
