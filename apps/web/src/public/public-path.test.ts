import { expect, test } from 'vitest'
import { mineHref, publicRouteOf, tokenOfHash } from './public-path'

test('신청 주소와 내 신청 주소를 가르고 나머지는 공개 화면이 아니다', () => {
  expect(publicRouteOf('/apply/ABCD2345')).toEqual({ kind: 'apply', code: 'ABCD2345' })
  expect(publicRouteOf('/apply/abcd2345/')).toEqual({ kind: 'apply', code: 'ABCD2345' })
  expect(publicRouteOf('/r')).toEqual({ kind: 'mine' })
  expect(publicRouteOf('/')).toBeNull()
  expect(publicRouteOf('/apply')).toBeNull()
  expect(publicRouteOf('/apply/A/B')).toBeNull()
  expect(publicRouteOf('/join/ABCD2345')).toBeNull()
  expect(publicRouteOf('/random')).toBeNull()
})

test('깨진 퍼센트 부호가 있어도 던지지 않는다', () => {
  expect(publicRouteOf('/apply/%E0%A4%A')).toEqual({ kind: 'apply', code: '%E0%A4%A' })
})

test('개인 링크 토큰은 # 뒤에만 둔다', () => {
  expect(mineHref('tok')).toBe('/r#tok')
  expect(mineHref('tok')).not.toContain('?')
  expect(tokenOfHash('#tok')).toBe('tok')
  expect(tokenOfHash('')).toBe('')
})
