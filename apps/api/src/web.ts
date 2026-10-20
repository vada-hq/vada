import { serveStatic } from '@hono/node-server/serve-static'
import { statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Hono } from 'hono'
import { OK } from './http/status.js'

export function attachWeb(
  app: Hono,
  root = fileURLToPath(new URL('../../web/dist/', import.meta.url)),
) {
  if (!statSync(join(root, 'index.html')).isFile()) throw new Error('웹 빌드가 필요합니다.')
  const entry = serveStatic({ root, path: 'index.html' })
  // 초대 링크(/join/코드), 공개 참가 신청(/apply/코드), 내 신청(/r#토큰), 홈 화면 앱 안 로그인이 끝나는 곳(/auth-done)도 화면 진입점이다. 코드 검사는 화면이 API로 한다.
  app.on(
    ['GET', 'HEAD'],
    ['/', '/index.html', '/join/:code', '/apply/:code', '/r', '/auth-done'],
    async (context, next) => {
      context.header('Cache-Control', 'no-cache')
      return entry(context, next)
    },
  )
  // 서비스 워커와 홈 화면 설정은 바뀌면 바로 받아야 하므로 캐시하지 않는다. 서비스 워커는 맨 위 경로에 있어야 앱 전체를 맡는다.
  app.on(
    ['GET', 'HEAD'],
    ['/sw.js', '/manifest.webmanifest'],
    async (context, next) => {
      await next()
      if (context.res.status === OK) context.res.headers.set('Cache-Control', 'no-cache')
    },
    serveStatic({ root }),
  )
  // 앱 아이콘. 이름에 해시가 없으므로 하루만 캐시한다.
  app.on(
    ['GET', 'HEAD'],
    ['/icons/:file', '/apple-touch-icon.png'],
    async (context, next) => {
      await next()
      if (context.res.status === OK)
        context.res.headers.set('Cache-Control', 'public, max-age=86400')
    },
    serveStatic({ root }),
  )
  // 빌드가 내용 해시를 파일 이름에 넣으므로 같은 이름의 내용은 바뀌지 않는다. 오래 캐시해 다시 받지 않게 한다(스캐너 판독기 wasm 약 1MB 포함).
  // 없는 파일의 404는 캐시하지 않는다.
  app.on(
    ['GET', 'HEAD'],
    '/assets/*',
    async (context, next) => {
      await next()
      if (context.res.status === OK)
        context.res.headers.set('Cache-Control', 'public, max-age=31536000, immutable')
    },
    serveStatic({ root }),
  )
}
