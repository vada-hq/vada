import { expect, test } from 'vitest'
import { sellerOf } from './seller'

test('판매처는 링크의 호스트에서 www.·m.을 뺀 것이고, 주소가 아니면 없다', () => {
  expect(sellerOf('https://www.coupang.com/vp/products/1?itemId=2')).toBe('coupang.com')
  expect(sellerOf('https://m.coupang.com/vm/products/1')).toBe('coupang.com')
  expect(sellerOf('https://smartstore.naver.com/a/products/3')).toBe('smartstore.naver.com')
  expect(sellerOf('https://mall.example.kr/x')).toBe('mall.example.kr')
  expect(sellerOf('쿠팡')).toBeNull()
  expect(sellerOf('')).toBeNull()
})
