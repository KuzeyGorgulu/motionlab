import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'
import type { Plugin } from 'vite'

function rewriteAppEntry(url: string | undefined) {
  if (url === undefined) return url

  const [pathname, search] = url.split('?', 2)

  if (pathname !== '/app' && pathname !== '/app/') return url

  return `/app/index.html${search === undefined ? '' : `?${search}`}`
}

function appHtmlRouting(): Plugin {
  return {
    name: 'motionlab-app-html-routing',
    configureServer(server) {
      server.middlewares.use((request, _response, next) => {
        request.url = rewriteAppEntry(request.url)
        next()
      })
    },
    configurePreviewServer(server) {
      server.middlewares.use((request, _response, next) => {
        request.url = rewriteAppEntry(request.url)
        next()
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), appHtmlRouting()],
  build: {
    rollupOptions: {
      input: {
        app: fileURLToPath(new URL('./app/index.html', import.meta.url)),
        landing: fileURLToPath(new URL('./index.html', import.meta.url)),
      },
    },
  },
  test: {
    include: ['src/**/*.test.ts'],
  },
})
