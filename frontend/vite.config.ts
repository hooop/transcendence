import { defineConfig } from 'vite'

export default defineConfig({
  server: {
    host: '0.0.0.0', // Écouter sur toutes les interfaces (nécessaire pour Docker)
    port: 8080,
    strictPort: true,
    watch: {
      usePolling: true // Nécessaire pour que le HMR fonctionne dans Docker
    }
  }
})
