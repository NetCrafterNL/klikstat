import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'http://localhost:3001',
      '/collect': 'http://localhost:3001',
      '/public': 'http://localhost:3001',
      '/v1': 'http://localhost:3001',
      '/ai': 'http://localhost:3001',
    },
  },
})
