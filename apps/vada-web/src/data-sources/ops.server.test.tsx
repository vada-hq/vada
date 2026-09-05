import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { createApp } from '../../../api/src/app.ts'
import { freshDb } from '../../../api/src/db/testing.ts'
import { inMemoryCounter } from '../../../api/src/public/rate-limit.ts'
import { inMemoryAttempts } from '../../../api/src/idempotency.ts'
import { meetingLookups } from '../../../api/src/meetings/lookups.ts'
import {
  departments,
  events,
  meetings,
  members,
  organizations,
  tasks,
  users,
} from '../../../api/src/db/schema.ts'
import { ScreenRouter } from '../screens/ScreenRouter'
import { readObjectSource } from './catalog'
import { loadSources, useServer } from './server'

// **운영 허브(OPS-00)가 서버에 붙었다.**
//
// 이 화면이 읽는 둘은 회의의 것이 아니다 — 업무·회의·행사·마감을 **가로질러** 센다.
// 그래서 서버 쪽도 `handlers/ops.ts`가 답하고, 여기서 그 자리를 잰다.
//
// 재는 것 넷:
//
// 1. **안내 문장에 보는 사람의 이름이 들어간다.** 개발용 응답은 늘 '박해랑님'이었고
//    그것이 정말 저장소에서 오는지는 아무도 재 보지 않았다.
// 2. **네 공간의 건수가 서로 다른 표에서 온다.**
// 3. **'상시 업무'는 행사에 안 걸린 업무다.** 행사 업무를 함께 세면 두 공간이 같은
//    수를 그린다.
// 4. **'마감'은 완료되지 않은 업무의 기한이다**(OPS-CAL-01이 그 규칙을 적었다).

/** 2026.07.20은 월요일. 이번 주는 07.19(일)~07.25(토)다. */
const NOW = new Date('2026-07-20T10:00:00+09:00')

let app: ReturnType<typeof createApp>
let restore: () => void
let close: () => Promise<void>

