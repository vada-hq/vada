import { expect, test } from 'vitest'
import { MEETING_AGENDA_LIMIT, MEETING_ATTENDEE_LIMIT, MEETING_TITLE_MAX } from '@vada/contracts'
import {
  initialMeetingForm,
  meetingBase,
  meetingFormErrors,
  meetingUpdate,
  parseMeetingForm,
} from './meeting-form'
import { MEETING_MEMBER, meetingOptions, meetingSample } from './test-support/meeting-samples'

const valid = () => initialMeetingForm(MEETING_MEMBER, meetingSample())
test('계약이 회의명 상한·끝 순서·빈 안건·행사 필수를 칸 아래 오류로 가리킨다', () => {
  expect(
    meetingFormErrors({ ...valid(), title: '가'.repeat(MEETING_TITLE_MAX + 1) }).title,
  ).toBeTruthy()
  expect(meetingFormErrors({ ...valid(), end: '13:00' }).end).toBeTruthy()
  expect(meetingFormErrors({ ...valid(), type: 'event', eventId: '' }).eventId).toBeTruthy()
  expect(
    meetingFormErrors({ ...valid(), agenda: [{ key: 'row', title: ' ', body: '' }] })[
      'agenda.0.title'
    ],
  ).toBeTruthy()
  expect(
    parseMeetingForm({
      ...valid(),
      agenda: Array.from({ length: MEETING_AGENDA_LIMIT + 1 }, (_, key) => ({
        key: String(key),
        title: '안건',
        body: '',
      })),
    }).success,
  ).toBe(false)
})
test('만든 사람은 보내지 않지만 상한은 만든 사람까지 센다', () => {
  const otherIds = Array.from(
    { length: MEETING_ATTENDEE_LIMIT },
    (_, index) => `0199d1a0-0000-7000-8000-${String(index + 1).padStart(12, '0')}`,
  )
  const parsed = parseMeetingForm(
    { ...valid(), attendeeIds: [MEETING_MEMBER, ...otherIds] },
    MEETING_MEMBER,
  )
  expect(parsed.success).toBe(true)
  expect(parsed.data?.attendeeIds).toHaveLength(MEETING_ATTENDEE_LIMIT)
  expect(parsed.data?.attendeeIds).not.toContain(MEETING_MEMBER)
  const tooMany = { ...valid(), attendeeIds: [MEETING_MEMBER, ...otherIds] }
  expect(meetingFormErrors(tooMany, MEETING_MEMBER).attendeeIds).toBeTruthy()
  const fits = { ...valid(), attendeeIds: [MEETING_MEMBER, ...otherIds.slice(1)] }
  expect(meetingFormErrors(fits, MEETING_MEMBER).attendeeIds).toBeUndefined()
})
test('다음 날 끝나는 회의를 고치면 끝 날짜를 날짜 칸에서 그만큼 뒤로 지킨다', () => {
  const overnight = meetingSample({ heldAt: '2026-11-03T22:00', endsAt: '2026-11-04T01:00' })
  const value = initialMeetingForm(MEETING_MEMBER, overnight)
  expect(meetingFormErrors(value).end).toBeUndefined()
  expect(parseMeetingForm(value).data?.endsAt).toBe('2026-11-04T01:00')
  expect(parseMeetingForm({ ...value, date: '2026-11-30' }).data?.endsAt).toBe('2026-12-01T01:00')
  // 시각을 고치면 폼(MeetingForm의 change)이 endDayOffset을 0으로 되돌린다.
  expect(
    parseMeetingForm({ ...value, start: '14:00', end: '15:00', endDayOffset: 0 }).data?.endsAt,
  ).toBe('2026-11-03T15:00')
})
test('고치기는 바뀐 칸만 보내고 참가자 순서와 안건은 본문에 넣지 않는다', () => {
  const original = meetingSample()
  const value = parseMeetingForm({
    ...valid(),
    title: '바꾼 이름',
    attendeeIds: [...meetingOptions.defaultAttendeeIds].reverse(),
  }).data!
  expect(meetingUpdate(value, meetingBase(original), original.versionNo).data).toEqual({
    title: '바꾼 이름',
    baseVersionNo: 1,
  })
})
