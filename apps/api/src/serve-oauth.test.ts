import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import type { Auth } from './auth/auth.ts'
import type { Db } from './db/client.ts'
import { freshDb } from './db/testing.ts'
import { members, organizations } from './db/schema.ts'

const SITE = 'https://vada.example'
let db: Db
let auth: Auth
let request: (request: Request) => Response | Promise<Response>
const exchangeCode = vi.fn(async () => ({ accessToken: 'local-test-token' }))

// 배포의 serve.ts를 그대로 조립한다. 소켓·운영 설정·DB 연결만 대체하고,
// 인증 시작 응답, Better Auth의 state 검증·세션 생성, app.start는 실제 코드를 쓴다.
beforeAll(async () => {
  db = (await freshDb()).db as unknown as Db
  vi.doMock('@hono/node-server', () => ({
    serve: (options: { fetch: typeof request }) => { request = options.fetch },
  }))
  vi.doMock('./config.ts', () => ({
    readConfig: () => ({
      databaseUrl: 'local-test-only',
      authSecret: 'local-test-secret-that-is-at-least-32-characters',
      baseUrl: SITE,
      appUrl: SITE,
      inviteLinkBase: `${SITE}/join`,
      port: 0,
      google: { clientId: 'local-google-id', clientSecret: 'local-google-secret' },
      kakao: { clientId: 'local-kakao-id', clientSecret: 'local-kakao-secret' },
    }),
  }))
  vi.doMock('./db/client.ts', () => ({ connect: () => db }))
  vi.doMock('./auth/auth.ts', async (original) => {
    const actual = await original<typeof import('./auth/auth.ts')>()
    return {
      ...actual,
      createAuth: (...args: Parameters<typeof actual.createAuth>) => {
        auth = actual.createAuth(...args)
        return auth
      },
    }
  })
  await import('./serve.ts')
  const context = await auth.$context
  const google = context.socialProviders.find((provider) => provider.id === 'google')!
  // 구글과의 외부 통신만 대체한다. state와 세션 검증을 우회하지 않는다.
  vi.spyOn(google, 'validateAuthorizationCode').mockImplementation(exchangeCode)
  vi.spyOn(google, 'getUserInfo').mockImplementation(async () => ({
    user: { name: 'OAuth Test', email: 'oauth@example.test', emailVerified: true },
    data: { sub: 'google-test-user' },
  }))
  vi.spyOn(context.logger, 'error').mockImplementation(() => {})
}, 60_000)

afterAll(() => {
  vi.restoreAllMocks()
  for (const module of ['@hono/node-server', './config.ts', './db/client.ts', './auth/auth.ts']) {
    vi.doUnmock(module)
  }
  vi.resetModules()
})

function cookieHeader(response: Response): string {
  return response.headers.getSetCookie().map((cookie) => cookie.split(';')[0]).join('; ')
}

async function start(provider = 'google') {
  const response = await request(new Request(`${SITE}/api/sign-in/${provider}`, {
    method: 'POST', headers: { origin: SITE, 'content-type': 'application/json' }, body: '{}',
  }))
  expect(response.status).toBe(200)
  const body = await response.json() as { url: string }
  expect(Object.keys(body)).toEqual(['url'])
  return { response, state: new URL(body.url).searchParams.get('state')! }
}

async function completeSignIn() {
  const started = await start()
  expect(started.response.headers.getSetCookie().length).toBeGreaterThan(0)
  const callback = await request(new Request(
    `${SITE}/api/auth/callback/google?state=${encodeURIComponent(started.state)}&code=local-test-code`,
    { headers: { cookie: cookieHeader(started.response) } },
  ))
  expect(callback.status).toBe(302)
  expect(callback.headers.get('location')).toBe(SITE)
  const cookies = cookieHeader(callback)
  const session = await auth.api.getSession({ headers: new Headers({ cookie: cookies }) })
  expect(session).not.toBeNull()
  return { cookies, userId: session!.user.id }
}

describe('배포 서버의 OAuth 왕복', () => {
  it.each(['google', 'kakao'])('%s 시작 응답이 검증용 쿠키를 전달한다', async (provider) => {
    const { response } = await start(provider)
    const cookies = response.headers.getSetCookie()
    expect(cookies.length).toBeGreaterThan(0)
    expect(cookies.some((cookie) => cookie.includes('HttpOnly') && cookie.includes('Secure'))).toBe(true)
  })

  it('콜백에서 만든 세션으로 소속을 판단하고, 재로그인한 구성원은 홈으로 간다', async () => {
    const first = await completeSignIn()
    const startScreen = async (cookies: string) => {
      const response = await request(new Request(`${SITE}/api/app/start`, { headers: { cookie: cookies } }))
      expect(response.status).toBe(200)
      return response.json()
    }
    expect(await startScreen(first.cookies)).toEqual({ screenId: 'ONB-01' })
    await db.insert(organizations).values({ id: 'O-OAUTH', name: 'OAuth Test Org' })
    await db.insert(members).values({
      id: 'M-OAUTH', orgId: 'O-OAUTH', userId: first.userId, name: 'OAuth Test', role: 'chair',
    })
    const signedOut = await request(new Request(`${SITE}/api/sign-out`, {
      method: 'POST', headers: { cookie: first.cookies, origin: SITE, 'content-type': 'application/json' }, body: '{}',
    }))
    expect(signedOut.status).toBe(200)
    expect(await startScreen(first.cookies)).toEqual({ screenId: 'SIGN-IN' })
    const returning = await completeSignIn()
    expect(returning.userId).toBe(first.userId)
    expect(await startScreen(returning.cookies)).toEqual({ screenId: 'HOME-01K' })
  })

  it('쿠키가 빠진 콜백은 계속 거부한다', async () => {
    const { state } = await start()
    const calls = exchangeCode.mock.calls.length
    const response = await request(new Request(
      `${SITE}/api/auth/callback/google?state=${encodeURIComponent(state)}&code=local-test-code`,
    ))
    expect(response.status).toBe(302)
    expect(new URL(response.headers.get('location')!).searchParams.get('error')).toBe('state_mismatch')
    expect(exchangeCode.mock.calls.length).toBe(calls)
  })
})
