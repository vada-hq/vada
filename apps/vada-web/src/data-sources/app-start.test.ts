import { describe, expect, it } from 'vitest'
import { parseAppStartResponse } from './app-start'

describe('앱 시작 응답의 경계', () => {
  it('서버가 보낸 화면 ID를 그대로 전달한다', () => {
    for (const screenId of ['SIGN-IN', 'ONB-01', 'HOME-01K', 'FUTURE-SCREEN', '']) {
      expect(parseAppStartResponse({ screenId })).toEqual({ screenId })
    }
  })

  it('응답이 없거나 화면 ID가 문자열이 아니면 기존 시작 화면으로 돌아갈 수 있다', () => {
    for (const value of [null, undefined, {}, [], 'HOME-01K', 12, { screenId: null }, { screenId: 12 }]) {
      expect(parseAppStartResponse(value)).toBeNull()
    }
  })

  it('화면 ID 외의 응답 값은 화면 이동에 전달하지 않는다', () => {
    expect(parseAppStartResponse({ screenId: 'HOME-01K', extra: 'ignored' })).toEqual({ screenId: 'HOME-01K' })
  })
})
