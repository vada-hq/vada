import { expect, test } from 'vitest'
import type { ApplicantAction } from '@vada/contracts'
import { actionsWhenAttended, actionsWhenCancelled, actionsWhenDeposit } from './registration-view'

test('출석하면 신청 취소 대신 출석 취소만, 출석을 취소하면 되돌린다. 관리 동작이 없던 줄은 더하지 않는다', () => {
  const before: ApplicantAction[] = [
    'registration.check_in',
    'registration.cancel',
    'deposit.confirm',
  ]
  const after = actionsWhenAttended(before, true)
  expect(after.sort()).toEqual(['deposit.confirm', 'registration.cancel_check_in'])
  expect(actionsWhenAttended(after, false).sort()).toEqual(before.slice().sort())
  expect(actionsWhenAttended(['deposit.confirm'], true)).toEqual(['deposit.confirm'])
  expect(actionsWhenAttended([], false)).toEqual([])
})

test('입금 확인은 확인 취소로, 확인 취소는 입금 확인으로 바꾸고 입금 권한이 없던 줄은 더하지 않는다', () => {
  expect(actionsWhenDeposit(['registration.cancel', 'deposit.confirm'], 'confirmed')).toEqual([
    'registration.cancel',
    'deposit.cancel',
  ])
  expect(actionsWhenDeposit(['deposit.cancel'], 'none')).toEqual(['deposit.confirm'])
  expect(actionsWhenDeposit(['registration.cancel'], 'confirmed')).toEqual(['registration.cancel'])
})

test('취소한 줄에서 출석·신청 취소를 뺀다', () => {
  expect(
    actionsWhenCancelled(['registration.check_in', 'registration.cancel', 'deposit.cancel']),
  ).toEqual(['deposit.cancel'])
})
