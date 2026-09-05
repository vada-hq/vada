import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Db } from '../db/client.ts'
import { freshDb } from '../db/testing.ts'
import {
  departments,
  documents,
  events,
  meetings,
  members,
  organizations,
  tasks,
} from '../db/schema.ts'
import { harness, matchesContract, viewer } from './testing.ts'

// 행사 개요 — 후속 정리 중(EVT-02D)이 읽는 셋.
//
// **상태 이름도 누가 다음 단계로 넘길 수 있는지도 서버가 준다.** 화면이 '후속 정리
// 중'과 '회장단만'을 들면 단계가 늘거나 권한이 바뀔 때 화면이 조용히 틀린다 —
// 두 모달(EVT-02C·EVT-02E)이 이미 같은 길을 간다.
//
// **남은 것은 셋으로 갈린다**: 안 끝난 업무 · 정리 안 된 문서 · 안 쓴 회의록.
// 셋 다 표가 아는 사실이고, '확인 필요 참가자'는 개요와 같은 근거를 쓴다.

let db: Db
let close: () => Promise<void>

beforeAll(async () => {
  const fresh = await freshDb()
  db = fresh.db as unknown as Db
  close = fresh.close

  await db.insert(organizations).values([
    { id: 'ORG-01', name: '제12대 학생회' },
    { id: 'ORG-02', name: '옆 학생회' },
  ])
  await db.insert(departments).values({ id: 'D-01', orgId: 'ORG-01', name: '학술체육부' })
  await db.insert(members).values({
    id: 'M-02',
    orgId: 'ORG-01',
    name: '이윤슬',
    role: 'head',
    departmentId: 'D-01',
  })

  await db.insert(events).values([
    // 후속 정리 중인 행사. 이 화면이 열리는 자리다.
    { id: 'E-03', orgId: 'ORG-01', title: '2026 가을 한마당', status: 'wrapUp' },
    // 아직 기획 중인 행사. 띠는 **행사의 단계를 따라간다.**
    { id: 'E-01', orgId: 'ORG-01', title: '2026 신입생 환영회', status: 'planning' },
    // 남은 것이 하나도 없는 행사.
    { id: 'E-04', orgId: 'ORG-01', title: '2026 봄 축제', status: 'wrapUp' },
    { id: 'E-99', orgId: 'ORG-02', title: '남의 행사', status: 'wrapUp' },
  ])

  await db.insert(tasks).values([
    // 기한이 지났다. **끝나지 않은 것만 지연이다.**
    {
      id: 'WT-01',
      orgId: 'ORG-01',
      eventId: 'E-03',
      title: '현수막 반납',
      status: 'planned',
      departmentId: 'D-01',
      assigneeMemberId: 'M-02',
      dueDate: new Date('2026-08-12T18:00:00+09:00'),
    },
    {
      id: 'WT-02',
      orgId: 'ORG-01',
      eventId: 'E-03',
      title: '결과 보고서 작성',
      status: 'inProgress',
    },
    // 끝난 업무는 남은 것이 아니다.
    { id: 'WT-03', orgId: 'ORG-01', eventId: 'E-03', title: '정산 마감', status: 'done' },
  ])

  await db.insert(documents).values([
    { id: 'WD-01', orgId: 'ORG-01', eventId: 'E-03', title: '결과 보고서', status: 'drafting' },
    // 확정된 문서는 더 정리할 것이 없다.
    { id: 'WD-02', orgId: 'ORG-01', eventId: 'E-03', title: '운영 계획서', status: 'confirmed' },
  ])

  await db.insert(meetings).values([
    {
      id: 'WM-01',
      orgId: 'ORG-01',
      eventId: 'E-03',
      kind: 'event',
      title: '마무리 회의',
      status: 'done',
      minutesStatus: 'notStarted',
    },
    {
      id: 'WM-02',
      orgId: 'ORG-01',
      eventId: 'E-03',
      kind: 'event',
      title: '운영 점검 회의',
      status: 'done',
      minutesStatus: 'done',
    },
    // **취소된 회의는 회의록을 쓸 것이 아니다.** 임시 저장한 회의도 마찬가지다.
    {
      id: 'WM-03',
      orgId: 'ORG-01',
      eventId: 'E-03',
      kind: 'event',
      title: '취소된 회의',
      status: 'cancelled',
      minutesStatus: 'notStarted',
    },
    {
      id: 'WM-04',
      orgId: 'ORG-01',
      eventId: 'E-03',
      kind: 'event',
      title: '임시 저장 회의',
      status: 'draft',
      minutesStatus: 'notStarted',
    },
  ])
})

afterAll(async () => {
  await close()
})

const get = (tail: string, eventId = 'E-03', who = viewer()) =>
  harness(db, { who }).request(`/api/ops/events/${encodeURIComponent(eventId)}/wrap-up${tail}`)

const read = async (tail: string, eventId = 'E-03') =>
  (await (await get(tail, eventId)).json()) as Record<string, string>

