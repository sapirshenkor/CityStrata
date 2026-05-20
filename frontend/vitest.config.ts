import path from 'node:path'
import { defineConfig, mergeConfig } from 'vitest/config'
import viteConfig from './vite.config.js'

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: 'happy-dom',
      setupFiles: ['./vitest.setup.ts'],
      globals: false,
      include: ['src/**/*.{test,spec}.{ts,tsx,js,jsx}'],
      exclude: ['node_modules', 'dist', '.vite'],
      pool: 'forks',
      coverage: {
        provider: 'v8',
        reporter: ['text', 'html', 'lcov'],
        reportsDirectory: './coverage',
        include: ['src/**/*.{ts,tsx,js,jsx}'],
        exclude: [
          'src/test/**',
          'src/**/*.d.ts',
          'src/main.jsx',
          'src/components/ui/**',
        ],
      },
    },
    resolve: {
      alias: {
        'mapbox-gl/dist/mapbox-gl.css': path.resolve(__dirname, './src/test/mocks/empty.css'),
        'leaflet/dist/leaflet.css': path.resolve(__dirname, './src/test/mocks/empty.css'),
      },
    },
  }),
)
