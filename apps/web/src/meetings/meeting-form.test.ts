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
test('만든 사람은 서버가 넣으므로 계약 상한만큼 다른 참가자를 보낼 수 있다', () => {
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