beforeAll(async () => {
  const fresh = await freshDb()
  close = fresh.close

  await fresh.db.insert(organizations).values([
    { id: 'ORG-01', name: '제12대 학생회' },
    // **옆 학생회를 하나 더 둔다.** 세는 자리마다 담이 서는지 봐야 한다.
    { id: 'ORG-02', name: '옆 학생회' },
  ])
  await fresh.db.insert(departments).values([{ id: 'D-02', orgId: 'ORG-01', name: '운영부' }])
  await fresh.db.insert(users).values({ id: 'U-01', email: 'haerang@example.ac.kr' })
  await fresh.db.insert(members).values([
    {
      id: 'M-02',
      orgId: 'ORG-01',
      // 개발용 응답과 다른 이름이다 — 서버를 거친 증거가 된다.
      name: '한마루',
      role: 'member',
      departmentId: 'D-02',
      userId: 'U-01',
    },
    { id: 'M-99', orgId: 'ORG-02', name: '남의사람', role: 'chair' },
  ])

  await fresh.db.insert(events).values([
    { id: 'E-01', orgId: 'ORG-01', title: '체육대회', status: 'inProgress' },
    { id: 'E-02', orgId: 'ORG-01', title: '신입생 환영회', status: 'planning' },
    { id: 'E-03', orgId: 'ORG-01', title: '지난 행사', status: 'done' },
    { id: 'E-99', orgId: 'ORG-02', title: '남의 행사', status: 'inProgress' },
  ])
  await fresh.db.insert(meetings).values([
    {
      id: 'MTG-A',
      orgId: 'ORG-01',
      title: '오늘 운영회의',
      status: 'scheduled',
      scheduledAt: new Date('2026-07-20T18:00:00+09:00'),
    },
    {
      id: 'MTG-B',
      orgId: 'ORG-01',
      title: '내일 회의',
      status: 'scheduled',
      scheduledAt: new Date('2026-07-21T18:00:00+09:00'),
    },
    { id: 'MTG-C', orgId: 'ORG-01', title: '정리 중인 회의', status: 'wrapUp' },
    { id: 'MTG-99', orgId: 'ORG-02', title: '남의 회의', status: 'wrapUp' },
  ])
  await fresh.db.insert(tasks).values([
    {
      id: 'T-01',
      orgId: 'ORG-01',
      title: '학생 건의함 확인',
      status: 'inProgress',
      dueDate: new Date('2026-07-22T18:00:00+09:00'),
    },
    { id: 'T-02', orgId: 'ORG-01', title: '회계 장부 주간 정리', status: 'review' },
    // 행사 업무. **상시 업무로 세면 안 되지만 마감으로는 센다.**
    {
      id: 'T-03',
      orgId: 'ORG-01',
      eventId: 'E-01',
      title: '현수막 디자인 수정 반영',
      status: 'inProgress',
      dueDate: new Date('2026-07-23T18:00:00+09:00'),
    },
    // 끝난 업무의 기한은 마감이 아니다.
    {
      id: 'T-04',
      orgId: 'ORG-01',
      title: '끝난 업무',
      status: 'done',
      dueDate: new Date('2026-07-24T18:00:00+09:00'),
    },
    {
      id: 'T-05',
      orgId: 'ORG-01',
      title: '다음 달 예산안 초안',
      status: 'planned',
      dueDate: new Date('2026-08-03T18:00:00+09:00'),
    },
    { id: 'T-99', orgId: 'ORG-02', title: '남의 업무', status: 'inProgress' },
  ])

  app = createApp({
    audit: { async write() {} },
    db: fresh.db as never,
    who: async () => ({
      userId: 'U-01',
      membership: {
        orgId: 'ORG-01',
        memberId: 'M-02',
        role: 'member',
        departmentId: 'D-02',
        inFinanceDepartment: false,
      },
    }),
    lookups: {
      isEventStaff: async () => false,
      isEventStaffManager: async () => false,
      ...meetingLookups(fresh.db as never),
    },
    signIn: {
      open: () => ({ google: true, kakao: false }),
      start: async (provider: string) => ({ url: `https://example.test/${provider}` }),
    },
    attempts: inMemoryAttempts(),
    counter: inMemoryCounter(),
    invite: { linkBase: 'https://vada.app/join', now: () => NOW, newCode: () => 'CODE' },
    newId: () => 'X-01',
  })

  restore = useServer({
    baseUrl: 'http://server',
    fetch: async (input, init) => app.request(String(input), init),
  })
}, 60_000)

afterAll(async () => {
  restore()
  await close()
})

describe('운영 허브가 저장소에서 온다', () => {
  it('OPS-00이 안내 문장과 네 공간의 건수를 그린다', async () => {
    render(<ScreenRouter screenId="OPS-00" scopes={{}} onChangeScope={() => {}} onNavigate={() => {}} />)
    await waitFor(() => expect(screen.getByText('운영 메뉴')).toBeInTheDocument())
    const drawn = document.body.textContent ?? ''
    expect(drawn).not.toContain('이 화면은 아직 준비 중입니다.')
    // **보는 사람의 이름이 서버에서 온다.** 개발용 응답의 이름이 아니라는 증거다.
    expect(drawn).toContain('한마루님이 확인할 업무·회의·행사·일정을 선택하세요.')
    expect(drawn).not.toContain('박해랑님이 확인할')
  })

  // **네 공간이 서로 다른 표를 센다.** 개발용 응답은 여덟 수를 그냥 적어 두면 됐다.
  it('공간마다의 건수를 서버가 센다', async () => {
    await loadSources([{ key: 'ops.spaceStats', params: {} }])
    expect(readObjectSource('ops.spaceStats')).toEqual({
      // 상시 업무만 센다 — 행사 업무(T-03)는 행사 공간의 것이다.
      taskInProgress: 1,
      taskReview: 1,
      meetingToday: 1,
      meetingCleanup: 1,
      eventInProgress: 1,
      eventPlanning: 1,
      // 마감은 **완료되지 않은 업무**의 기한이고 행사 업무도 함께 센다.
      calendarThisWeek: 2,
      calendarUpcoming: 1,
    })
  })
})
