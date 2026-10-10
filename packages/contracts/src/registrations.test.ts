import assert from 'node:assert/strict'
import { test } from 'node:test'
import { UpdateEventSchema } from './events.js'
import { isStrictObject } from './input.js'
import { dateFromKorean, koreanDateTime, koreanOf } from './korean-time.js'
import { CancelRegistrationSchema, CreateRegistrationFormSchema, PaymentActionSchema, RegisterSchema, REGISTRATION_CAPACITY_MAX, REGISTRATION_FEE_MAX,
  REGISTRATION_NAME_MAX, REGISTRATION_NOTICE_MAX, RegistrationTokenSchema, SetDuesMemberSchema, UpdateRegistrationFormSchema } from './registrations.js'

// 테스트 파일에 제어 문자를 그대로 쓰지 않는다.
const nul = String.fromCharCode(0)
const lone = String.fromCharCode(0xd800)
const emoji = '😀'
const accepts = (schema: { safeParse: (value: unknown) => { success: boolean } }, values: unknown[]) => {
  for (const value of values) assert.equal(schema.safeParse(value).success, true, JSON.stringify(value))
}
const rejects = (schema: { safeParse: (value: unknown) => { success: boolean } }, values: unknown[]) => {
  for (const value of values) assert.equal(schema.safeParse(value).success, false, JSON.stringify(value))
}

test('한국 시각: 달력에 있는 분 단위 시각만 2000~2999년 안에서 받는다', () => {
  accepts(koreanDateTime, ['2026-08-20T10:00', '2000-01-01T00:00', '2999-12-31T23:59', '2028-02-29T12:30'])
  rejects(koreanDateTime, ['2026-02-30T10:00', '2027-02-29T10:00', '2026-08-20 10:00', '2026-08-20T24:00', '2026-08-20T10:60',
    '1999-12-31T23:59', '3000-01-01T00:00', '2026-08-20T10:00:00', '2026-8-20T10:00', '', 1])
})

test('한국 시각: 기기 시간대와 상관없이 같은 순간으로 바꾸고 되돌린다', () => {
  assert.equal(dateFromKorean('2026-08-20T10:00').toISOString(), '2026-08-20T01:00:00.000Z')
  assert.equal(dateFromKorean('2026-01-01T00:30').toISOString(), '2025-12-31T15:30:00.000Z')
  for (const value of ['2026-08-20T10:00', '2026-01-01T00:30', '2999-12-31T23:59', '2000-01-01T00:00']) {
    assert.equal(koreanOf(dateFromKorean(value)), value)
  }
  assert.equal(koreanOf(new Date('2026-08-20T15:00:00Z')), '2026-08-21T00:00')
})

const eventInfo = { version: 1, startsAt: '2026-08-20T10:00', endsAt: '2026-08-20T18:00', place: '체육관' }
test('행사 정보: 끝은 시작이 있어야 하고 시작보다 늦으며, 장소 앞뒤 공백을 지운다', () => {
  assert.equal(isStrictObject(UpdateEventSchema), true)
  assert.deepEqual(UpdateEventSchema.parse({ ...eventInfo, place: '  체육관 ' }), eventInfo)
  accepts(UpdateEventSchema, [{ version: 1, startsAt: null, endsAt: null, place: null }, { ...eventInfo, endsAt: null },
    { ...eventInfo, place: emoji.repeat(100) }, { ...eventInfo, endsAt: '2026-08-21T09:00' }])
  rejects(UpdateEventSchema, [{ ...eventInfo, startsAt: null }, { ...eventInfo, endsAt: '2026-08-20T10:00' }, { ...eventInfo, endsAt: '2026-08-20T09:59' },
    { ...eventInfo, place: emoji.repeat(101) }, { ...eventInfo, place: '   ' }, { ...eventInfo, place: `체육관${nul}` }, { ...eventInfo, place: `체육관${lone}` },
    { ...eventInfo, version: 0 }, { ...eventInfo, version: 1.5 }, { startsAt: null, endsAt: null, place: null }, { ...eventInfo, place: undefined },
    { ...eventInfo, name: '이름' }])
})

const form = { opensAt: null, closesAt: '2026-08-19T23:59', capacity: 200, notice: '문의: 학생회실', collectPhone: false, fee: 0, memberFee: null }
test('신청 설정: 마감은 꼭 있고 시작은 마감보다 앞이며, 정원·안내는 비울 수 있다', () => {
  assert.equal(isStrictObject(CreateRegistrationFormSchema), true)
  assert.equal(isStrictObject(UpdateRegistrationFormSchema), true)
  accepts(CreateRegistrationFormSchema, [form, { ...form, capacity: null, notice: null }, { ...form, opensAt: '2026-08-01T10:00' },
    { ...form, capacity: 1 }, { ...form, capacity: REGISTRATION_CAPACITY_MAX }, { ...form, notice: emoji.repeat(REGISTRATION_NOTICE_MAX) }])
  assert.equal(CreateRegistrationFormSchema.parse({ ...form, notice: '  문의 ' }).notice, '문의')
  rejects(CreateRegistrationFormSchema, [{ ...form, opensAt: form.closesAt }, { ...form, opensAt: '2026-08-20T00:00' }, { ...form, closesAt: undefined },
    { ...form, closesAt: null }, { ...form, capacity: 0 }, { ...form, capacity: REGISTRATION_CAPACITY_MAX + 1 }, { ...form, capacity: 1.5 },
    { ...form, notice: emoji.repeat(REGISTRATION_NOTICE_MAX + 1) }, { ...form, notice: '   ' }, { ...form, notice: `안내${nul}` },
    { ...form, notice: `안내${lone}` }, { ...form, collectPhone: undefined }, { ...form, capacity: undefined }, { ...form, extra: 1 }])
})

