import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  ApplySchema,
  CancelAttendanceSchema,
  CreateFormSchema,
  qrTextOf,
  tokenHashOfQr,
  UpdateFormSchema,
  ActivateFormSchema,
  missingFormConditions,
  registrationStatusLabel,
} from './registrations.js'

test('활성화는 빈 본문만 받고, 모자란 조건은 순서대로 중복 없이 센다', () => {
  assert.equal(ActivateFormSchema.safeParse({}).success, true)
  assert.equal(ActivateFormSchema.safeParse({ extra: true }).success, false)
  const ready = {
    eventStartsAt: '2026-11-02T10:00',
    opensAt: null,
    closesAt: '2026-11-01T18:00',
    payerFee: null,
    nonPayerFee: null,
    feeAccountId: null,
  }
  assert.deepEqual(missingFormConditions(ready), [])
  assert.deepEqual(
    missingFormConditions({ ...ready, eventStartsAt: null, closesAt: '', payerFee: 1000 }),
    ['event_starts_at', 'closes_at', 'fee_account'],
  )
  for (const opensAt of ['2026-11-01T18:00', '2026-11-01T18:01'])
    assert.deepEqual(missingFormConditions({ ...ready, opensAt }), ['registration_period'])
  assert.deepEqual(missingFormConditions({ ...ready, payerFee: 0, nonPayerFee: 0 }), [])
  assert.deepEqual(missingFormConditions({ ...ready, nonPayerFee: 1 }), ['fee_account'])
  assert.deepEqual(missingFormConditions({ ...ready, payerFee: 1, feeAccountId: COMMAND_ID }), [])
})

test('상태 값은 그대로 두고 멈춘 양식의 신청 수로 초안과 잠시 멈춤을 가른다', () => {
  assert.equal(registrationStatusLabel('paused', 0), '초안')
  assert.equal(registrationStatusLabel('paused', 1), '잠시 멈춤')
  assert.equal(registrationStatusLabel('open', 0), '활성')
  assert.equal(registrationStatusLabel('closed', 0), '종료')
})

const HASH = 'ab12'.repeat(16)

test('QR 글자는 VADA:와 대문자 해시이고, 꺼낼 때 소문자 해시로 돌아온다', () => {
  assert.equal(qrTextOf(HASH), `VADA:${HASH.toUpperCase()}`)
  assert.equal(tokenHashOfQr(qrTextOf(HASH)), HASH)
  // 소문자로 옮겨 적어도 같은 해시다.
  assert.equal(tokenHashOfQr(`VADA:${HASH}`), HASH)
})

test('VADA 글자가 아니거나 해시 모양이 아니면 null이다', () => {
  for (const value of [
    '',
    'VADA:',
    `vada:${HASH}`,
    `https://x/${HASH}`,
    `VADA:${HASH}0`,
    `VADA:${'g'.repeat(64)}`,
    `VADA:${HASH.slice(1)}`,
  ])
    assert.equal(tokenHashOfQr(value), null, value)
})

const COMMAND_ID = '3f2b8a52-6c1e-4d0b-9a7e-2d5c8f1b4a60'

test('신청 본문: 휴대폰은 공백과 -를 빼고, 안 보낸 칸은 null이다', () => {
  assert.deepEqual(
    ApplySchema.parse({ commandId: COMMAND_ID, name: ' 김 ', phone: '010-1234 5678' }),
    { commandId: COMMAND_ID, name: '김', studentId: null, phone: '01012345678', answers: [] },
  )
  assert.equal(
    ApplySchema.safeParse({ commandId: COMMAND_ID, name: '김', studentId: '12345' }).success,
    false,
  )
  assert.equal(ApplySchema.safeParse({ commandId: COMMAND_ID, name: '김', x: 1 }).success, false)
})

test('신청 본문: 명령 번호는 UUID v4만 받고 없으면 거절한다', () => {
  assert.equal(ApplySchema.safeParse({ name: '김' }).success, false)
  for (const bad of [
    '',
    'abc',
    // v7(시간 순서 UUID)과 UUID가 아닌 글자
    '019e0000-0000-7000-8000-000000000000',
    `${COMMAND_ID}0`,
    ' ',
  ])
    assert.equal(ApplySchema.safeParse({ commandId: bad, name: '김' }).success, false, bad)
  assert.equal(ApplySchema.safeParse({ commandId: COMMAND_ID, name: '김' }).success, true)
})

const FORM = { name: '가을 축제', closesAt: '2026-11-01T18:00' }
const FULL_FORM = {
  ...FORM,
  opensAt: null,
  capacity: null,
  notice: null,
  collectsPhone: false,
  collectsStudentId: true,
  payerFee: null,
  nonPayerFee: null,
  feeAccountId: null,
}

test('양식 만들기: 학번 받기를 빼면 받는다(DEC-75)', () => {
  assert.equal(CreateFormSchema.parse(FORM).collectsStudentId, true)
  assert.equal(
    CreateFormSchema.parse({ ...FORM, collectsStudentId: false }).collectsStudentId,
    false,
  )
  assert.equal(CreateFormSchema.safeParse({ ...FORM, collectsStudentId: null }).success, false)
  assert.equal(CreateFormSchema.safeParse({ ...FORM, collectsStudentId: 'true' }).success, false)
})

test('두 참가비가 다르면 학번 받기를 끌 수 없다. 같거나 없으면 끌 수 있다', () => {
  const split = { payerFee: 0, nonPayerFee: 5000 }
  for (const schema of [CreateFormSchema, UpdateFormSchema]) {
    const base = schema === CreateFormSchema ? FORM : FULL_FORM
    assert.equal(schema.safeParse({ ...base, ...split, collectsStudentId: false }).success, false)
    assert.equal(schema.safeParse({ ...base, ...split, collectsStudentId: true }).success, true)
    for (const fees of [
      { payerFee: 3000, nonPayerFee: 3000 },
      { payerFee: null, nonPayerFee: null },
    ])
      assert.equal(schema.safeParse({ ...base, ...fees, collectsStudentId: false }).success, true)
  }
})

test('양식 고치기는 학번 받기를 꼭 받는다', () => {
  assert.equal(UpdateFormSchema.safeParse(FULL_FORM).success, true)
  const { collectsStudentId: _omitted, ...missing } = FULL_FORM
  assert.equal(UpdateFormSchema.safeParse(missing).success, false)
})

test('출석 취소: 본문이 비면 지금 출석이고, 출석 번호는 uuid만 받아 소문자로 맞춘다', () => {
  const id = '01A17DEC-AEF8-7FFF-9BBF-3722B9D2C88A'
  assert.deepEqual(CancelAttendanceSchema.parse({}), {})
  assert.deepEqual(CancelAttendanceSchema.parse({ attendanceId: id }), {
    attendanceId: id.toLowerCase(),
  })
  for (const attendanceId of ['', ' ', 'abc', `${id}0`, null])
    assert.equal(
      CancelAttendanceSchema.safeParse({ attendanceId }).success,
      false,
      String(attendanceId),
    )
  assert.equal(CancelAttendanceSchema.safeParse({ attendanceId: id, x: 1 }).success, false)
})
