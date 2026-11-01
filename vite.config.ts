/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

// `base` is the path the site is served from: '/retirement/' (the repo name) for
// https://<user>.github.io/retirement/, or BASE_PATH=/ for its own domain (willitlast.app).
// An unset or empty BASE_PATH falls back to '/retirement/'; a trailing slash is added if missing.
const basePath = process.env.BASE_PATH || '/retirement/'

export default defineConfig({
  base: basePath.endsWith('/') ? basePath : `${basePath}/`,
  plugins: [react(), tailwindcss()],
  test: {
    include: ['src/**/*.test.ts'],
  },
})
