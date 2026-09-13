import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { createServer } from 'node:http'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import test from 'node:test'

const execute = promisify(execFile)
const root = fileURLToPath(new URL('../', import.meta.url))
const forbidden = JSON.parse(readFileSync(new URL('../apps/vada-web/e2e-ship/canary-expect.json', import.meta.url))).words[0]

async function smoke(mode) {
  const manifest = {
    'index.html': { file: 'assets/main.js', isEntry: true, imports: ['shared'], dynamicImports: ['screen'] },
    shared: { file: 'assets/shared.js' },
    screen: { file: 'assets/screen.js', isDynamicEntry: true, imports: ['shared'] },
  }
  if (mode === 'stale') manifest['index.html'].file = 'assets/old.js'
  const requested = []
  const server = createServer((req, res) => {
    requested.push(req.url)
    res.setHeader('content-type', 'application/json')
    if (req.url === '/') {
      res.setHeader('content-type', 'text/html')
      return res.end('<script type="module" src="/assets/main.js"></script>')
    }
    if (req.url === '/assets/bundle-manifest.json') return res.end(JSON.stringify(manifest))
    if (req.url.startsWith('/assets/')) res.setHeader('content-type', 'text/javascript')
    if (req.url === '/assets/main.js') return res.end('/*' + 'x'.repeat(51_000) + '*/')
    if (req.url === '/assets/shared.js') return res.end('export const shared = 1')
    if (req.url === '/assets/screen.js' && mode !== 'missing') {
      if (mode === 'html') {
        res.setHeader('content-type', 'text/html')
        return res.end('<html>없는 자산 대신 받은 앱 HTML</html>')
      }
      return res.end(mode === 'leaked' ? JSON.stringify(forbidden) : 'export const screen = 1')
    }
    if (req.url === '/api/sign-in/ways') return res.end(JSON.stringify({ google: true, kakao: false }))
    res.statusCode = 404
    return res.end(JSON.stringify({ message: '찾지 못했습니다.' }))
  })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  try {
    const result = await execute(process.execPath, ['scripts/smoke.mjs'], {
      cwd: root,
      env: { ...process.env, SMOKE_URL: `http://127.0.0.1:${server.address().port}`, SMOKE_TRIES: '1' },
    }).then(result => ({ ...result, code: 0 }), error => error)
    return { ...result, requested }
  } finally {
    await new Promise(resolve => server.close(resolve))
  }
}

test('운영 점검은 초기·공통·지연 로딩 파일을 모두 확인한다', async () => {
  const result = await smoke('clean')
  assert.equal(result.code, 0, result.stderr)
  assert.ok(result.requested.includes('/assets/screen.js'))
  assert.ok(result.requested.includes('/assets/shared.js'))
  assert.equal(result.requested.filter(path => path === '/assets/shared.js').length, 1)
})

test('운영 점검은 지연 로딩 파일이 없으면 실패한다', async () => {
  assert.equal((await smoke('missing')).code, 1)
})

test('운영 점검은 지연 로딩 파일의 개발용 값 유출도 발견한다', async () => {
  assert.equal((await smoke('leaked')).code, 1)
})

test('운영 점검은 HTML과 다른 배포의 파일 목록을 거부한다', async () => {
  assert.equal((await smoke('stale')).code, 1)
})

test('운영 점검은 화면 파일 대신 받은 HTML 200 응답을 거부한다', async () => {
  assert.equal((await smoke('html')).code, 1)
})
