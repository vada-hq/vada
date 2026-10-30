// @vitest-environment node
import { expect, test, vi } from 'vitest'
import { CreateFormSchema } from '@vada/contracts'
import {
  emptyFormValues,
  formErrors,
  formRequest,
  hasFee,
  missingRequired,
  newFormValues,
  previewOf,
  valuesOfForm,
} from './registration-form'
import { periodRow } from './registration-view'
import { ACCOUNT_ID, staffForm } from '@/test-support/staff-registration-fixtures'

const filled = { ...emptyFormValues, closesAt: '2026-10-23T18:00' }

test('처음 값: 이름은 참가 신청, 무료, 학번은 받는다. 비운 칸은 null이고 계좌는 보내지 않는다', () => {
  expect(formRequest(filled, ACCOUNT_ID)).toEqual({
    name: '참가 신청',
    opensAt: null,
    closesAt: '2026-10-23T18:00',
    capacity: null,
    notice: null,
    collectsPhone: false,
    collectsStudentId: true,
    payerFee: null,
    nonPayerFee: null,
    feeAccountId: null,
    questions: [],
  })
})

test('참가비 하나는 두 칸에 같은 값으로, 납부자 별도 금액은 두 값으로 보낸다. 0원뿐이면 계좌를 보내지 않는다', () => {
  expect(formRequest({ ...filled, feeKind: 'one', fee: '5000' }, ACCOUNT_ID)).toMatchObject({
    payerFee: 5000,
    nonPayerFee: 5000,
    feeAccountId: ACCOUNT_ID,
  })
  const split = { ...filled, feeKind: 'split' as const, payerFee: '0', nonPayerFee: '1000' }
  expect(hasFee(split)).toBe(true)
  expect(formRequest(split, ACCOUNT_ID)).toMatchObject({ payerFee: 0, nonPayerFee: 1000 })
  expect(hasFee({ ...filled, feeKind: 'one', fee: '0' })).toBe(false)
})

test('납부자 별도 금액이면 학번 받기를 꺼도 학번을 받는다', () => {
  const split = {
    ...filled,
    feeKind: 'split' as const,
    payerFee: '5000',
    nonPayerFee: '10000',
    collectsStudentId: false,
  }
  expect(formRequest(split, ACCOUNT_ID).collectsStudentId).toBe(true)
  expect(formRequest({ ...filled, collectsStudentId: false }, null).collectsStudentId).toBe(false)
})

test('누를 때 확인: 빈 필수 칸, 마감 순서, 숫자가 아닌 정원과 참가비를 칸마다 알린다', () => {
  expect(formErrors({ ...emptyFormValues, name: ' ' }, false)).toEqual({
    name: '양식 이름을 입력해 주세요',
    closesAt: '신청 마감을 입력해 주세요',
  })
  expect(
    formErrors(
      {
        ...filled,
        opensAt: '2026-10-24T09:00',
        capacity: '열',
        feeKind: 'one',
        fee: '',
      },
      false,
    ),
  ).toEqual({
    closesAt: '신청 시작보다 늦은 시각을 입력해 주세요',
    capacity: '1 이상의 숫자를 입력해 주세요',
    fee: '참가비를 입력해 주세요',
  })
  expect(formErrors(filled, false)).toEqual({})
})

test('초안은 마감을 비워도 칸 문제가 없고 남은 필수 칸에 세지 않으며 요청의 마감은 null이다', () => {
  const open = { ...filled, closesAt: '' }
  expect(formErrors(open, true)).toEqual({})
  expect(formErrors(open, false)).toEqual({ closesAt: '신청 마감을 입력해 주세요' })
  expect(missingRequired(open, null, true)).toEqual([])
  expect(formRequest(open, null).closesAt).toBeNull()
  expect(CreateFormSchema.safeParse(formRequest(open, null)).success).toBe(true)
})

