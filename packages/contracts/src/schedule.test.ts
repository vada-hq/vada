import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  CreateScheduleItemSchema,
  UpdateScheduleItemSchema,
  DeleteScheduleItemSchema,
  SCHEDULE_TITLE_MAX,
  SCHEDULE_PLACE_MAX,
  SCHEDULE_MEMO_MAX,
} from './index.js'

const when = { allDay: true, startsOn: '2026-10-28', endsOn: null }
const complete = {
  title: '시험 기간',
  type: 'academic',
  when,
  place: null,
  memo: null,
  departmentId: null,
  visibility: 'council',
  eventId: null,
}

test('일정 만들기는 선택 칸의 기본값을 채우고 고치기는 모든 칸을 받는다', () => {
  assert.deepEqual(CreateScheduleItemSchema.parse({ title: '시험 기간', when }), {
    ...complete,
    type: 'other',
  })
  assert.ok(UpdateScheduleItemSchema.safeParse(complete).success)
  for (const key of Object.keys(complete)) {
    const input = { ...complete } as Record<string, unknown>
    delete input[key]
    assert.equal(UpdateScheduleItemSchema.safeParse(input).success, false, key)
  }
  assert.ok(DeleteScheduleItemSchema.safeParse({}).success)
  assert.equal(DeleteScheduleItemSchema.safeParse({ id: 'x' }).success, false)
})

test('일정 계약은 필수 칸·공백·유니코드·길이·모르는 키를 검사한다', () => {
  for (const schema of [CreateScheduleItemSchema, UpdateScheduleItemSchema]) {
    for (const [field, max] of [
      ['title', SCHEDULE_TITLE_MAX],
      ['place', SCHEDULE_PLACE_MAX],
      ['memo', SCHEDULE_MEMO_MAX],
    ] as const) {
      assert.ok(schema.safeParse({ ...complete, [field]: '😀'.repeat(max) }).success)
      for (const value of ['', '  ', 'a\u0000', 'a\uD800', '😀'.repeat(max + 1)])
        assert.equal(
          schema.safeParse({ ...complete, [field]: value }).success,
          false,
          `${field}:${value.length}`,
        )
    }
    for (const input of [
      {},
      { ...complete, title: undefined },
      { ...complete, when: undefined },
      { ...complete, extra: true },
      { ...complete, type: 'event' },
      { ...complete, departmentId: 'x' },
      { ...complete, eventId: 'x' },
    ])
      assert.equal(schema.safeParse(input).success, false)
  }
})

test('종일·시각은 한 쌍만 받고 끝의 순서와 366일 상한 및 부서 공개를 확인한다', () => {
  const valid = [
    when,
    { ...when, endsOn: '2026-10-28' },
    { allDay: true, startsOn: '2026-01-01', endsOn: '2027-01-02' },
    { allDay: false, startsAt: '2026-10-28T14:00', endsAt: null },
    { allDay: false, startsAt: '2026-01-01T10:00', endsAt: '2027-01-02T10:00' },
  ]
  const invalid = [
    { ...when, startsAt: '2026-10-28T14:00' },
    { ...when, endsOn: '2026-10-27' },
    { ...when, startsOn: '2026-02-29' },
    { ...when, startsOn: '2026-01-01', endsOn: '2027-01-03' },
    { allDay: false, startsAt: '2026-10-28T14:00', endsAt: '2026-10-28T14:00' },
    { allDay: false, startsAt: '2026-10-28T14:00', endsAt: '2026-10-28T13:59' },
    { allDay: false, startsAt: '2026-01-01T10:00', endsAt: '2027-01-03T10:00' },
    { allDay: false, startsAt: '2026-10-28T24:00', endsAt: null },
  ]
  for (const schema of [CreateScheduleItemSchema, UpdateScheduleItemSchema]) {
    for (const value of valid) assert.ok(schema.safeParse({ ...complete, when: value }).success)
    for (const value of invalid)
      assert.equal(schema.safeParse({ ...complete, when: value }).success, false)
    assert.equal(schema.safeParse({ ...complete, visibility: 'department' }).success, false)
    assert.ok(
      schema.safeParse({
        ...complete,
        visibility: 'department',
        departmentId: '019e0000-0000-7000-8000-000000000001',
      }).success,
    )
  }
})
