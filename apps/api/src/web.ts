import { serveStatic } from '@hono/node-server/serve-static'
import { statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Hono } from 'hono'

export function attachWeb(app: Hono, root = fileURLToPath(new URL('../../web/dist/', import.meta.url))) {
  if (!statSync(join(root, 'index.html')).isFile()) throw new Error('웹 빌드가 필요합니다.')
  const entry = serveStatic({ root, path: 'index.html' })
  app.on(['GET', 'HEAD'], ['/', '/index.html'], async (context, next) => {
    context.header('Cache-Control', 'no-cache')
    return entry(context, next)
  })
  app.on(['GET', 'HEAD'], '/assets/*', serveStatic({ root }))
}
