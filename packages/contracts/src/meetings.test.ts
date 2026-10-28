import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  CreateMeetingSchema,
  UpdateMeetingSchema,
  ReplaceMeetingAttendeesSchema,
  CancelMeetingSchema,
  MeetingListQuerySchema,
} from './meetings.js'

const id = '66666666-6666-4666-8666-666666666661'
const full = {
  title: '운영 회의',
  heldAt: '2026-10-29T14:00',
  endsAt: '2026-10-29T15:00',
  place: '학생회실',
  attendeeIds: [id],
  agenda: [{ title: '행사 준비', body: '담당 정하기' }],
}

test('회의 계약: 필수값·상한·문자·모르는 키와 종료 순서를 확인한다', () => {
  assert.equal(CreateMeetingSchema.safeParse(full).success, true)
  for (const key of ['title', 'heldAt', 'endsAt', 'place'] as const) {
    const { [key]: _omitted, ...rest } = full
    assert.equal(CreateMeetingSchema.safeParse(rest).success, false, key)
  }
  for (const key of ['title', 'place'] as const)
    for (const value of ['', ' ', 'a'.repeat(101), '😀'.repeat(101), 'a\u0000', 'a\uD800'])
      assert.equal(CreateMeetingSchema.safeParse({ ...full, [key]: value }).success, false)
  for (const patch of [
    { endsAt: full.heldAt },
    { endsAt: '2026-10-28T15:00' },
    { purpose: 'a'.repeat(501) },
    { agenda: Array.from({ length: 31 }, () => ({ title: '안건' })) },
    { attendeeIds: Array.from({ length: 201 }, () => id) },
    { extra: true },
    { agenda: [{ title: 'a'.repeat(101) }] },
    { agenda: [{ title: '안건', body: 'a'.repeat(501) }] },
    { agenda: [{ title: '안건', extra: true }] },
  ])
    assert.equal(CreateMeetingSchema.safeParse({ ...full, ...patch }).success, false)
  assert.equal(CreateMeetingSchema.safeParse({ ...full, title: '😀'.repeat(100) }).success, true)
})

test('회의 고치기는 판 필수·선택 칸 null·필수 칸 null 거절인 Merge Patch다', () => {
  assert.equal(UpdateMeetingSchema.safeParse({ baseVersionNo: 1, purpose: null }).success, true)
  for (const patch of [
    { title: '변경' },
    { baseVersionNo: 0 },
    { baseVersionNo: 1, title: null },
    { baseVersionNo: 1, heldAt: null },
    { baseVersionNo: 1, attendeeIds: [] },
  ])
    assert.equal(UpdateMeetingSchema.safeParse(patch).success, false)
})

test('참가자·취소 사유·한국 날짜 쿼리 계약을 확인한다', () => {
  assert.equal(ReplaceMeetingAttendeesSchema.safeParse({ attendeeIds: [] }).success, true)
  assert.equal(
    ReplaceMeetingAttendeesSchema.safeParse({ attendeeIds: Array(201).fill(id) }).success,
    false,
  )
  for (const reason of [undefined, '', ' ', 'a'.repeat(201), 'a\u0000', 'a\uD800'])
    assert.equal(CancelMeetingSchema.safeParse({ reason }).success, false)
  assert.equal(CancelMeetingSchema.safeParse({ reason: '일정 변경' }).success, true)
  assert.equal(
    MeetingListQuerySchema.safeParse({ view: 'mine', from: '2026-10-29', to: '2026-10-29' })
      .success,
    true,
  )
  for (const query of [
    { view: 'other' },
    { from: '2026-02-30' },
    { from: '2026-10-30', to: '2026-10-29' },
    { extra: 'x' },
  ])
    assert.equal(MeetingListQuerySchema.safeParse(query).success, false)
})
