import { defineConfig } from 'vite'
import { resolve } from 'path'
import { readFileSync } from 'fs'
import { execSync } from 'child_process'

// Read version from package.json
const packageJson = JSON.parse(readFileSync('./package.json', 'utf-8'))
let version = packageJson.version

// Append branch name if not on main
try {
  const branch = execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf-8' }).trim()
  if (branch && branch !== 'main') {
    version = `${version}-${branch}`
  }
} catch (error) {
  // If git command fails, just use the version without branch
  console.warn('Could not determine git branch, using version without branch suffix')
}

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