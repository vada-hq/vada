import { expect, test } from 'vitest'
import { ApplySchema } from '@vada/contracts'
import { phoneView } from './phone-view'

test('휴대폰 번호를 하이픈으로 나누어 보인다', () => {
  expect(phoneView('01012345678')).toBe('010-1234-5678')
  expect(phoneView('0101234567')).toBe('010-123-4567')
  expect(phoneView('010')).toBe('010')
})

// 넘친 숫자를 잘라 내면 다른 번호가 계약 검사를 통과해 저장된다. 숫자는 남겨 칸 확인이 알리게 한다.
test('11자리를 넘긴 숫자는 자르지 않아 칸 확인에서 걸린다', () => {
  const shown = phoneView('010123456789')
  expect(shown.replace(/\D/g, '')).toBe('010123456789')
  expect(ApplySchema.shape.phone.safeParse(shown).success).toBe(false)
})
