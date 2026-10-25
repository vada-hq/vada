import assert from 'node:assert/strict'
import { test } from 'node:test'
import { makeSignature } from 'better-auth/crypto'
import { appModulesOf } from '../app-modules.js'
import { createApp } from '../app.js'
import { createTestDb } from '../db/test-db.js'
import { createPurchaseWriteLimiter } from '../purchases/write-limit.js'
import { createPushRoutes } from '../push/routes.js'
import { fakeGoogleLogin } from '../test-support/google-login.js'
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

const NO_GOOGLE_VALUES = { image: null, tokens: '' }

test('Google 로그인은 프로필 사진과 토큰을 DB에 남기지 않는다', async t => {
  const { pg, db, close } = await createTestDb()
  const baseURL = 'http://127.0.0.1:5180'
  try {
    const auth = createAuth(db, {
      secret: 'local-test-only-secret-0123456789-ABCDEFGHIJKLMNOPQRSTUVWXYZ',
      baseURL,
      googleClientId: 'test-client',
      googleClientSecret: 'test-secret',
    })
    const modules = appModulesOf(db, headers => auth.api.getSession({ headers }), {
      // 학생회 만들기는 운영 연도를 오늘로 가린다. 해가 바뀌어도 같은 결과가 나오게 날을 정한다.
      clock: () => new Date('2026-06-01T03:00:00Z'),
      writeLimiter: createPurchaseWriteLimiter(),
      receiptKey: 'test-receipt-key',
    })
    const app = createApp({ auth, trustedOrigin: baseURL, ...modules })
    const request = (path: string, init?: RequestInit) => app.request(`${baseURL}${path}`, init)
    const post = (path: string, cookie: string, body: unknown = {}) =>
      request(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Origin: baseURL, Cookie: cookie },
        body: JSON.stringify(body),
      })

    const googleLogin = fakeGoogleLogin(t, baseURL, request)
    // 계정 행마다(이메일 순) 그 사용자의 사진 주소와, 토큰 셋·두 만료 시각을 이어 붙인 값. 모두 비었으면 ''다.
    // 계정 행이 없는 사용자는 줄이 없어 기대한 개수와 어긋난다(계정 행이 생겼는지도 함께 본다).
    const storedGoogleValues = async (userId?: string) =>
      (
        await pg.query<{ image: string | null; tokens: string }>(
          `SELECT u.image, concat_ws(',', a.access_token, a.refresh_token, a.id_token,
             a.access_token_expires_at::text, a.refresh_token_expires_at::text) AS tokens
           FROM users u JOIN accounts a ON a.user_id = u.id
           WHERE $1::text IS NULL OR u.id = $1 ORDER BY u.email, a.provider_id`,
          [userId ?? null],
        )
      ).rows
    const sessionOf = async (cookie: string) =>
      (await (await request('/api/auth/get-session', { headers: { Cookie: cookie } })).json()) as {
        user: { id: string; email: string; image?: string | null }
      } | null

    const chief = { sub: 'google-sub-chief', email: 'chief@example.test', name: '회장' }
    const first = await googleLogin(chief)
    const chiefId = (await sessionOf(first.cookie))?.user.id ?? ''
    await t.test('처음 로그인하면 사진 주소와 토큰 없이 계정과 세션이 생긴다', async () => {
      assert.equal(first.location, '/')
      assert.deepEqual(await storedGoogleValues(), [NO_GOOGLE_VALUES])
      const session = await sessionOf(first.cookie)
      assert.equal(session?.user.email, chief.email)
      assert.equal(session?.user.image ?? null, null)
    })
    await t.test('같은 계정으로 다시 로그인해도 같은 계정이고 값이 들어가지 않는다', async () => {
      const again = await googleLogin(chief)
      assert.equal(again.location, '/')
      assert.equal((await sessionOf(again.cookie))?.user.id, chiefId)
      assert.deepEqual(await storedGoogleValues(), [NO_GOOGLE_VALUES])
    })
    await t.test('로그인한 세션으로 학생회를 만들고 다른 사람이 초대로 들어온다', async () => {
      const created = await post('/api/organizations/create', first.cookie, {
        name: '컴퓨터학부 학생회',
        unit: 'department',
        schoolName: '한양대학교 ERICA',
        year: 2026,
      })
      assert.equal(created.status, 201)
      const { council } = (await created.json()) as { council: { id: string } }
      const invite = await request(`/api/organizations/${council.id}/invite`, {
        headers: { Cookie: first.cookie },
      })
      const { code } = (await invite.json()) as { code: string }
      const member = await googleLogin({
        sub: 'google-sub-member',
        email: 'member@example.test',
        name: '부원',
      })
      assert.equal((await post('/api/organizations/join', member.cookie, { code })).status, 200)
      const mine = await request('/api/me/councils', { headers: { Cookie: member.cookie } })
      assert.equal(((await mine.json()) as { councils: unknown[] }).councils.length, 1)
      assert.deepEqual(await storedGoogleValues(), [NO_GOOGLE_VALUES, NO_GOOGLE_VALUES])
    })
    await t.test('같은 이메일의 다른 Google 계정은 지금처럼 잇지 않는다', async () => {
      const other = await googleLogin({ ...chief, sub: 'google-sub-other' })
      assert.match(other.location, /error=account_not_linked/)
      assert.equal((await pg.query('SELECT id FROM accounts')).rows.length, 2)
    })
    // 1.7.6에서는 계정 잇기·토큰 갱신의 모든 경로가 내부 어댑터의 이 함수들을 지나서 그것을 직접 부른다.
    // 판이 올라 다른 길로 쓰게 되면 이 시험은 못 잡고, 조각 3의 DB CHECK가 마지막으로 막는다.
    await t.test(
      '내 정보 바꾸기와 내부 어댑터의 계정 잇기·갱신도 사진과 토큰을 쓰지 않는다',
      async () => {
        const updated = await post('/api/auth/update-user', first.cookie, {
          image: 'https://example.test/photo.png',
        })
        assert.equal(updated.status, 200)
        const context = await auth.$context
        const tokens = {
          accessToken: 'direct-access',
          refreshToken: 'direct-refresh',
          idToken: 'direct-id',
          accessTokenExpiresAt: new Date(),
          refreshTokenExpiresAt: new Date(),
        }
        const linked = await context.internalAdapter.linkAccount({
          userId: chiefId,
          providerId: 'google-extra',
          accountId: 'extra-subject',
          ...tokens,
        })
        await context.internalAdapter.updateAccount(linked.id, tokens)
        assert.deepEqual(await storedGoogleValues(chiefId), [NO_GOOGLE_VALUES, NO_GOOGLE_VALUES])
      },
    )
    await t.test('계정 지우기는 꺼져 있고, 로그아웃하면 세션이 끝난다', async () => {
      assert.notEqual((await post('/api/auth/delete-user', first.cookie)).status, 200)
      assert.equal((await pg.query('SELECT id FROM users WHERE id = $1', [chiefId])).rows.length, 1)
      assert.equal((await post('/api/auth/sign-out', first.cookie)).status, 200)
      assert.equal(await sessionOf(first.cookie), null)
    })
  } finally {
    await close()
  }
})
