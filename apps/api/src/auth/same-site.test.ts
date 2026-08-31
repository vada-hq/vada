import { describe, expect, it } from 'vitest'
import { sameSiteHosts } from './auth.ts'

// **여기가 틀리면 로그인은 되는데 그다음이 남남이다.**
//
// 쿠키가 따라가지 않으면 사람은 "로그인했는데 아무것도 안 보인다"만 겪고, 서버
// 로그에는 로그인하지 않은 요청만 남는다 — 가장 찾기 어려운 모양이다.

describe('두 주소가 같은 사이트인가', () => {
  it('한 도메인 아래면 같다', () => {
    expect(sameSiteHosts('https://api.vada.app', 'https://vada.app')).toBe(true)
    expect(sameSiteHosts('https://api.vada.app', 'https://www.vada.app')).toBe(true)
  })

  it('호스팅 기본 주소끼리는 다르다', () => {
    // 도메인을 사기 전의 자리다. 여기서 쿠키를 죄면 로그인이 아예 안 된다.
    expect(sameSiteHosts('https://vada-api.fly.dev', 'https://vada.pages.dev')).toBe(false)
  })

  it('같은 곳이면 같다', () => {
    expect(sameSiteHosts('http://localhost:8787', 'http://localhost:5173')).toBe(true)
  })

  // 주소가 아닌 값이 와도 터지지 않는다 — 터지면 서버가 서지 않는다.
  it('주소가 아니어도 터지지 않는다', () => {
    expect(sameSiteHosts('아무 말', '아무 말')).toBe(true)
    expect(sameSiteHosts('아무 말', 'https://vada.app')).toBe(false)
  })
})
