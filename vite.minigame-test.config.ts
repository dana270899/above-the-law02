import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'
import fs from 'node:fs'

const miniGameTestOutput = path.resolve(__dirname, 'dist/mini-game-test')

function cleanMiniGameTestOutput() {
  return {
    name: 'clean-mini-game-test-output',
    apply: 'build' as const,
    buildStart() {
      // Preserve the already-built public game and replace only this test page.
      fs.rmSync(miniGameTestOutput, { recursive: true, force: true })
    },
  }
}

/**
 * A second, standalone Vite build for the unlisted mini-game comparison page.
 * It deliberately writes only beneath dist/mini-game-test and does not share
 * an entry graph with the public game bundle.
 */
export default defineConfig(({ command }) => ({
  base: '/',
  plugins: [react(), cleanMiniGameTestOutput()],
  // Dev serves the existing artwork for the frozen baseline. Production gets
  // the same allow-listed files from the game build that runs immediately first.
  publicDir: command === 'serve' ? 'assets' : false,
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  build: {
    outDir: path.resolve(__dirname, 'dist'),
    emptyOutDir: false,
    rollupOptions: {
      input: path.resolve(__dirname, 'mini-game-test/index.html'),
      output: {
        entryFileNames: 'mini-game-test/assets/[name]-[hash].js',
        chunkFileNames: 'mini-game-test/assets/[name]-[hash].js',
        assetFileNames: 'mini-game-test/assets/[name]-[hash][extname]',
      },
    },
  },
}))
