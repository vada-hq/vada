import assert from 'node:assert/strict'
import { test } from 'node:test'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createApp } from './app.js'
import { attachWeb } from './web.js'

test('built web and API share an origin, only web entry and assets are public', async () => {
  const root = mkdtempSync(join(tmpdir(), 'vada-static-test-'))
  try {
    mkdirSync(join(root, 'assets'))
    writeFileSync(join(root, 'index.html'), '<!doctype html><div>VADA</div>')
    writeFileSync(join(root, 'assets', 'app.js'), 'window.vada = true')
    writeFileSync(join(root, 'assets', 'zxing_reader-abc123.wasm'), Buffer.from([0, 97, 115, 109]))
    writeFileSync(join(root, 'private.txt'), 'not-public')
    const app = createApp({ auth: { handler: async () => new Response('auth') }, trustedOrigin: 'http://127.0.0.1:5180' })
    attachWeb(app, root)
    const page = await app.request('/')
    assert.equal(page.status, 200)
    assert.match(page.headers.get('Content-Type')!, /text\/html/)
    assert.equal(page.headers.get('Cache-Control'), 'no-cache')
    assert.match(await page.text(), /VADA/)
    const asset = await app.request('/assets/app.js')
    assert.equal(asset.status, 200)
    assert.match(asset.headers.get('Content-Type')!, /javascript/)
    // 빌드가 내용 해시를 이름에 넣으므로 오래 캐시한다. 스캐너 판독기(wasm)도 같고, 브라우저가 wasm으로 바로 컴파일하도록 형식을 준다.
    const immutable = 'public, max-age=31536000, immutable'
    assert.equal(asset.headers.get('Cache-Control'), immutable)
    const wasm = await app.request('/assets/zxing_reader-abc123.wasm')
    assert.equal(wasm.status, 200)
    assert.equal(wasm.headers.get('Content-Type'), 'application/wasm')
    assert.equal(wasm.headers.get('Cache-Control'), immutable)
    // 없는 파일의 404는 캐시하지 않는다.
    assert.equal((await app.request('/assets/missing.js')).headers.get('Cache-Control'), null)
    assert.equal((await app.request('/', { method: 'HEAD' })).status, 200)
    assert.deepEqual(await (await app.request('/api/health')).json(), { status: 'ok' })
    assert.equal(await (await app.request('/api/auth/get-session')).text(), 'auth')
    const invite = await app.request('/join/ABCD2345')
    assert.equal(invite.status, 200)
    assert.equal(invite.headers.get('Cache-Control'), 'no-cache')
    assert.match(await invite.text(), /VADA/)
    // 공개 참가 신청(/apply/코드)과 내 신청(/r#토큰)도 화면 진입점이다. 토큰은 # 뒤라 서버에 오지 않는다.
    for (const path of ['/apply/ABCD2345', '/r']) {
      const entry = await app.request(path)
      assert.equal(entry.status, 200, path)
      assert.equal(entry.headers.get('Cache-Control'), 'no-cache', path)
      assert.match(await entry.text(), /VADA/, path)
    }
    for (const path of ['/api/missing', '/assets/missing.js', '/private.txt', '/.env', '/assets/%2e%2e/private.txt', '/join/', '/join/a/b',
      '/apply/', '/apply/a/b', '/r/x']) {
      assert.equal((await app.request(path)).status, 404)
    }
    assert.equal((await app.request('/', { method: 'POST' })).status, 404)
  } finally { rmSync(root, { recursive: true, force: true }) }
})
test('missing built web prevents startup', () => {
  assert.throws(() => attachWeb(createApp({ auth: { handler: async () => new Response() }, trustedOrigin: 'http://127.0.0.1:5180' }), 'missing-web-build'))
})
