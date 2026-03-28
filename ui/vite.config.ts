import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/news-feed': 'http://localhost:3000',
      '/podcast-script': 'http://localhost:3000',
      '/tts': 'http://localhost:3000',
      '/voices': 'http://localhost:3000',
    },
  },
})
