import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { resolve } from 'node:path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    fs: {
      allow: [resolve(import.meta.dirname, '..')],
    },
  },
})
