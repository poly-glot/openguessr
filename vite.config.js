import { defineConfig } from 'vite'
import { resolve } from 'path'

export default defineConfig({
  root: '.',
  publicDir: 'public',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: true,
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, 'index.html')
      }
    }
  },
  server: {
    port: 5173,
    host: '0.0.0.0',
    open: false,
    proxy: {
      '/__': {
        target: 'http://localhost:5002',
        changeOrigin: true
      }
    }
  },
  define: {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'production')
  },
  test: {
    globals: true,
    environment: 'jsdom',
    include: [
      'src/**/*.spec.js',
      'src/**/*.test.js',
      'functions/**/*.test.js'
    ],
    exclude: [
      '**/node_modules/**'
    ],
    setupFiles: ['./vitest.setup.js'],
    fileParallelism: false,
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true
      }
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'text-summary', 'html'],
      include: ['src/**/*.js'],
      exclude: [
        'src/**/*.spec.js',
        'src/**/*.test.js',
        'src/component/core-css/**',
        'src/component/share-link/**',
        'src/firebase-init.js',
        'src/index.js'
      ],
      thresholds: {
        statements: 85,
        branches: 85,
        functions: 85,
        lines: 85
      }
    }
  }
})
