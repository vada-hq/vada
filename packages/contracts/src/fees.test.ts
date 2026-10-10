import assert from 'node:assert/strict'
import { test } from 'node:test'
import { DeleteDuesRosterSchema, DUES_ROSTER_LABEL_MAX, DUES_ROSTER_MEMBERS_MAX, FEE_BANK_MAX, FEE_HOLDER_MAX, ReplaceDuesRosterSchema,
  SetFeeAccountSchema } from './fees.js'
import { isStrictObject } from './input.js'
import { REGISTRATION_NAME_MAX } from './registrations.js'

// 테스트 파일에 제어 문자를 그대로 쓰지 않는다.
const nul = String.fromCharCode(0)
const lone = String.fromCharCode(0xd800)
const emoji = '😀'
const accepts = (schema: { safeParse: (value: unknown) => { success: boolean } }, values: unknown[]) => {
  for (const value of values) assert.equal(schema.safeParse(value).success, true, JSON.stringify(value).slice(0, 120))
}
const rejects = (schema: { safeParse: (value: unknown) => { success: boolean } }, values: unknown[]) => {
  for (const value of values) assert.equal(schema.safeParse(value).success, false, JSON.stringify(value).slice(0, 120))
}

const account = { version: 0, bank: '카카오뱅크', accountNumber: '3333-01-1234567', holder: '컴퓨터학부 학생회' }
test('학생회 계좌: 은행·예금주는 사람이 쓰는 글이고, 계좌번호는 숫자와 하이픈으로 숫자 8~20자리다', () => {
  assert.equal(isStrictObject(SetFeeAccountSchema), true)
  assert.deepEqual(SetFeeAccountSchema.parse({ ...account, bank: ' 카카오뱅크 ', holder: ' 컴퓨터학부 학생회 ' }), account)
  // 넣은 공백은 뺀다.
  assert.equal(SetFeeAccountSchema.parse({ ...account, accountNumber: ' 3333 01 1234567 ' }).accountNumber, '3333011234567')
  accepts(SetFeeAccountSchema, [{ ...account, accountNumber: '12345678' }, { ...account, accountNumber: '1'.repeat(20) },
    { ...account, accountNumber: '1234-5678-9012-3456-7890' }, { ...account, bank: emoji.repeat(FEE_BANK_MAX) },
    { ...account, holder: emoji.repeat(FEE_HOLDER_MAX) }, { ...account, version: 3 }])
  rejects(SetFeeAccountSchema, [{ ...account, accountNumber: '1234567' }, { ...account, accountNumber: '1'.repeat(21) },
    { ...account, accountNumber: `${'1-'.repeat(15)}1` }, { ...account, accountNumber: '12--34567890' }, { ...account, accountNumber: '-1234567890' },
    { ...account, accountNumber: '1234567890-' }, { ...account, accountNumber: '12a4567890' }, { ...account, accountNumber: '' },
    { ...account, accountNumber: `1234567890${nul}` }, { ...account, accountNumber: 1234567890 },
    { ...account, bank: '   ' }, { ...account, bank: emoji.repeat(FEE_BANK_MAX + 1) }, { ...account, bank: `은행${nul}` }, { ...account, bank: `은행${lone}` },
    { ...account, holder: '' }, { ...account, holder: emoji.repeat(FEE_HOLDER_MAX + 1) }, { ...account, holder: `학생회${nul}` },
    { ...account, holder: `학생회${lone}` }, { ...account, version: -1 }, { ...account, version: 1.5 }, { ...account, version: undefined },
    { ...account, holder: undefined }, { ...account, extra: 1 }])
})

const member = { studentId: '2022123456', name: '김바다' }
const roster = { version: 0, label: '2026년 2학기 납부자', useUntil: '2027-02-28', members: [member] }
test('학생회비 명단: 이름·쓰는 기한·납부자 1~10,000명이고, 정리한 학번이 겹치지 않는다', () => {
  assert.equal(isStrictObject(ReplaceDuesRosterSchema), true)
  assert.deepEqual(ReplaceDuesRosterSchema.parse({ ...roster, label: ' 2026년 2학기 납부자 ',
    members: [{ studentId: ' 2022-123456 ', name: ' 김바다 ' }] }), roster)
  const many = Array.from({ length: DUES_ROSTER_MEMBERS_MAX }, (_, n) => ({ studentId: String(2000000000 + n), name: '학생' }))
  accepts(ReplaceDuesRosterSchema, [{ ...roster, members: many }, { ...roster, label: emoji.repeat(DUES_ROSTER_LABEL_MAX) },
    { ...roster, members: [{ ...member, name: emoji.repeat(REGISTRATION_NAME_MAX) }] }, { ...roster, version: 2 }, { ...roster, useUntil: '2999-12-31' },
    { ...roster, members: [member, { studentId: '2022123457', name: '김바다' }] }])
  rejects(ReplaceDuesRosterSchema, [{ ...roster, members: [] }, { ...roster, members: [...many, { studentId: '1999999999', name: '학생' }] },
    { ...roster, members: [member, { studentId: '2022-123456', name: '다른 이름' }] }, { ...roster, members: [member, member] },
    { ...roster, members: [{ ...member, studentId: '12345' }] }, { ...roster, members: [{ ...member, studentId: '2022a12345' }] },
    { ...roster, members: [{ ...member, name: '   ' }] }, { ...roster, members: [{ ...member, name: emoji.repeat(REGISTRATION_NAME_MAX + 1) }] },
    { ...roster, members: [{ ...member, name: `김${nul}` }] }, { ...roster, members: [{ ...member, name: `김${lone}` }] },
    { ...roster, members: [{ ...member, extra: 1 }] }, { ...roster, members: [{ studentId: '2022123456' }] }, { ...roster, members: undefined },
    { ...roster, label: '   ' }, { ...roster, label: emoji.repeat(DUES_ROSTER_LABEL_MAX + 1) }, { ...roster, label: `명단${nul}` },
    { ...roster, label: `명단${lone}` }, { ...roster, useUntil: '2026-02-30' }, { ...roster, useUntil: '1999-12-31' }, { ...roster, useUntil: '3000-01-01' },
    { ...roster, useUntil: '2027/02/28' }, { ...roster, useUntil: undefined }, { ...roster, version: -1 }, { ...roster, extra: 1 }])
})

test('학생회비 명단 지우기: 버전은 1 이상이고 모르는 키를 받지 않는다', () => {
  assert.equal(isStrictObject(DeleteDuesRosterSchema), true)
  accepts(DeleteDuesRosterSchema, [{ version: 1 }])
  rejects(DeleteDuesRosterSchema, [{ version: 0 }, {}, { version: 1, extra: 1 }])
})
