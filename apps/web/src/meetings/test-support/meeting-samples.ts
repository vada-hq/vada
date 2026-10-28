import type { MeetingDetail, MeetingOptionsResponse } from '@vada/contracts'

export const MEETING_COUNCIL = '0199d1a0-0000-7000-8000-0000000000c1'
export const MEETING_ID = '0199d1a0-0000-7000-8000-0000000000a1'
export const MEETING_MEMBER = '0199d1a0-0000-7000-8000-0000000000b1'
export const MEETING_DEPARTMENT = '0199d1a0-0000-7000-8000-0000000000d1'
export const meetingOptions: MeetingOptionsResponse = {
  departments: [{ id: MEETING_DEPARTMENT, name: '기획부' }],
  events: [{ id: '0199d1a0-0000-7000-8000-0000000000e1', name: '가을 축제' }],
  members: [
    { id: MEETING_MEMBER, name: '김회장', current: true },
    { id: '0199d1a0-0000-7000-8000-0000000000b2', name: '이기획', current: true },
  ],
  defaultAttendeeIds: [MEETING_MEMBER, '0199d1a0-0000-7000-8000-0000000000b2'],
}
export const meetingSample = (patch: Partial<MeetingDetail> = {}): MeetingDetail => ({
  id: MEETING_ID,
  title: '학생회 정기 총회',
  heldAt: '2026-11-03T14:00',
  endsAt: '2026-11-03T15:30',
  place: '학생회관 3층 회의실',
  purpose: '이번 달 행사 준비와 부서별 진행 상황 공유',
  event: null,
  hostDepartment: null,
  status: 'scheduled',
  relation: 'manager',
  attendeeCount: meetingOptions.members.length,
  agendaCount: 1,
  minutesStatus: 'none',
  actions: ['meeting.edit', 'meeting.cancel', 'meeting.minutes'],
  versionNo: 1,
  createdBy: meetingOptions.members[0]!,
  createdAt: '2026-10-29T02:00:00Z',
  confirmedAt: null,
  cancelledAt: null,
  cancelReason: null,
  attendees: meetingOptions.members,
  agenda: [
    {
      id: '0199d1a0-0000-7000-8000-0000000000f1',
      position: 1,
      title: '부서별 준비 상황',
      body: '행사 준비 일정과 필요한 지원 확인',
      notes: null,
      versionNo: 1,
      updatedBy: meetingOptions.members[0]!,
      updatedAt: '2026-10-29T06:24:00Z',
      decisions: [],
      followUps: [],
    },
  ],
  ...patch,
})
