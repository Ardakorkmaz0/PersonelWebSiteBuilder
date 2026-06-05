import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// Tests run under jsdom so React components, DOM APIs, and document-level
// event handlers all work without a real browser. setupFiles wires
// @testing-library/jest-dom matchers so assertions like
// `expect(el).toBeInTheDocument()` are available everywhere.
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.js'],
    css: false, // skip CSS handling in tests for speed; layout isn't asserted
    // Vitest looks for *.test.{js,jsx,ts,tsx} colocated with source by default;
    // explicit include keeps the discovery scope tight and avoids picking up
    // the dist/ output if a build ran first.
    include: ['src/**/*.{test,spec}.{js,jsx,ts,tsx}'],
  },
})
