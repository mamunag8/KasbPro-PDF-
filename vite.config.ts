import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    watch: {
      ignored: ['**/android/**', '**/ios/**', '**/play-store-submission/**'],
    },
  },
  optimizeDeps: {
    include: ['pdfjs-dist', 'pdf-lib', 'jspdf', 'jspdf-autotable', 'xlsx', 'mammoth'],
  },
  build: {
    target: 'esnext',
    chunkSizeWarningLimit: 3000,
  },
})
