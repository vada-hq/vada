import assert from 'node:assert/strict'
import { test } from 'node:test'
import { makeSignature } from 'better-auth/crypto'
import { createApp } from '../app.js'
import { createTestDb } from '../db/test-db.js'
import { createPushRoutes } from '../push/routes.js'
import { createAuth } from './auth.js'

test('auth routes use the existing schema without external services', async t => {
  const { pg, db, close } = await createTestDb()
  const secret = 'local-test-only-secret-0123456789-ABCDEFGHIJKLMNOPQRSTUVWXYZ'
  const baseURL = 'http://127.0.0.1:5180'
  try {
    const auth = createAuth(db, {
      secret,
      baseURL,
      googleClientId: 'test-client',
      googleClientSecret: 'test-secret',
    })
    // 로그인한 사람만 쓰는 경로(휴대폰 알림 열쇠)로 세션 확인을 본다.
    const push = createPushRoutes(headers => auth.api.getSession({ headers }), {
      publicKey: 'PUBLIC',
      send: async () => ({ result: 'sent' }),
      wait: async () => {},
    })
    const app = createApp({ auth, trustedOrigin: 'http://127.0.0.1:5180', push })
    const request = (path: string, init?: RequestInit) =>
      app.request(`${baseURL}/api/auth/${path}`, init)

    await t.test('anonymous session is null', async () => {
      const response = await request('get-session')
      assert.equal(response.status, 200)
      assert.equal(await response.json(), null)
      assert.equal((await app.request(`${baseURL}/api/me/push`)).status, 401)
    })
    await t.test('Google login creates OAuth state and uses the configured callback', async () => {
      const response = await request('sign-in/social', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Origin: baseURL },
        body: JSON.stringify({ provider: 'google', callbackURL: '/', disableRedirect: true }),
      })
      assert.equal(response.status, 200)
      const body = (await response.json()) as { url: string }
      const url = new URL(body.url)
      assert.equal(url.hostname, 'accounts.google.com')
      assert.equal(url.searchParams.get('redirect_uri'), `${baseURL}/api/auth/callback/google`)
      assert.ok(url.searchParams.get('state'))
      assert.ok(response.headers.get('set-cookie'))
    })
    await t.test('초대 링크로 돌아오는 상대 경로 콜백을 허용한다', async () => {
      const response = await request('sign-in/social', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Origin: baseURL },
        body: JSON.stringify({
          provider: 'google',
          callbackURL: '/join/ABCD2345',
          errorCallbackURL: '/join/ABCD2345',
          disableRedirect: true,
        }),
      })
      assert.equal(response.status, 200)
    })
    await t.test(
      'untrusted origin on cookie-bearing requests and untrusted callbacks are rejected',
      async () => {
        for (const [origin, callbackURL] of [
          ['https://untrusted.example', '/'],
          [baseURL, 'https://untrusted.example'],
        ]) {
          const response = await request('sign-in/social', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Origin: origin!,
              Cookie: 'test-cookie=present',
            },
            body: JSON.stringify({ provider: 'google', callbackURL }),
          })
          assert.equal(response.status, 403)
        }
      },
    )

    // 테스트용 세션만 생성한다. 실제 Google 인증 성공을 검증하는 것은 아니다.
    const context = await auth.$context
    const user = await context.internalAdapter.createUser(
      { name: 'Tester', email: 'tester@example.test', emailVerified: true },
      { method: 'oauth', oauth: { providerId: 'google' } },
    )
    await t.test('auth adapter can persist a provider account in the existing tables', async () => {
      const account = await context.internalAdapter.createAccount({
        userId: user.id,
        providerId: 'google',
        accountId: 'test-google-subject',
      })
      assert.equal(account.userId, user.id)
      const rows = await pg.query<{ user_id: string }>(
        'SELECT user_id FROM accounts WHERE id = $1',
        [account.id],
      )
      assert.equal(rows.rows[0]?.user_id, user.id)
    })
    await pg.query(
      `INSERT INTO sessions (id, user_id, token, expires_at) VALUES
      ('active', $1, 'active-token', now() + interval '1 day'),
      ('expired', $1, 'expired-token', now() - interval '1 day')`,
      [user.id],
    )
    const cookie = async (token: string) =>
      `${context.authCookies.sessionToken.name}=${encodeURIComponent(`${token}.${await makeSignature(token, secret)}`)}`
    await t.test(
      'signed session resolves the internal user; expired and tampered sessions do not',
      async () => {
        const response = await request('get-session', {
          headers: { Cookie: await cookie('active-token') },
        })
        assert.equal(response.status, 200)
        const body = (await response.json()) as { user: { id: string } }
        assert.equal(body.user.id, user.id)
        const key = await app.request(`${baseURL}/api/me/push`, {
          headers: { Cookie: await cookie('active-token') },
        })
        assert.equal(key.status, 200)
        assert.deepEqual(await key.json(), { publicKey: 'PUBLIC' })
        for (const value of [
          await cookie('expired-token'),
          `${context.authCookies.sessionToken.name}=tampered`,
        ]) {
          const invalid = await request('get-session', { headers: { Cookie: value } })
          assert.equal(await invalid.json(), null)
        }
      },
    )
    await t.test('logout revokes the stored session and clears its cookie', async () => {
      const headers = { Origin: baseURL, Cookie: await cookie('active-token') }
      const response = await request('sign-out', { method: 'POST', headers })
      assert.equal(response.status, 200)
      assert.match(response.headers.get('set-cookie') ?? '', /Max-Age=0/i)
      const session = await request('get-session', { headers })
      assert.equal(await session.json(), null)
      assert.equal((await app.request(`${baseURL}/api/me/push`, { headers })).status, 401)
      const rows = await pg.query("SELECT id FROM sessions WHERE id = 'active'")
      assert.equal(rows.rows.length, 0)
    })
    await t.test('password signup is not enabled', async () => {
      const response = await request('sign-up/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Origin: baseURL },
        body: JSON.stringify({ name: 'No', email: 'no@example.test', password: 'not-enabled-123' }),
      })
      assert.notEqual(response.status, 200)
      const rows = await pg.query("SELECT id FROM users WHERE email = 'no@example.test'")
      assert.equal(rows.rows.length, 0)
    })
  } finally {
    await close()
  }
})