test('신청 설정 수정: 버전과 신청 받기를 꼭 보낸다', () => {
  accepts(UpdateRegistrationFormSchema, [{ ...form, version: 1, accepting: false }])
  rejects(UpdateRegistrationFormSchema, [form, { ...form, version: 1 }, { ...form, accepting: true }, { ...form, version: 0, accepting: true },
    { ...form, version: 1, accepting: true, opensAt: form.closesAt }, { ...form, version: 1, accepting: 'yes' }])
  accepts(CancelRegistrationSchema, [{}])
  rejects(CancelRegistrationSchema, [{ reason: '중복' }, null])
})

test('참가비: 0~1,000,000원이고, 납부자 참가비는 비우거나 참가비보다 적다', () => {
  accepts(CreateRegistrationFormSchema, [{ ...form, fee: REGISTRATION_FEE_MAX }, { ...form, fee: 5000, memberFee: 0 }, { ...form, fee: 5000, memberFee: 4999 }])
  rejects(CreateRegistrationFormSchema, [{ ...form, fee: REGISTRATION_FEE_MAX + 1 }, { ...form, fee: -1 }, { ...form, fee: 1.5 }, { ...form, fee: '5000' },
    { ...form, fee: undefined }, { ...form, memberFee: undefined }, { ...form, fee: 5000, memberFee: 5000 }, { ...form, fee: 5000, memberFee: 6000 },
    { ...form, fee: 5000, memberFee: -1 }, { ...form, fee: 5000, memberFee: 0.5 }, { ...form, fee: 0, memberFee: 0 }])
  accepts(UpdateRegistrationFormSchema, [{ ...form, version: 1, accepting: true, fee: 5000, memberFee: 0 }])
  rejects(UpdateRegistrationFormSchema, [{ ...form, version: 1, accepting: true, fee: 5000, memberFee: 5000 }])
})

test('입금 확인은 빈 본문, 참가비 바꾸기는 납부 구분 불리언만 받는다', () => {
  assert.equal(isStrictObject(PaymentActionSchema), true)
  assert.equal(isStrictObject(SetDuesMemberSchema), true)
  accepts(PaymentActionSchema, [{}])
  rejects(PaymentActionSchema, [{ amount: 5000 }, null])
  accepts(SetDuesMemberSchema, [{ duesMember: true }, { duesMember: false }])
  rejects(SetDuesMemberSchema, [{}, { duesMember: 'yes' }, { duesMember: null }, { duesMember: true, extra: 1 }])
})

const entry = { name: '김바다', studentId: '2022123456', phone: null, agreed: true }
test('신청: 학번·휴대폰 번호의 공백과 하이픈을 빼고 형식을 본다', () => {
  assert.equal(isStrictObject(RegisterSchema), true)
  assert.deepEqual(RegisterSchema.parse({ ...entry, name: ' 김바다 ', studentId: ' 2022-123456 ' }), entry)
  assert.equal(RegisterSchema.parse({ ...entry, studentId: '2022 123 456' }).studentId, '2022123456')
  assert.equal(RegisterSchema.parse({ ...entry, phone: '010-1234-5678' }).phone, '01012345678')
  assert.equal(RegisterSchema.parse({ ...entry, phone: '011 234 5678' }).phone, '0112345678')
  accepts(RegisterSchema, [{ ...entry, studentId: '202212' }, { ...entry, studentId: '202212345678' }, { ...entry, name: emoji.repeat(REGISTRATION_NAME_MAX) }])
  rejects(RegisterSchema, [{ ...entry, studentId: '12345' }, { ...entry, studentId: '2022123456789' }, { ...entry, studentId: '2022a12345' },
    { ...entry, studentId: '---' }, { ...entry, studentId: '' }, { ...entry, phone: '02-123-4567' }, { ...entry, phone: '0101234567890' },
    { ...entry, phone: '' }, { ...entry, agreed: false }, { ...entry, agreed: undefined }, { ...entry, name: emoji.repeat(REGISTRATION_NAME_MAX + 1) },
    { ...entry, name: '   ' }, { ...entry, name: `김${nul}` }, { ...entry, name: `김${lone}` }, { ...entry, phone: undefined }, { ...entry, extra: 1 }])
})

test('토큰: base64url 22자만 받는다', () => {
  const token = 'Ab3_-xYz0123456789abcd'
  accepts(RegistrationTokenSchema, [{ token }])
  rejects(RegistrationTokenSchema, [{ token: token.slice(1) }, { token: `${token}e` }, { token: `${token.slice(2)}+/` }, { token: '' }, {}, { token, extra: 1 }])
})
