import type { EventRecord, RecordEventItem } from '@vada/contracts'

// 기록 메뉴(REC-01, REC-02) 시험과 부품 확인 화면이 같이 쓰는 견본. 주소는 uuid여야 읽힌다.
export const RECORD_COUNCIL = '0199d1a0-0000-7000-8000-0000000000c1'
export const RECORD_EVENT = '0199d1a0-0000-7000-8000-0000000000e1'
export const RECORD_MEETING = '0199d1a0-0000-7000-8000-0000000000a1'
// 올해 판단을 고정한다(부품 확인 화면 스냅숏).
export const RECORD_NOW = new Date('2026-10-29T03:00:00.000Z')

export const recordItem = (patch: Partial<RecordEventItem> = {}): RecordEventItem => ({
  id: RECORD_EVENT,
  name: '가을 축제 학생회 부스',
  startsAt: '2026-10-17T11:00',
  endsAt: '2026-10-17T17:00',
  owner: { id: '0199d1a0-0000-7000-8000-0000000000b1', name: '이기획', current: true },
  departments: ['기획부', '대외협력부'],
  completedAt: '2026-10-24T06:00:00.000Z',
  chips: {
    attended: 186,
    applied: 210,
    budget: 1200000,
    actual: 1104000,
    executionRate: 92,
    tasksDone: 14,
  },
  ...patch,
})

export const recordSample = (patch: Partial<EventRecord> = {}): EventRecord => ({
  overview: {
    id: RECORD_EVENT,
    name: '가을 축제 학생회 부스',
    startsAt: '2026-10-17T11:00',
    endsAt: '2026-10-17T17:00',
    place: '학생회관 앞 잔디밭',
    owner: { id: '0199d1a0-0000-7000-8000-0000000000b1', name: '이기획', current: true },
    departments: ['기획부', '대외협력부'],
    completedAt: '2026-10-24T06:00:00.000Z',
    completedBy: { id: '0199d1a0-0000-7000-8000-0000000000b2', name: '김회장' },
  },
  outcome: {
    registrations: { total: 215, cancelled: 5, attended: 186, rate: 89 },
    money: { budget: 1200000, actual: 1104000, difference: 96000, rate: 92 },
    tasks: { done: 14, total: 16 },
  },
  timeline: [
    {
      kind: 'created',
      at: '2026-09-20T01:00:00.000Z',
      text: '행사 만듦',
      by: { id: 'b1', name: '이기획' },
      recordId: null,
    },
    {
      kind: 'changed',
      at: '2026-10-01T02:30:00.000Z',
      text: '일시·장소 변경',
      by: { id: 'b1', name: '이기획' },
      recordId: null,
    },
    {
      kind: 'meeting',
      at: '2026-10-08T09:00:00.000Z',
      text: '부스 운영 점검 회의',
      by: null,
      recordId: RECORD_MEETING,
    },
    {
      kind: 'completed',
      at: '2026-10-24T06:00:00.000Z',
      text: '완료',
      by: { id: 'b2', name: '김회장' },
      recordId: null,
    },
  ],
  sources: { tasks: 16, meetings: 3, purchases: 6 },
  ...patch,
})
