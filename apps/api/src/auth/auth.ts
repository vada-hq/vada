import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import type { Db } from '../db/client.ts'
import * as schema from '../db/schema.ts'

// 누가 로그인했는가.
//
// **명세에 로그인 화면이 없다.** 와이어프레임은 이미 들어온 사람만 그린다 — 그래서
// 이 층은 명세에서 나오지 않고 사람이 정한 것이다(소셜 로그인, 2026-08-29).
//
// 직접 짓지 않고 Better Auth를 쓴다. 비밀번호를 다루지 않고 세션을 남이 검증한 방식으로
// 관리하는 것이 이 규모에서 가장 안전하다 — 그리고 **직접 짠 인증은 검토받을 방법이 없다.**

export interface AuthSettings {
  /** 세션 쿠키에 서명하는 비밀. **없으면 서지 않는다** — 없는 채로 도는 것이 가장 나쁘다. */
  secret: string
  /** 이 서버가 어디에 있는가. 소셜 로그인이 돌아올 자리를 만든다. */
  baseUrl: string
  /** 화면이 어디에 있는가. 로그인 뒤 돌아갈 곳이다. */
  appUrl: string
  google?: { clientId: string; clientSecret: string }
  kakao?: { clientId: string; clientSecret: string }
}

/**
 * 로그인 층.
 *
 * **자격증명이 없으면 그 길이 없다.** 구글·카카오 열쇠가 없는 채로 켜 두면 사람이
 * 눌렀을 때 알 수 없는 오류를 보게 된다 — 있는 길만 연다.
 */
export function createAuth(db: Db, settings: AuthSettings) {
  const social: Record<string, { clientId: string; clientSecret: string }> = {}
  if (settings.google !== undefined) social.google = settings.google
  if (settings.kakao !== undefined) social.kakao = settings.kakao

  return betterAuth({
    database: drizzleAdapter(db, { provider: 'pg', schema }),
    secret: settings.secret,
    baseURL: settings.baseUrl,
    trustedOrigins: [settings.appUrl],
    // **비밀번호를 다루지 않는다.** 저장할 것이 없으면 샐 것도 없다.
    emailAndPassword: { enabled: false },
    socialProviders: social,
    session: {
      // 학생회 도구는 며칠에 한 번 열린다. 매번 다시 로그인하게 하면 사람이
      // 브라우저에 로그인 상태를 남기는 다른 방법을 찾는다.
      expiresIn: 60 * 60 * 24 * 30,
      updateAge: 60 * 60 * 24,
    },
  })
}

export type Auth = ReturnType<typeof createAuth>

/** 어느 길로 들어올 수 있는가. 화면이 단추를 그릴지 정할 때 쓴다. */
export function openWays(settings: AuthSettings): string[] {
  const ways: string[] = []
  if (settings.google !== undefined) ways.push('google')
  if (settings.kakao !== undefined) ways.push('kakao')
  return ways
}