const readList = async (tail: string, eventId = 'E-03') =>
  (await (await get(tail, eventId)).json()) as Array<Record<string, string>>

describe('후속 정리 상태 줄과 띠(event.wrapUpBanner)', () => {
  it('상태의 말과 색이 행사 목록과 같은 곳에서 온다', async () => {
    const body = await read('')
    expect(body.stateLabel).toBe('후속 정리 중')
    expect(body.stateTone).toBe('yellow')
  })

  // **역할 이름을 여기 적지 않는다.** 권한 행렬을 고치면 이 글이 저절로 따라온다.
  it('누가 완료 처리할 수 있는지를 권한 행렬에서 만든 글로 준다', async () => {
    expect((await read('')).permissionNote).toBe('행사 완료 처리는 회장단만 할 수 있습니다.')
  })

  it('띠가 지금 단계를 말한다', async () => {
    const body = await read('')
    expect(body.headline).toBe('행사가 종료되었습니다')
    expect(body.note).toBe('남은 업무와 기록을 확인한 뒤에 행사를 완료 처리할 수 있습니다.')
    expect(body.tone).toBe('yellow')
  })

  // 이 화면은 후속 정리 중일 때 열리지만 자리는 **행사 하나를 가리킨다** —
  // 다른 단계를 물으면 그 단계를 말한다. 지어낸 단계를 답하지 않는다.
  it('다른 단계의 행사는 그 단계를 말한다', async () => {
    const body = await read('', 'E-01')
    expect(body.stateLabel).toBe('기획 중')
    expect(body.headline).toBe('아직 행사가 끝나지 않았습니다')
  })

  it('울타리를 넘지 않는다', async () => {
    expect((await get('', 'E-99')).status).toBe(404)
    expect((await get('', 'E-없음')).status).toBe(404)
  })

  it('답이 계약의 모양을 지킨다', async () => {
    for (const eventId of ['E-03', 'E-01']) {
      expect(matchesContract('event.wrapUpBanner', await read('', eventId))).toBe(true)
    }
  })
})

describe('후속 정리 현황 타일 넷(event.wrapUpCounts)', () => {
  it('남은 것을 갈래마다 센다', async () => {
    const body = await read('/counts')
    expect(body.unfinishedTasks).toBe('2건')
    expect(body.unorganizedDocs).toBe('1건')
    // 취소된 회의와 임시 저장한 회의는 회의록을 쓸 것이 아니다.
    expect(body.unwrittenMinutes).toBe('1건')
    expect(body.needsCheck).toBe('0명')
  })

  // **색이 남은 것을 말한다.** 없으면 초록이고, 있으면 그 갈래의 주의 색이다.
  it('남은 것이 없는 타일만 초록이다', async () => {
    const body = await read('/counts')
    expect(body.unfinishedTasksTone).toBe('red')
    expect(body.unorganizedDocsTone).toBe('orange')
    expect(body.unwrittenMinutesTone).toBe('yellow')
    expect(body.needsCheckTone).toBe('green')
  })

  it('다 끝난 행사는 네 타일이 모두 초록이다', async () => {
    const body = await read('/counts', 'E-04')
    expect([
      body.unfinishedTasksTone,
      body.unorganizedDocsTone,
      body.unwrittenMinutesTone,
      body.needsCheckTone,
    ]).toEqual(['green', 'green', 'green', 'green'])
  })

  it('울타리를 넘지 않는다', async () => {
    expect((await get('/counts', 'E-99')).status).toBe(404)
  })

  it('답이 계약의 모양을 지킨다', async () => {
    expect(matchesContract('event.wrapUpCounts', await read('/counts'))).toBe(true)
  })
})

describe('남은 항목 상세(event.wrapUpRemaining)', () => {
  // **줄마다 그 원본으로 간다.** id가 업무의 id여야 업무 보드가 그것을 찾는다.
  it('안 끝난 업무를 마감이 이른 차례로 준다', async () => {
    const rows = await readList('/remaining')
    expect(rows.map((row) => row.id)).toEqual(['WT-01', 'WT-02'])
    expect(rows[0]).toEqual({
      id: 'WT-01',
      title: '현수막 반납',
      detail: '학술체육부 · 이윤슬 · 08. 12까지 · 지연',
      tone: 'red',
    })
    // 비어 있는 것은 **그 사실이 말로** 온다. 업무 보드가 쓰는 말과 같은 말이다.
    expect(rows[1]).toEqual({
      id: 'WT-02',
      title: '결과 보고서 작성',
      detail: '부서 미정 · 담당자 없음 · 배정 필요 · 기한 미정',
      tone: 'gray',
    })
  })

  it('남은 것이 없으면 비어서 온다', async () => {
    expect(await readList('/remaining', 'E-04')).toEqual([])
  })

  it('울타리를 넘지 않는다', async () => {
    expect((await get('/remaining', 'E-99')).status).toBe(404)
  })

  it('답이 계약의 모양을 지킨다', async () => {
    expect(matchesContract('event.wrapUpRemaining', await readList('/remaining'))).toBe(true)
  })
})
