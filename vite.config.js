import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    sourcemap: false,
    drop: ["console", "debugger"],
  },
  test: {
    environment: "jsdom",
    globals: true,
  },
})
