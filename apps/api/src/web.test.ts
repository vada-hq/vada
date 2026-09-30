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
    writeFileSync(join(root, 'private.txt'), 'not-public')
    const app = createApp({ handler: async () => new Response('auth') })
    attachWeb(app, root)
    const page = await app.request('/')
    assert.equal(page.status, 200)
    assert.match(page.headers.get('Content-Type')!, /text\/html/)
    assert.equal(page.headers.get('Cache-Control'), 'no-cache')
    assert.match(await page.text(), /VADA/)
    const asset = await app.request('/assets/app.js')
    assert.equal(asset.status, 200)
    assert.match(asset.headers.get('Content-Type')!, /javascript/)
    assert.equal((await app.request('/', { method: 'HEAD' })).status, 200)
    assert.deepEqual(await (await app.request('/api/health')).json(), { status: 'ok' })
    assert.equal(await (await app.request('/api/auth/get-session')).text(), 'auth')
    for (const path of ['/api/missing', '/assets/missing.js', '/private.txt', '/.env', '/assets/%2e%2e/private.txt']) {
      assert.equal((await app.request(path)).status, 404)
    }
    assert.equal((await app.request('/', { method: 'POST' })).status, 404)
  } finally { rmSync(root, { recursive: true, force: true }) }
})
test('missing built web prevents startup', () => {
  assert.throws(() => attachWeb(createApp({ handler: async () => new Response() }), 'missing-web-build'))
})
