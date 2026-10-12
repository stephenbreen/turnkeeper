/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// During dev we serve at the root so `localhost:5173/` works as expected.
// For the production build we prefix assets with the repo name so the bundle
// resolves correctly at https://stephenbreen.github.io/turnkeeper/.
export default defineConfig(({ command }) => ({
  plugins: [react()],
  base: command === 'build' ? '/turnkeeper/' : '/',
  server: {
    port: 5173,
    strictPort: false,
  },
  // Vitest — tests are colocated as *.test.ts next to the module they cover.
  // Default environment is node (the tested core is pure); the store test
  // opts into jsdom with a @vitest-environment pragma (it needs localStorage
  // for the persist middleware).
  test: {
    environment: 'node',
    include: ['src/**/*.test.{ts,tsx}'],
  },
}))
