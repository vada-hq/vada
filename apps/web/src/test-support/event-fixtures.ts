import type { EventAction, EventDetail, EventSummary, TeamResponse } from '@vada/contracts'
import { teamResponse } from './council-fixtures'

// 계약은 본문의 사람 번호를 uuid로 받으므로 행사 시험의 운영진은 uuid 번호를 쓴다.
export const MEMBER = {
  m1: '00000000-0000-4000-8000-000000000001',
  m2: '00000000-0000-4000-8000-000000000002',
  m3: '00000000-0000-4000-8000-000000000003',
}
export const EVENT_ID = '00000000-0000-4000-8000-0000000000e1'
export function uuidTeam(): TeamResponse {
  const team = teamResponse()
  return {
    ...team,
    members: team.members.map(member => ({
      ...member,
      id: MEMBER[member.id as keyof typeof MEMBER] ?? member.id,
    })),
  }
}

// 화면 시험이 같이 쓰는 행사 응답. 값은 서버 응답과 같은 모양이다.
export function eventSummary(overrides: Partial<EventSummary> = {}): EventSummary {
  return {
    id: EVENT_ID,
    name: '신입생 환영회',
    startsAt: '2026-10-24T14:00',
    endsAt: '2026-10-24T18:00',
    place: '대강당',
    owner: { id: MEMBER.m2, name: '이재정', current: true },
    status: 'upcoming',
    ...overrides,
  }
}

export function eventDetail(
  overrides: Partial<EventDetail> = {},
  actions: EventAction[] = ['event.set_owner'],
): EventDetail {
  return {
    ...eventSummary(),
    tasks: { open: 2, total: 3 },
    history: [
      {
        versionNo: 1,
        at: '2026-10-20T05:03:00.000Z',
        by: { id: 'm1', name: '김회장' },
        changes: [{ field: 'created' }],
      },
    ],
    actions,
    ...overrides,
  }
}
