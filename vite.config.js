import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// The same build is served from two hosts with different roots:
//   - rodrigopimenta.com (Cloudflare Pages) -> served from "/"
//   - rodrigopimenta10.github.io/portfolio-website/ -> served from "/portfolio-website/"
// Cloudflare uses the default. The GitHub Pages workflow sets VITE_BASE.
// Getting this wrong yields a blank page: assets 404 and React never mounts.
export default defineConfig({
  plugins: [react()],
  base: process.env.VITE_BASE || '/',
})
