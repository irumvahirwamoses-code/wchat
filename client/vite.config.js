import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Injects VITE_SITE_URL into index.html at build time so canonical / Open
// Graph tags never ship with a literal "%VITE_SITE_URL%" placeholder.
const siteUrlInjector = () => ({
  name: 'site-url-injector',
  transformIndexHtml(html) {
    const siteUrl = process.env.VITE_SITE_URL || ''
    return html.replace(/%VITE_SITE_URL%/g, siteUrl)
  },
})

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), siteUrlInjector()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
      '/uploads': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
    },
  },
})