test('계약도 숫자가 아닌 글과 마감 순서를 거절한다', () => {
  const ok = (values: typeof filled) =>
    CreateFormSchema.safeParse(formRequest(values, null)).success
  expect(ok(filled)).toBe(true)
  expect(ok({ ...filled, capacity: '열' })).toBe(false)
  expect(ok({ ...filled, capacity: '0' })).toBe(false)
  expect(ok({ ...filled, opensAt: '2026-10-24T09:00' })).toBe(false)
})

test('양식의 값은 입력칸 글로 옮겨지고 참가비 방식과 학번 받기를 되살린다', () => {
  expect(
    valuesOfForm(staffForm({ notice: null, capacity: null, payerFee: 0, nonPayerFee: 0 })),
  ).toMatchObject({ capacity: '', notice: '', feeKind: 'one', fee: '0' })
  expect(valuesOfForm(staffForm({ payerFee: null, nonPayerFee: null }))).toMatchObject({
    feeKind: 'none',
  })
  expect(
    valuesOfForm(staffForm({ collectsStudentId: false, payerFee: null, nonPayerFee: null })),
  ).toMatchObject({ collectsStudentId: false })
  expect(valuesOfForm(staffForm())).toMatchObject({
    feeKind: 'split',
    payerFee: '5000',
    nonPayerFee: '10000',
  })
})

test('미리보기는 행사 일시·장소와 받는 칸을 그대로 담고, 지우는 날은 행사 끝 + 1년이다', () => {
  const event = {
    name: '학과의 밤',
    startsAt: '2026-11-07T18:00',
    endsAt: '2026-11-07T21:00',
    place: '학생회관',
  }
  const preview = previewOf({ ...filled, collectsPhone: true }, event, '학생회')
  expect(preview).toMatchObject({
    councilName: '학생회',
    event,
    status: 'open',
    collectsStudentId: true,
    collectsPhone: true,
    payerFee: null,
    purgeOn: '2027-11-07',
  })
})

test('새 양식의 신청 마감은 행사 시작 시각이고, 행사 시작이 없거나 행사를 읽기 전이면 비어 있다', () => {
  expect(newFormValues({ startsAt: '2026-10-24T14:00' })).toEqual({
    ...emptyFormValues,
    closesAt: '2026-10-24T14:00',
  })
  expect(newFormValues({ startsAt: null }).closesAt).toBe('')
  expect(newFormValues(null).closesAt).toBe('')
})

test('남은 필수 칸은 화면 차례대로 이름·마감·참가비 금액·계좌이고, 계좌는 참가비가 있을 때만 센다', () => {
  expect(missingRequired(filled, null, false)).toEqual([])
  expect(missingRequired({ ...emptyFormValues, name: ' ' }, null, false)).toEqual([
    'name',
    'closesAt',
  ])
  expect(missingRequired({ ...filled, feeKind: 'one' }, null, false)).toEqual(['fee'])
  expect(missingRequired({ ...filled, feeKind: 'one', fee: '5000' }, null, false)).toEqual([
    'account',
  ])
  expect(missingRequired({ ...filled, feeKind: 'one', fee: '5000' }, ACCOUNT_ID, false)).toEqual([])
  expect(
    missingRequired({ ...filled, feeKind: 'split', payerFee: '5000' }, ACCOUNT_ID, false),
  ).toEqual(['nonPayerFee'])
})

test('양식 카드의 신청 기간은 올해가 아니면 연도를 붙인다', () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-10-31T03:00:00Z'))
  expect(periodRow({ opensAt: '2026-12-30T10:00', closesAt: '2027-01-04T18:00' }).value).toBe(
    '12월 30일 (수) 10:00 ~ 2027년 1월 4일 (월) 18:00',
  )
  expect(periodRow({ opensAt: null, closesAt: '2025-03-02T18:00' }).value).toBe(
    '2025년 3월 2일 (일) 18:00',
  )
  vi.useRealTimers()
})
