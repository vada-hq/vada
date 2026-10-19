import assert from 'node:assert/strict'
import { test } from 'node:test'
import { COHORT_NAME_MAX, COUNCIL_NAME_MAX, CreateCouncilSchema, RANK_TITLE_MAX, SCHOOL_NAME_MAX, UpdateCohortSchema, UpdateCouncilSettingsSchema,
  dateInput } from './councils.js'
import { isStrictObject } from './input.js'

const valid = { name: ' 컴퓨터학부 학생회 ', unit: 'department', schoolName: '한양대학교 ERICA', cohortName: '2026', startsOn: '2026-01-01', endsOn: '2026-12-31' }

test('학생회 만들기: 이름을 다듬고, 단위와 기수 기간을 받는다', () => {
  assert.deepEqual(CreateCouncilSchema.parse(valid), { ...valid, name: '컴퓨터학부 학생회' })
  for (const unit of ['department', 'college', 'university']) assert.equal(CreateCouncilSchema.safeParse({ ...valid, unit }).success, true)
  assert.equal(CreateCouncilSchema.safeParse({ ...valid, name: '😀'.repeat(COUNCIL_NAME_MAX) }).success, true)
  assert.equal(CreateCouncilSchema.safeParse({ ...valid, startsOn: '2028-02-29', endsOn: '2029-02-28' }).success, true)
  assert.equal(isStrictObject(CreateCouncilSchema), true)
})

test('학생회 만들기: 빠진 값, 빈 값, 상한+1, NUL·서러게이트, 모르는 키, 틀린 날짜와 거꾸로 된 기간을 거절한다', () => {
  const bad: unknown[] = [
    {}, { ...valid, name: undefined }, { ...valid, unit: undefined }, { ...valid, schoolName: undefined }, { ...valid, cohortName: undefined },
    { ...valid, startsOn: undefined }, { ...valid, endsOn: undefined },
    { ...valid, name: '' }, { ...valid, name: '   ' }, { ...valid, schoolName: ' ' }, { ...valid, cohortName: '' },
    { ...valid, name: '😀'.repeat(COUNCIL_NAME_MAX + 1) }, { ...valid, schoolName: '😀'.repeat(SCHOOL_NAME_MAX + 1) },
    { ...valid, cohortName: '😀'.repeat(COHORT_NAME_MAX + 1) },
    { ...valid, name: '학생회\u0000' }, { ...valid, schoolName: '\uD800' },
    { ...valid, extra: 1 }, { ...valid, unit: 'club' },
    { ...valid, startsOn: '2026-02-30' }, { ...valid, startsOn: '2026-1-1' }, { ...valid, startsOn: '1999-12-31' }, { ...valid, endsOn: '3000-01-01' },
    { ...valid, startsOn: '2026-12-31', endsOn: '2026-12-31' }, { ...valid, startsOn: '2027-01-01', endsOn: '2026-12-31' },
  ]
  for (const value of bad) assert.equal(CreateCouncilSchema.safeParse(value).success, false, JSON.stringify(value))
})

test('dateInput: 달력에 있는 YYYY-MM-DD만 받는다', () => {
  for (const value of ['2026-01-01', '2028-02-29', '2999-12-31']) assert.equal(dateInput.safeParse(value).success, true, value)
  for (const value of ['2027-02-29', '2026-13-01', '2026-00-10', '26-01-01', '2026/01/01', '', ' ', '2026-01-01T00:00', '\u00002026-01-01', 20260101]) {
    assert.equal(dateInput.safeParse(value).success, false, String(value))
  }
})

const settings = { name: '소프트웨어학부 학생회', unit: 'college', schoolName: '한양대학교 ERICA',
  titles: { president: '위원장', vicePresident: '부위원장', head: '국장', viceHead: '차장' } }

test('학생회 정보 고치기: 이름, 단위, 학교, 직급 표시 이름 넷을 모두 받는다', () => {
  assert.deepEqual(UpdateCouncilSettingsSchema.parse({ ...settings, titles: { ...settings.titles, head: ' 국장 ' } }), settings)
  assert.equal(UpdateCouncilSettingsSchema.safeParse({ ...settings, titles: { ...settings.titles, president: '😀'.repeat(RANK_TITLE_MAX) } }).success, true)
  const bad: unknown[] = [{}, { ...settings, titles: undefined }, { ...settings, titles: { ...settings.titles, viceHead: undefined } },
    { ...settings, titles: { ...settings.titles, head: ' ' } }, { ...settings, titles: { ...settings.titles, head: '😀'.repeat(RANK_TITLE_MAX + 1) } },
    { ...settings, titles: { ...settings.titles, head: 'a\u0000' } }, { ...settings, titles: { ...settings.titles, extra: 'x' } },
    { ...settings, name: '' }, { ...settings, unit: 'club' }, { ...settings, schoolName: '\uD800' }, { ...settings, extra: 1 }]
  for (const value of bad) assert.equal(UpdateCouncilSettingsSchema.safeParse(value).success, false, JSON.stringify(value))
  assert.equal(isStrictObject(UpdateCouncilSettingsSchema), true)
})

test('기수 고치기: 이름과 기간을 받고, 끝일은 시작일보다 뒤다', () => {
  assert.deepEqual(UpdateCohortSchema.parse({ name: ' 제38대 ', startsOn: '2026-03-01', endsOn: '2027-02-28' }),
    { name: '제38대', startsOn: '2026-03-01', endsOn: '2027-02-28' })
  for (const value of [{}, { name: '2026', startsOn: '2026-03-01' }, { name: '', startsOn: '2026-03-01', endsOn: '2027-02-28' },
    { name: '😀'.repeat(COHORT_NAME_MAX + 1), startsOn: '2026-03-01', endsOn: '2027-02-28' },
    { name: '2026', startsOn: '2026-03-01', endsOn: '2026-03-01' }, { name: '2026', startsOn: '2026-03-01', endsOn: '2027-02-29' },
    { name: '2026', startsOn: '2026-03-01', endsOn: '2027-02-28', extra: 1 }]) {
    assert.equal(UpdateCohortSchema.safeParse(value).success, false, JSON.stringify(value))
  }
  assert.equal(isStrictObject(UpdateCohortSchema), true)
})
