import { describe, expect, it } from 'vitest'
import { parseSignInResponse } from './sign-in'

describe('로그인 시작 응답의 경계', () => {
  it('두 제공자의 URL을 변경하지 않고 전달한다', () => {
    for (const url of ['https://accounts.google.example/?state=test', 'https://kauth.kakao.example/?state=test', '']) {
      expect(parseSignInResponse({ url })).toEqual({ url })
    }
  })

  it('실패하거나 URL이 문자열이 아닌 응답은 이동에 사용하지 않는다', () => {
    for (const value of [null, undefined, {}, [], 'https://example.test', 12, { url: null }, { url: 12 }]) {
      expect(parseSignInResponse(value)).toBeNull()
    }
  })

  it('URL 외의 필드는 이동에 전달하지 않는다', () => {
    expect(parseSignInResponse({ url: 'https://example.test', headers: {} }))
      .toEqual({ url: 'https://example.test' })
  })
})
