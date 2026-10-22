// @vitest-environment node
import { expect, test } from 'vitest'
import { CreateFormSchema } from '@vada/contracts'
import { emptyFormValues, formRequest, hasFee, valuesOfForm } from './registration-form'
import { ACCOUNT_ID, staffForm } from '@/test-support/staff-registration-fixtures'

const filled = { ...emptyFormValues, name: '신청', closesAt: '2026-10-23T18:00' }

test('비운 칸은 null이 되고 참가비가 없으면 계좌를 보내지 않는다', () => {
  expect(formRequest(filled, ACCOUNT_ID)).toEqual({
    name: '신청',
    opensAt: null,
    closesAt: '2026-10-23T18:00',
    capacity: null,
    notice: null,
    collectsPhone: false,
    payerFee: null,
    nonPayerFee: null,
    feeAccountId: null,
  })
})

test('참가비가 0보다 크면 계좌를 보내고, 둘 다 0이면 보내지 않는다', () => {
  expect(hasFee({ payerFee: '0', nonPayerFee: '1000' })).toBe(true)
  expect(hasFee({ payerFee: '0', nonPayerFee: '0' })).toBe(false)
  expect(
    formRequest({ ...filled, payerFee: '0', nonPayerFee: '0' }, ACCOUNT_ID).feeAccountId,
  ).toBeNull()
})

test('숫자가 아닌 글과 한쪽만 적은 참가비는 계약이 거절한다', () => {
  const ok = (values: typeof filled) =>
    CreateFormSchema.safeParse(formRequest(values, null)).success
  expect(ok(filled)).toBe(true)
  expect(ok({ ...filled, capacity: '열' })).toBe(false)
  expect(ok({ ...filled, payerFee: '5000' })).toBe(false)
  expect(ok({ ...filled, capacity: '0' })).toBe(false)
  expect(ok({ ...filled, opensAt: '2026-10-24T09:00' })).toBe(false)
})

test('양식의 값은 입력칸 글로 옮겨진다', () => {
  expect(
    valuesOfForm(staffForm({ notice: null, capacity: null, payerFee: 0, nonPayerFee: 0 })),
  ).toMatchObject({
    capacity: '',
    notice: '',
    payerFee: '0',
    nonPayerFee: '0',
  })
})
