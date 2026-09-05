import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { createApp } from '../../../api/src/app.ts'
import { freshDb } from '../../../api/src/db/testing.ts'
import { inMemoryCounter } from '../../../api/src/public/rate-limit.ts'
import { inMemoryAttempts } from '../../../api/src/idempotency.ts'
import {
  departments,
  eventArchives,
  events,
  members,
  organizations,
  tasks,
  users,
} from '../../../api/src/db/schema.ts'
import { ScreenRouter } from '../screens/ScreenRouter'
import { readListSource, readObjectSource } from './catalog'
import { loadSources, useServer } from './server'

// **완료된 행사 화면을 끝까지 뚫는다**(REC-01).
//
// | 화면 | 읽기 |
// | --- | --- |
// | REC-01 | `record.completedEventAlert` · `record.completedEvents` |
//
// 이 목록은 `event.list`와 다른 물건이다 — 저쪽에는 완료된 행사가 오지 않는다.
//
// **읽기는 `<ScreenRouter>`를 그려서 잰다.** 이 화면은 검색칸이 달렸고 그 값은 화면
// 안의 칸에 산다 — 그릇에 손으로 먹이면 그 자리가 터지는 것을 못 본다.

const NOW = new Date('2026-06-10T10:00:00+09:00')
const at = (text: string) => new Date(`${text}T00:00:00+09:00`)

let restore: () => void
let close: () => Promise<void>

const draw = (screenId: string, screenParams: Record<string, string> = {}) =>
  render(
    <ScreenRouter
      screenId={screenId}
      screenParams={screenParams}
      scopes={{}}
      onChangeScope={() => {}}
      onNavigate={() => {}}
    />,
  )

const drawn = () => document.body.textContent ?? ''

beforeAll(async () => {
  const fresh = await freshDb()
  close = fresh.close

  await fresh.db.insert(organizations).values({ id: 'ORG-01', name: '제12대 학생회' })
  await fresh.db.insert(departments).values({ id: 'D-01', orgId: 'ORG-01', name: '대외협력부' })
  await fresh.db.insert(users).values({ id: 'U-01', email: 'haerang@example.ac.kr' })
  await fresh.db.insert(members).values({
    id: 'M-01',
    orgId: 'ORG-01',
    name: '박해랑',
    departmentId: 'D-01',
    userId: 'U-01',
  })

  // **개발용 응답에 없는 이름으로 둔다** — 그래야 서버를 거친 증거가 된다.
  await fresh.db.insert(events).values([
    {
      id: 'E-R1',
      orgId: 'ORG-01',
      title: '가을 한마당 부스',
      status: 'done',
      startAt: at('2026-05-28'),
      hostDepartmentId: 'D-01',
      updatedAt: NOW,
    },
    {
      id: 'E-R2',
      orgId: 'ORG-01',
      title: '겨울 나눔 행사',
      status: 'done',
      startAt: at('2025-12-19'),
      hostDepartmentId: 'D-01',
      updatedAt: NOW,
    },
    // 아직 안 끝난 행사. 이 목록에 오지 않는다.
    { id: 'E-R3', orgId: 'ORG-01', title: '봄 신입생 환영전', status: 'planning', updatedAt: NOW },
  ])
  await fresh.db.insert(eventArchives).values({
    id: 'AR-R1',
    orgId: 'ORG-01',
    eventId: 'E-R1',
    status: 'published',
  })
  await fresh.db.insert(tasks).values([
    { id: 'T-R1', orgId: 'ORG-01', eventId: 'E-R1', title: '부스 정리', status: 'done' },
    { id: 'T-R2', orgId: 'ORG-01', eventId: 'E-R1', title: '후기 작성', status: 'done' },
  ])

  const app = createApp({
    audit: { async write() {} },
    db: fresh.db as never,
    who: async () => ({
      userId: 'U-01',
      membership: {
        orgId: 'ORG-01',
        memberId: 'M-01',
        role: 'member',
        departmentId: 'D-01',
        inFinanceDepartment: false,
      },
    }),
    lookups: {
      isEventStaff: async () => false,
      isEventStaffManager: async () => false,
      isMeetingHost: async () => false,
      isMeetingCreator: async () => false,
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

describe('완료된 행사가 저장소에서 온다(REC-01)', () => {
  it('완료된 것만 그리고 아직 안 끝난 행사는 없다', async () => {
    draw('REC-01')
    await waitFor(() => expect(screen.getByText('가을 한마당 부스')).toBeInTheDocument())
    const page = drawn()
    expect(page).toContain('겨울 나눔 행사')
    expect(page).not.toContain('봄 신입생 환영전')
    // 개발용 응답의 행사가 아니라는 증거.
    expect(page).not.toContain('봄 축제 학생회 부스')
  })

  // **머리의 건수는 검색으로 걸러지지 않는다.** 서버가 세고 화면은 그 문구만 그린다.
  it('미발행 건수를 서버가 세어 말로 만든다', async () => {
    draw('REC-01')
    await waitFor(() =>
      expect(screen.getByText('인수인계 문서 미발행 1건')).toBeInTheDocument(),
    )
  })

  // **없는 것이 표현이 아니라 뜻이다.** 열 곳이 없으면 그 까닭이 대신 온다.
  it('문서가 있으면 단추, 없으면 그 까닭이 온다', async () => {
    await loadSources([
      { key: 'record.completedEvents', params: {} },
      { key: 'record.completedEventAlert', params: {} },
    ])
    const rows = readListSource('record.completedEvents')
    expect(rows[0]).toMatchObject({
      id: 'E-R1',
      statusLabel: '완료',
      archiveStatus: '발행 완료',
      archiveStatusTone: 'green',
      date: '2026. 05. 28',
      host: '대외협력부',
      actionLabel: '상세 보기 →',
      targetKind: 'published',
    })
    expect(rows[0]!.highlights).toEqual([{ label: '완료 업무 2건' }])
    expect(rows[1]).toMatchObject({
      archiveStatus: '인수인계 문서 미발행',
      archiveStatusTone: 'gray',
      blockedNote: '인수인계 문서가 아직 발행되지 않았습니다',
    })
    expect(readObjectSource('record.completedEventAlert')).toEqual({
      unpublishedNote: '인수인계 문서 미발행 1건',
    })
  })

  it('행사명으로 서버가 거른다', async () => {
    const params = { query: '겨울' }
    await loadSources([{ key: 'record.completedEvents', params }])
    expect(readListSource('record.completedEvents', params).map((row) => row.title)).toEqual([
      '겨울 나눔 행사',
    ])
  })
})
