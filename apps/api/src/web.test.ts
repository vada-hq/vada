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
    mkdirSync(join(root, 'icons'))
    writeFileSync(join(root, 'sw.js'), 'self.addEventListener("push", () => {})')
    writeFileSync(join(root, 'manifest.webmanifest'), '{"name":"VADA"}')
    writeFileSync(join(root, 'icons', 'icon-192.png'), Buffer.from([0x89, 0x50, 0x4e, 0x47]))
    writeFileSync(join(root, 'apple-touch-icon.png'), Buffer.from([0x89, 0x50, 0x4e, 0x47]))
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
    // 서비스 워커와 홈 화면 설정은 바뀌면 바로 받도록 캐시하지 않는다. 아이콘은 하루 캐시한다.
    const worker = await app.request('/sw.js')
    assert.equal(worker.status, 200)
    assert.match(worker.headers.get('Content-Type')!, /javascript/)
    assert.equal(worker.headers.get('Cache-Control'), 'no-cache')
    const manifest = await app.request('/manifest.webmanifest')
    assert.equal(manifest.status, 200)
    assert.equal(manifest.headers.get('Content-Type'), 'application/manifest+json')
    assert.equal(manifest.headers.get('Cache-Control'), 'no-cache')
    for (const path of ['/icons/icon-192.png', '/apple-touch-icon.png']) {
      const icon = await app.request(path)
      assert.equal(icon.status, 200, path)
      assert.equal(icon.headers.get('Content-Type'), 'image/png', path)
      assert.equal(icon.headers.get('Cache-Control'), 'public, max-age=86400', path)
    }
    assert.equal((await app.request('/icons/missing.png')).headers.get('Cache-Control'), null)
    assert.equal((await app.request('/', { method: 'HEAD' })).status, 200)
    assert.deepEqual(await (await app.request('/api/health')).json(), { status: 'ok' })
    assert.equal(await (await app.request('/api/auth/get-session')).text(), 'auth')
    const invite = await app.request('/join/ABCD2345')
    assert.equal(invite.status, 200)
    assert.equal(invite.headers.get('Cache-Control'), 'no-cache')
    assert.match(await invite.text(), /VADA/)
    // 공개 참가 신청(/apply/코드)과 내 신청(/r#토큰)도 화면 진입점이다. 토큰은 # 뒤라 서버에 오지 않는다.
    for (const path of ['/apply/ABCD2345', '/r', '/auth-done']) {
      const entry = await app.request(path)
      assert.equal(entry.status, 200, path)
      assert.equal(entry.headers.get('Cache-Control'), 'no-cache', path)
      assert.match(await entry.text(), /VADA/, path)
    }
    for (const path of ['/api/missing', '/assets/missing.js', '/private.txt', '/.env', '/assets/%2e%2e/private.txt', '/join/', '/join/a/b',
      '/apply/', '/apply/a/b', '/r/x', '/icons/', '/icons/a/b', '/icons/missing.png', '/sw.js/x']) {
      assert.equal((await app.request(path)).status, 404)
    }
    assert.equal((await app.request('/', { method: 'POST' })).status, 404)
  } finally { rmSync(root, { recursive: true, force: true }) }
})
test('missing built web prevents startup', () => {
  assert.throws(() => attachWeb(createApp({ auth: { handler: async () => new Response() }, trustedOrigin: 'http://127.0.0.1:5180' }), 'missing-web-build'))
})
