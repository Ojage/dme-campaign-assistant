import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

const projectRoot = dirname(fileURLToPath(import.meta.url))
const fromRoot = (relativePath: string) => resolve(projectRoot, relativePath)

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, projectRoot, 'VITE_')

  return {
    plugins: [react()],
    resolve: {
      alias: {
        '@': fromRoot('src'),
      },
    },
    server: {
      host: true,
      port: Number(env.VITE_PORT ?? 5173),
      strictPort: false,
      // The API is proxied under the same origin so the browser sees one base URL
      // in development and in production alike.
      proxy: {
        '/api': {
          target: env.VITE_API_PROXY_TARGET ?? 'http://localhost:4000',
          changeOrigin: true,
        },
      },
    },
    preview: {
      host: true,
      port: Number(env.VITE_PREVIEW_PORT ?? 4173),
    },
    build: {
      outDir: 'dist',
      target: 'es2022',
      sourcemap: mode !== 'production',
      reportCompressedSize: false,
    },
  }
})
