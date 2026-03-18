import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    sourcemap: false,          // no exponer código fuente en producción
    drop: ["console", "debugger"], // elimina console.log/warn/error automáticamente
  },
})
