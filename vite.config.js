import { defineConfig } from 'vite'
import { resolve } from 'path'
import { readFileSync } from 'fs'

// Read version from package.json
const packageJson = JSON.parse(readFileSync('./package.json', 'utf-8'))
const version = packageJson.version

export default defineConfig({
  root: 'src',
  publicDir: '../public',
  define: {
    __APP_VERSION__: JSON.stringify(version)
  },
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    rollupOptions: {
      input: resolve(__dirname, 'src/index.html')
    }
  },
  server: {
    port: 8080,
    open: true,
    host: true // Allow external connections
  },
  css: {
    postcss: './postcss.config.js'
  },
  optimizeDeps: {
    include: ['maplibre-gl', 'codemirror', 'jszip', 'papaparse']
  }
})