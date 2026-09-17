import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { resolve } from 'node:path'

// https://vite.dev/config/
export default defineConfig({
  // GitHub Pages serves this project from /<repository-name>/.
  base: '/CropRotationPlanner/',
  plugins: [react()],
  server: {
    fs: {
      allow: [resolve(import.meta.dirname, '..')],
    },
  },
})
