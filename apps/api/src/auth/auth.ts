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
    database: drizzleAdapter(db, {
      provider: 'pg',
      schema,
      // **표 이름이 복수다.** Better Auth는 `user`·`session`·`account`·`verification`을
      // 찾는데 이 저장소의 표는 `users`·`sessions`·`accounts`·`verifications`다 —
      // 다른 표들과 같은 규칙을 로그인 표에만 깨고 싶지 않았다.
      //
      // 이 한 줄이 없으면 **켤 때가 아니라 사람이 로그인 단추를 눌렀을 때** 터진다.
      // 실제로 그랬다(2026-09-02, 배포 첫 로그인에서 500).
      usePlural: true,
    }),
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
    advanced: {
      // **보낸 사람의 주소를 어디서 읽는가.**
      //
      // 앞에 Cloudflare Worker가 있어 서버가 직접 보는 주소는 늘 같다. 말해 주지
      // 않으면 Better Auth가 속도 제한을 **모두에게 한 칸**으로 세고, 그 사실을
      // 로그로만 알린다 — 켜 두고 안 듣는 경보다.
      //
      // 이 헤더를 그대로 믿는 것은 완전하지 않다. Render 주소가 밖에서도 열려 있어
      // 누군가 Worker를 거치지 않고 직접 부르며 이 값을 지어낼 수 있다. 우리 쪽
      // 속도 세기도 같은 헤더를 믿는다 — 그 구멍은 BACKLOG에 적었다.
      ipAddress: { ipAddressHeaders: ['x-forwarded-for'] },
      // **화면과 api가 다른 사이트면 쿠키가 따라가지 않는다.**
      //
      // 기본값(`SameSite=Lax`)은 다른 사이트에서 온 요청에 쿠키를 붙이지 않는다.
      // 로그인은 되는데 그다음 요청마다 로그인하지 않은 사람으로 보이는, 가장
      // 헷갈리는 모양이 된다. 같은 사이트면 기본값이 더 안전하므로 **다를 때만** 푼다.
      //
      // 다만 `None`은 브라우저가 서드파티 쿠키로 취급해 막을 수 있다(Safari는 이미,
      // Chrome도 줄이는 중이다). **제대로 된 답은 한 도메인 아래 두는 것**이다 —
      // `vada.app`과 `api.vada.app`이면 여기가 다시 `Lax`로 돌아온다.
      defaultCookieAttributes: sameSiteHosts(settings.baseUrl, settings.appUrl)
        ? { sameSite: 'lax', secure: settings.baseUrl.startsWith('https://') }
        : { sameSite: 'none', secure: true },
    },
  })
}

/**
 * 두 주소가 **같은 사이트**인가.
 *
 * 정확히는 등록 가능 도메인(eTLD+1)을 견줘야 하는데 그 목록은 서버가 들 것이 아니다.
 * 여기서는 호스트의 뒤 두 조각으로 어림한다 — `api.vada.app`과 `vada.app`은 같고
 * `x.pages.dev`와 `y.fly.dev`는 다르다. **틀리는 쪽이 안전한 어림이다**: 같은데 다르다고
 * 보면 쿠키가 조금 헐거워지고, 다른데 같다고 보면 로그인이 아예 안 된다.
 */
export function sameSiteHosts(left: string, right: string): boolean {
  const host = (url: string) => {
    try {
      return new URL(url).hostname.split('.').slice(-2).join('.')
    } catch {
      return url
    }
  }
  return host(left) === host(right)
}

export type Auth = ReturnType<typeof createAuth>

/** 들어오는 길 하나. */
/**
 * 어느 길이 열려 있는가.
 *
 * **글은 여기서 오지 않는다.** 한동안 서버가 단추의 글까지 주었다 — "길이 늘 때 화면을
 * 고치지 않는다"는 뜻이었는데, 이 저장소에서 **단추의 글은 그림에서 온다**(백쉰아홉 개가
 * 전부 그렇다). 로그인 단추만 예외로 두면 그 글이 어디서 오는지 사람마다 다르게 안다.
 *
 * 그리고 길이 느는 것은 배포 설정이 아니라 **제품이 바뀌는 일**이다 — 새 길은 그림에
 * 그려지고 명세를 거쳐 온다. 서버가 답하는 것은 '그 길이 지금 열려 있는가'뿐이다.
 */
export interface OpenWays {
  google: boolean
  kakao: boolean
}



/**
 * 어느 길로 들어올 수 있는가.
 *
 * **글까지 준다.** 이름만 주면 화면이 '구글'이라는 말을 갖게 되고, 길이 하나 늘 때마다
 * 화면을 고쳐야 한다 — 이 저장소가 명세와 화면 사이에서 줄곧 피해 온 모양이다.
 * 자격증명이 없는 길은 오지 않으므로 화면은 온 것만 그리면 된다.
 */
export function openWays(settings: AuthSettings): OpenWays {
  return {
    google: settings.google !== undefined,
    kakao: settings.kakao !== undefined,
  }
}

