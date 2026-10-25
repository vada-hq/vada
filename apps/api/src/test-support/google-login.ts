import assert from 'node:assert/strict'
import type { TestContext } from 'node:test'

// Google 로그인 콜백을 끝까지 돈다. 토큰 주소만 가짜로 답하고, id_token은 Google 공급자가 서명을 보지 않고 풀어 쓴다(code 흐름).
// 외부 서비스 없이 돈다. 토큰 주소 말고 다른 곳으로 나가려 하면 시험이 바로 실패한다.
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'
const base64url = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url')
const unsignedIdToken = (claims: Record<string, unknown>) =>
  `${base64url({ alg: 'RS256', kid: 'test' })}.${base64url(claims)}.signature`

// 응답이 보낸 쿠키를 다음 요청의 Cookie 머리로 잇는다.
const cookieOf = (response: Response) =>
  response.headers
    .getSetCookie()
    .map(item => item.split(';')[0]!)
    .join('; ')

export type GoogleProfile = { sub: string; email: string; name: string }
type Send = (path: string, init?: RequestInit) => Response | Promise<Response>

// 로그인 버튼 → Google → 콜백. 콜백이 보낸 쿠키와 옮겨 가는 주소를 돌려준다.
// request는 같은 앱에 `${baseURL}${path}`로 보내는 함수다. 프로필 사진 주소도 함께 보내 저장되지 않는지 볼 수 있다.
export function fakeGoogleLogin(t: TestContext, baseURL: string, request: Send) {
  let googleProfile: Record<string, unknown> = {}
  t.mock.method(globalThis, 'fetch', (input: RequestInfo | URL) => {
    const url = input instanceof Request ? input.url : String(input)
    if (url !== GOOGLE_TOKEN_URL) throw new Error(`예상하지 않은 외부 요청: ${url}`)
    return Promise.resolve(
      Response.json({
        access_token: 'google-access-token',
        refresh_token: 'google-refresh-token',
        id_token: unsignedIdToken(googleProfile),
        expires_in: 3599,
        refresh_token_expires_in: 604799,
        token_type: 'Bearer',
        scope: 'openid email profile',
      }),
    )
  })
  return async (profile: GoogleProfile) => {
    googleProfile = {
      ...profile,
      email_verified: true,
      picture: 'https://lh3.googleusercontent.com/a/profile-photo',
      iss: 'https://accounts.google.com',
      aud: 'test-client',
    }
    const start = await request('/api/auth/sign-in/social', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: baseURL },
      body: JSON.stringify({ provider: 'google', callbackURL: '/', disableRedirect: true }),
    })
    assert.equal(start.status, 200)
    const { url } = (await start.json()) as { url: string }
    const state = new URL(url).searchParams.get('state') ?? ''
    const callback = await request(
      `/api/auth/callback/google?code=test-code&state=${encodeURIComponent(state)}`,
      { headers: { Cookie: cookieOf(start) } },
    )
    assert.equal(callback.status, 302)
    return { cookie: cookieOf(callback), location: callback.headers.get('location') ?? '' }
  }
}
