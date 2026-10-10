import { expect, test } from 'vitest'
import { applyPath, minePath, publicRoute, shouldLeaveKakao, tokenFromHash } from './public-route'

const kakao = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 KAKAOTALK 10.4.5'
const chrome = 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/129.0 Mobile Safari/537.36'

test('공개 주소: /apply/코드는 신청, /r은 내 신청이고 그 밖은 앱이다', () => {
  expect(publicRoute('/apply/ABCD2345')).toEqual({ kind: 'apply', code: 'ABCD2345' })
  expect(publicRoute('/apply/AB%20CD')).toEqual({ kind: 'apply', code: 'AB CD' })
  expect(publicRoute('/r')).toEqual({ kind: 'mine' })
  for (const path of ['/', '/join/ABCD2345', '/apply/', '/apply/a/b', '/r/x', '/rr', '/apply']) expect(publicRoute(path)).toBeNull()
})

test('주소 만들기와 토큰 꺼내기: 토큰은 # 뒤에 둔다', () => {
  expect(applyPath('ABCD2345')).toBe('/apply/ABCD2345')
  expect(minePath('Ab3_-xYz0123456789abcd')).toBe('/r#Ab3_-xYz0123456789abcd')
  expect(tokenFromHash('#Ab3_-xYz0123456789abcd')).toBe('Ab3_-xYz0123456789abcd')
  for (const hash of ['', '#']) expect(tokenFromHash(hash)).toBeNull()
})

test('카카오톡: 공개 화면은 로그인이 없어 그대로 열고, 앱 화면만 기본 브라우저로 넘긴다', () => {
  expect(shouldLeaveKakao(publicRoute('/apply/ABCD2345'), kakao)).toBe(false)
  expect(shouldLeaveKakao(publicRoute('/r'), kakao)).toBe(false)
  expect(shouldLeaveKakao(publicRoute('/'), kakao)).toBe(true)
  expect(shouldLeaveKakao(publicRoute('/join/ABCD2345'), kakao)).toBe(true)
  expect(shouldLeaveKakao(publicRoute('/'), chrome)).toBe(false)
})
