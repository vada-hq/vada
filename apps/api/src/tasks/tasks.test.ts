import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createApp, type Deps } from '../app.ts'
import type { Db } from '../db/client.ts'
import { freshDb } from '../db/testing.ts'
import {
  departments,
  documents,
  events,
  members,
  organizations,
  tasks,
} from '../db/schema.ts'
import { inMemoryAttempts } from '../idempotency.ts'
import type { Viewer } from '../permissions.ts'
import { inMemoryCounter } from '../public/rate-limit.ts'

// 업무(TASK-01 · EVT-TASK-01 · EVT-TASK-02 · MY-01).
//
// **화면 넷이 한 표를 본다.** 상시 업무와 행사 업무가 같은 `tasks`이고 다른 것은
// 무엇으로 거르느냐뿐이다 — 그래서 이 파일도 화면이 아니라 표를 따라 갈렸다.
//
// 이 파일이 재는 것이 여섯이다.
//
// 1. **거르는 것을 서버가 한다.** 칸반의 열 넷은 같은 자리를 status만 바꿔 네 번
//    부른다 — 목록을 통째로 보내고 화면이 거르면 열 머리의 건수가 화면마다 갈린다.
// 2. **세는 것도 서버가 한다.** 보드 위의 건수는 **보는 범위와 무관하게** 보드
//    전체를 센다(명세가 그렇게 적었다). 화면이 세면 '내 업무'로 좁힌 순간 건수가
//    함께 줄어든다.
// 3. **완성된 글과 색을 준다.** '지연'·'담당자 없음 · 배정 필요'·'red'는 서버가
//    만든다. 화면이 숫자에 단위를 붙이거나 상태를 말로 옮기지 않는다.
// 4. **갈피 셋은 열 넷을 묶어 본 것이다.** 검토 중인 업무는 아직 안 끝났으므로
//    MY-01의 '진행 중'에 든다(db/schema.ts의 `taskStatus` 주석이 정한 규칙).
// 5. **없는 것은 없다고 말한다.** 없는 업무를 물으면 404이고, 빈 값으로 때우지 않는다.
// 6. **울타리가 선다.** 남의 학생회 업무도, 다른 행사의 업무도 섞이지 않는다.

let db: Db
let close: () => Promise<void>

/** 오늘. **지연은 오늘이 언제인지 아는 쪽만 판정할 수 있다.** */
const NOW = new Date('2026-07-21T10:00:00+09:00')

function viewer(orgId = 'ORG-01', memberId = 'M-01'): Viewer {
  return {
    userId: 'U-01',
    membership: {
      orgId,
      memberId,
      role: 'member',
      departmentId: 'D-01',
      inFinanceDepartment: false,
    },
  }
}

function harness(who: Viewer | null = viewer()) {
  const deps: Deps = {
    audit: { async write() {} },
    db,
    who: async () => who,
    lookups: {
      isEventStaff: async () => false,
      isEventStaffManager: async () => false,
      isMeetingHost: async () => false,
      isMeetingCreator: async () => false,
      isMeetingParticipant: async () => false,
    },
    signIn: {
      open: () => ({ google: true, kakao: false }),
      start: async (provider: string) => ({ url: `https://example.test/${provider}` }),
    },
    attempts: inMemoryAttempts(),
    counter: inMemoryCounter(),
    invite: { linkBase: 'https://vada.app/join', now: () => NOW, newCode: () => 'CODE' },
    newId: () => 'X-01',
  }
  return createApp(deps)
}

type Row = Record<string, unknown>

const ask = (path: string, who?: Viewer) => harness(who ?? viewer()).request(path)
const list = async (path: string, who?: Viewer): Promise<Row[]> =>
  (await (await ask(path, who)).json()) as Row[]
const one = async (path: string, who?: Viewer): Promise<Row> =>
  (await (await ask(path, who)).json()) as Row

const board = (status: string, scope = 'all') =>
  list(`/api/ops/tasks?scope=${scope}&status=${status}`)
const eventBoard = (status: string, scope = 'all', eventId = 'E-01') =>
  list(`/api/ops/event/tasks?eventId=${eventId}&scope=${scope}&status=${status}`)
const titles = (rows: Row[]) => rows.map((row) => String(row.title))

beforeAll(async () => {
  const fresh = await freshDb()
  db = fresh.db as unknown as Db
  close = fresh.close

  await db.insert(organizations).values([
    { id: 'ORG-01', name: '제12대 학생회', term: '2026' },
    // **옆 학생회를 하나 더 둔다.** 울타리를 재려면 넘어갈 담이 있어야 한다.
    { id: 'ORG-02', name: '옆 학생회' },
  ])

  // 부서의 차례가 곧 색의 차례다(sortOrder → 이름).
  await db.insert(departments).values([
    { id: 'D-01', orgId: 'ORG-01', name: '운영부', sortOrder: 0 },
    { id: 'D-02', orgId: 'ORG-01', name: '홍보부', sortOrder: 1 },
    { id: 'D-03', orgId: 'ORG-01', name: '재정부', sortOrder: 2, handlesFinance: true },
    { id: 'D-04', orgId: 'ORG-01', name: '기획부', sortOrder: 3 },
    { id: 'D-99', orgId: 'ORG-02', name: '남의 부서' },
  ])

  await db.insert(members).values([
    { id: 'M-01', orgId: 'ORG-01', name: '박해랑', departmentId: 'D-01' },
    { id: 'M-02', orgId: 'ORG-01', name: '이윤슬', departmentId: 'D-02' },
    { id: 'M-99', orgId: 'ORG-02', name: '남의 사람', departmentId: 'D-99' },
  ])

  await db.insert(events).values([
    { id: 'E-01', orgId: 'ORG-01', title: '2026 소프트웨어융합대학 체육대회' },
    { id: 'E-02', orgId: 'ORG-01', title: '2026 신입생 환영회' },
    { id: 'E-99', orgId: 'ORG-02', title: '남의 행사' },
  ])

  const due = (text: string) => new Date(`${text}T00:00:00+09:00`)

  await db.insert(tasks).values([
    // ── 상시 업무(TASK-01). 행사에 걸리지 않은 것이 상시다. ──────────────
    {
      id: 'OT-01',
      orgId: 'ORG-01',
      title: '동아리방·물품 정기 점검',
      departmentId: 'D-01',
      status: 'planned',
      cycle: '매월',
      dueDate: due('2026-08-01'),
    },
    {
      id: 'OT-02',
      orgId: 'ORG-01',
      title: '게시판 공지물 정리',
      departmentId: 'D-02',
      status: 'planned',
      cycle: '매월',
      dueDate: due('2026-07-31'),
      assigneeMemberId: 'M-02',
    },
    {
      id: 'OT-03',
      orgId: 'ORG-01',
      title: '주간 운영회의 자료 준비',
      departmentId: 'D-01',
      status: 'inProgress',
      cycle: '매주',
      dueDate: due('2026-07-19'),
      assigneeMemberId: 'M-01',
    },
    // **되풀이가 상시인 업무.** 기한이 없는 것이 아니라 기한이 상시다.
    {
      id: 'OT-04',
      orgId: 'ORG-01',
      title: 'SNS 계정 운영·공지 게시',
      departmentId: 'D-02',
      status: 'inProgress',
      cycle: '상시',
      assigneeMemberId: 'M-02',
    },
    {
      id: 'OT-05',
      orgId: 'ORG-01',
      title: '학생 건의함 확인·답변',
      departmentId: 'D-04',
      status: 'inProgress',
      cycle: '매주',
      dueDate: due('2026-07-18'),
      assigneeMemberId: 'M-02',
    },
    {
      id: 'OT-06',
      orgId: 'ORG-01',
      title: '학생 건의 답변 문안 검토',
      departmentId: 'D-04',
      status: 'review',
      cycle: '매주',
      dueDate: due('2026-07-22'),
      assigneeMemberId: 'M-01',
    },
    // **끝난 업무는 기한이 지나도 지연이 아니다.**
    {
      id: 'OT-07',
      orgId: 'ORG-01',
      title: '회의실 예약 현황 관리',
      departmentId: 'D-01',
      status: 'done',
      cycle: '매주',
      dueDate: due('2026-07-15'),
      assigneeMemberId: 'M-01',
    },

    // ── 행사 업무(EVT-TASK-01 · EVT-TASK-02) ────────────────────────────
    {
      id: 'ET-01',
      orgId: 'ORG-01',
      eventId: 'E-01',
      title: '행사장 안전 점검',
      departmentId: 'D-01',
      status: 'planned',
      dueDate: due('2026-08-18'),
    },
    {
      id: 'ET-02',
      orgId: 'ORG-01',
      eventId: 'E-01',
      code: 'T-01',
      title: '참가자 모집 공지 작성',
      departmentId: 'D-02',
      status: 'inProgress',
      dueDate: due('2026-07-24'),
      assigneeMemberId: 'M-02',
    },
    // 상세가 다 채워진 업무. 제출까지 했고 공식 결과는 아직 없다.
    {
      id: 'ET-03',
      orgId: 'ORG-01',
      eventId: 'E-01',
      code: 'T-03',
      title: '현수막 디자인 수정 반영',
      description: '검토 의견을 반영해 현수막 디자인을 수정하고 인쇄 전 시안을 확정합니다.',
      expectedOutput: '문서·파일',
      priority: '높음',
      departmentId: 'D-02',
      status: 'inProgress',
      dueDate: due('2026-07-18'),
      assigneeMemberId: 'M-02',
      submittedAt: new Date('2026-07-19T14:00:00+09:00'),
      reviewComment: '메인 색상이 가이드라인과 다름. 교정 후 재제출 바랍니다.',
    },
    {
      id: 'ET-04',
      orgId: 'ORG-01',
      eventId: 'E-01',
      title: '행사 안전 안내문 검토',
      departmentId: 'D-04',
      status: 'review',
      dueDate: due('2026-07-22'),
      assigneeMemberId: 'M-01',
    },
    {
      id: 'ET-05',
      orgId: 'ORG-01',
      eventId: 'E-01',
      title: '행사 운영 계획 확정',
      departmentId: 'D-04',
      status: 'done',
      dueDate: due('2026-07-10'),
      assigneeMemberId: 'M-01',
    },
    {
      id: 'ET-06',
      orgId: 'ORG-01',
      eventId: 'E-01',
      title: '참가자 명단 최종 확정',
      departmentId: 'D-04',
      status: 'planned',
      dueDate: due('2026-07-25'),
      assigneeMemberId: 'M-01',
    },
    // 다른 행사의 업무. 이 행사의 보드에 나오면 안 된다.
    {
      id: 'ET-90',
      orgId: 'ORG-01',
      eventId: 'E-02',
      title: '환영회 현수막 시안',
      departmentId: 'D-02',
      status: 'planned',
      dueDate: due('2026-07-30'),
    },

    // 옆 학생회의 업무. 어느 자리에도 나오면 안 된다.
    {
      id: 'XT-01',
      orgId: 'ORG-02',
      title: '남의 상시 업무',
      departmentId: 'D-99',
      status: 'planned',
      cycle: '매주',
      dueDate: due('2026-07-20'),
      assigneeMemberId: 'M-99',
    },
    {
      id: 'XT-02',
      orgId: 'ORG-02',
      eventId: 'E-99',
      title: '남의 행사 업무',
      departmentId: 'D-99',
      status: 'review',
      dueDate: due('2026-07-18'),
      assigneeMemberId: 'M-99',
    },
  ])

  await db.insert(documents).values([
    {
      id: 'DOC-01',
      orgId: 'ORG-01',
      eventId: 'E-01',
      taskId: 'ET-03',
      title: '현수막 제작 사양서',
    },
    {
      id: 'DOC-02',
      orgId: 'ORG-01',
      eventId: 'E-01',
      taskId: 'ET-04',
      title: '행사 안전 안내문 초안',
    },
  ])
}, 60_000)

afterAll(async () => {
  await close()
})

describe('상시 업무 보드가 저장소에서 온다(TASK-01)', () => {
  // **열마다 따로 조회한다.** 한 번에 다 주고 화면이 가르면 열 머리의 건수가
  // 화면이 센 것이 된다.
  it('열 하나에는 그 단계의 업무만 온다', async () => {
    expect(titles(await board('planned'))).toEqual([
      // 먼저 봐야 하는 것(담당자 없음)이 위다.
      '동아리방·물품 정기 점검',
      '게시판 공지물 정리',
    ])
    // 다른 열의 업무는 오지 않는다 — 열마다 따로 조회한다.
    expect(titles(await board('review'))).toEqual(['학생 건의 답변 문안 검토'])
  })

  it('행사에 걸린 업무는 상시 보드에 오지 않는다', async () => {
    const drawn = titles(await board('inProgress'))
    expect(drawn).not.toContain('참가자 모집 공지 작성')
    expect(drawn).toEqual(
      expect.arrayContaining(['주간 운영회의 자료 준비', 'SNS 계정 운영·공지 게시']),
    )
  })

  it('남의 학생회 업무가 섞이지 않는다', async () => {
    const drawn = [
      ...titles(await board('planned')),
      ...titles(await board('inProgress')),
      ...titles(await board('review')),
      ...titles(await board('done')),
    ]
    expect(drawn).not.toContain('남의 상시 업무')
  })

  // 보는 범위도 서버가 거른다. 받아온 것을 화면에서 거르면 열 머리가 어긋난다.
  it('내 업무만 보면 내 것만 온다', async () => {
    expect(titles(await board('inProgress', 'mine'))).toEqual(['주간 운영회의 자료 준비'])
  })

  // **완성된 글을 준다.** 화면이 '담당자가 없다'를 말로 옮기면 화면마다 다른 말이 나온다.
  it('담당자가 없으면 그 사실이 완성된 안내와 경고 색으로 온다', async () => {
    const row = (await board('planned')).find((one) => one.title === '동아리방·물품 정기 점검')!
    expect(row.assignee).toBe('담당자 없음 · 배정 필요')
    // 화면은 `tone !== departmentTone`으로 '먼저 봐야 하는 카드'를 가린다.
    expect(row.tone).toBe('red')
    expect(row.tone).not.toBe(row.departmentTone)
  })

  // 부서 색은 조직의 부서 차례가 정한다. 한 조직 안에서 두 부서가 같은 색을 갖지 않는다.
  it('부서마다 다른 색이 붙는다', async () => {
    const rows = [...(await board('planned')), ...(await board('inProgress'))]
    const byDepartment = new Map(
      rows.map((row) => [String(row.department), String(row.departmentTone)]),
    )
    expect(byDepartment.get('운영부')).toBe('teal')
    expect(byDepartment.get('홍보부')).toBe('pink')
    expect(byDepartment.get('기획부')).toBe('violet')
    // 경고 색은 부서 색이 아니다 — 겹치면 미배정 카드가 조용해진다.
    expect([...byDepartment.values()]).not.toContain('red')
  })

  it('되풀이가 상시면 기한도 상시로 온다', async () => {
    const row = (await board('inProgress')).find((one) => one.title === 'SNS 계정 운영·공지 게시')!
    expect(row.cycle).toBe('상시')
    expect(row.dueDate).toBe('상시')
  })

  // **주의 표시는 없으면 오지 않는다**(명세가 optional로 적었다).
  it('기한이 지난 업무만 지연 표시를 갖는다', async () => {
    const rows = await board('inProgress')
    const late = rows.find((one) => one.title === '학생 건의함 확인·답변')!
    expect(late.alert).toBe('지연')
    expect(late.alertTone).toBe('red')
    expect(late.dueDate).toBe('2026-07-18')

    const onTime = rows.find((one) => one.title === 'SNS 계정 운영·공지 게시')!
    expect(onTime.alert).toBeUndefined()
    expect(onTime.alertTone).toBeUndefined()
  })

  it('검토 중인 업무는 검토 필요로 온다', async () => {
    const row = (await board('review'))[0]!
    expect(row.alert).toBe('검토 필요')
    expect(row.alertTone).toBe('yellow')
  })

  // **끝난 업무는 기한이 지나도 지연이 아니다.** 이미 한 일을 다시 재촉하지 않는다.
  it('완료된 업무는 기한이 지나도 지연이 아니다', async () => {
    const row = (await board('done')).find((one) => one.title === '회의실 예약 현황 관리')!
    expect(row.alert).toBeUndefined()
  })

  // 명세가 든 단계가 아니면 막는다. 그대로 넘기면 PostgreSQL이 던져 500이 된다.
  it('명세에 없는 단계나 범위를 물으면 막힌다', async () => {
    expect((await ask('/api/ops/tasks?scope=all&status=없는단계')).status).toBe(422)
    expect((await ask('/api/ops/tasks?scope=없는범위&status=planned')).status).toBe(422)
  })

  // **안 넘긴 것과 틀리게 넘긴 것은 다르다.** 보는 범위는 화면 안의 칸에 살아서
  // 그릇이 미리 받을 때는 아직 없다 — 그때 막으면 화면이 그려지기도 전에 통째로
  // 오류가 된다. 안 넘기면 좁히지 않는 것이 그 값의 뜻이다('전체').
  it('보는 범위를 안 넘기면 좁히지 않는다', async () => {
    expect(titles(await list('/api/ops/tasks?status=review'))).toEqual([
      '학생 건의 답변 문안 검토',
    ])
  })

  // 단계는 **열 하나를 가리키는 값**이라 대신할 것이 없다. 넷을 다 주면 보드가
  // 한 열이 된다.
  it('단계를 안 넘기면 막힌다', async () => {
    expect((await ask('/api/ops/tasks?scope=all')).status).toBe(422)
  })
})

describe('보드 위의 건수는 보드 전체를 센다(TASK-01)', () => {
  // **보는 범위와 무관하다** — 명세가 그렇게 적었다. 화면이 세면 '내 업무'로 좁힌
  // 순간 건수가 함께 줄고, 그러면 '지연 2건'이 사람마다 다른 수가 된다.
  it('상시 업무 전체를 센다', async () => {
    expect(await one('/api/ops/tasks/alerts')).toEqual({
      delayedCount: 2,
      reviewCount: 1,
      mineCount: 3,
      unassignedCount: 1,
    })
  })
})

describe('행사 업무 보드가 저장소에서 온다(EVT-TASK-01)', () => {
  it('그 행사의 업무만 온다', async () => {
    const drawn = titles(await eventBoard('planned'))
    expect(drawn.sort()).toEqual(['참가자 명단 최종 확정', '행사장 안전 점검'])
    // 다른 행사의 업무도, 상시 업무도 아니다.
    expect(drawn).not.toContain('환영회 현수막 시안')
    expect(drawn).not.toContain('동아리방·물품 정기 점검')
  })

  // **그리지 않는 조각이다.** 카드를 누를 때 '어느 업무인지'로 넘어간다.
  it('카드가 업무를 가리키는 값을 든다', async () => {
    const row = (await eventBoard('inProgress')).find(
      (one) => one.title === '현수막 디자인 수정 반영',
    )!
    expect(row.id).toBe('ET-03')
  })

  // **참거짓은 참거짓으로 온다.** 없을 때 조각이 안 오면 '없다'와 '서버가 아직
  // 모른다'가 같은 모양이 된다.
  it('딸린 문서가 있는지를 늘 참거짓으로 준다', async () => {
    const rows = await eventBoard('inProgress')
    expect(rows.find((one) => one.title === '현수막 디자인 수정 반영')!.hasDocuments).toBe(true)
    expect(rows.find((one) => one.title === '참가자 모집 공지 작성')!.hasDocuments).toBe(false)
  })

  // 행사 보드는 기한 옆에 지연을 **서버가 붙여** 준다(상시 보드와 다른 모양이다).
  it('늦은 기한에는 그 사실이 붙어서 온다', async () => {
    const row = (await eventBoard('inProgress')).find(
      (one) => one.title === '현수막 디자인 수정 반영',
    )!
    expect(row.dueDate).toBe('2026-07-18 · 지연')
  })

  it('내 업무만 보면 내 것만 온다', async () => {
    expect(titles(await eventBoard('planned', 'mine'))).toEqual(['참가자 명단 최종 확정'])
  })

  it('남의 학생회 행사를 물으면 그 업무가 오지 않는다', async () => {
    expect(await eventBoard('review', 'all', 'E-99')).toEqual([])
  })

  // 이 행사의 보드 전체를 센다 — 상시 업무의 건수와 세는 대상이 다르다.
  it('이 행사의 보드 전체를 센다', async () => {
    expect(await one('/api/ops/event/tasks/alerts?eventId=E-01')).toEqual({
      delayedCount: 1,
      reviewCount: 1,
      mineCount: 3,
      unassignedCount: 1,
    })
  })
})

describe('업무 하나를 읽는다(EVT-TASK-02)', () => {
  it('저장소의 업무를 완성된 글과 색으로 준다', async () => {
    const row = await one('/api/ops/task?taskId=ET-03')
    expect(row.code).toBe('T-03')
    expect(row.title).toBe('현수막 디자인 수정 반영')
    expect(row.status).toBe('진행 중')
    expect(row.statusTone).toBe('blue')
    expect(row.priority).toBe('높음')
    expect(row.priorityTone).toBe('red')
    expect(row.assignee).toBe('이윤슬')
    expect(row.department).toBe('홍보부')
    // 늦었으면 그 사실까지 붙어서 온다 — 무엇을 지연으로 세는지 화면이 유도할 수 없다.
    expect(row.dueDate).toBe('2026-07-18 · 지연')
    expect(row.expectedOutput).toBe('문서·파일')
  })

  // **없는 것은 없다고 말한다.** 빈 글을 주면 화면이 빈 자리를 그린다.
  it('아직 안 적은 것은 그 사실을 말로 준다', async () => {
    const row = await one('/api/ops/task?taskId=ET-01')
    expect(row.completionCriteria).toBe('완료 기준이 아직 등록되지 않았습니다.')
    expect(row.description).toBe('설명이 아직 등록되지 않았습니다.')
    expect(row.expectedOutput).toBe('아직 정해지지 않았습니다.')
    expect(row.assignee).toBe('담당자 없음 · 배정 필요')
    expect(row.priority).toBe('우선순위 미정')
    expect(row.priorityTone).toBe('gray')
  })

  it('이어진 항목이 저장소에서 온다', async () => {
    const row = await one('/api/ops/task?taskId=ET-03')
    expect(row.linkedItems).toEqual([{ label: '현수막 제작 사양서' }])
    expect((await one('/api/ops/task?taskId=ET-01')).linkedItems).toEqual([])
  })

  it('없는 업무는 없다고 답한다', async () => {
    expect((await ask('/api/ops/task?taskId=없는업무')).status).toBe(404)
  })

  // **울타리.** 남의 학생회 업무는 이름조차 새면 안 된다.
  it('남의 학생회 업무는 열리지 않는다', async () => {
    expect((await ask('/api/ops/task?taskId=XT-02')).status).toBe(404)
    expect((await ask('/api/ops/task/review-status?taskId=XT-02')).status).toBe(404)
  })

  it('검토 현황이 제출 여부에서 나온다', async () => {
    const submitted = await one('/api/ops/task/review-status?taskId=ET-03')
    expect(submitted.submission).toBe('제출 완료')
    expect(submitted.submissionTone).toBe('blue')
    expect(submitted.officialResult).toBe('미확정')
    expect(submitted.officialResultTone).toBe('gray')
    expect(submitted.reviewComment).toBe('메인 색상이 가이드라인과 다름. 교정 후 재제출 바랍니다.')
    expect(submitted.nextStepNote).toBe('수정 후 재제출이 필요합니다.')
  })

  // 아직 아무것도 안 낸 업무. **없는 것과 아직 안 한 것은 다르다.**
  it('제출 전이면 무엇을 하면 시작되는지 말한다', async () => {
    const fresh = await one('/api/ops/task/review-status?taskId=ET-01')
    expect(fresh.submission).toBe('미제출')
    expect(fresh.submissionTone).toBe('gray')
    expect(fresh.reviewComment).toBe('검토 의견이 아직 없습니다.')
    expect(fresh.nextStepNote).toBe('결과물을 제출하면 검토가 시작됩니다.')
  })
})

describe('내 업무를 읽는다(MY-01)', () => {
  // **갈피 셋은 칸반의 넷을 묶어 본 것이다.** 검토 중인 업무는 아직 안 끝났으므로
  // '진행 중'에 든다 — 표에 셋을 담으면 칸반의 넷을 못 그린다.
  it('검토 중인 업무가 진행 중 갈피에 든다', async () => {
    expect(titles(await list('/api/my/tasks?tab=inProgress')).sort()).toEqual([
      '주간 운영회의 자료 준비',
      '학생 건의 답변 문안 검토',
      '행사 안전 안내문 검토',
    ])
  })

  it('내가 담당인 업무만 온다', async () => {
    const drawn = [
      ...titles(await list('/api/my/tasks?tab=todo')),
      ...titles(await list('/api/my/tasks?tab=inProgress')),
      ...titles(await list('/api/my/tasks?tab=done')),
    ]
    // 이윤슬의 업무도 남의 학생회 업무도 아니다.
    expect(drawn).not.toContain('게시판 공지물 정리')
    expect(drawn).not.toContain('남의 상시 업무')
  })

  it('맥락과 기한을 완성된 글로 준다', async () => {
    const rows = await list('/api/my/tasks?tab=inProgress')
    const ops = rows.find((row) => row.title === '주간 운영회의 자료 준비')!
    expect(ops.context).toBe('상시 업무')
    expect(ops.department).toBe('운영부')
    expect(ops.status).toBe('진행 중')
    expect(ops.date).toBe('07.19')

    const inEvent = rows.find((row) => row.title === '행사 안전 안내문 검토')!
    expect(inEvent.context).toBe('2026 소프트웨어융합대학 체육대회')
    expect(inEvent.status).toBe('검토 중')
  })

  // 다음에 할 일은 **단계가 정한다.** 화면이 상태를 보고 문장을 지으면 화면마다 갈린다.
  it('다음에 할 일을 완성된 문구로 준다', async () => {
    const rows = await list('/api/my/tasks?tab=inProgress')
    expect(rows.find((row) => row.title === '학생 건의 답변 문안 검토')!.nextAction).toBe(
      '검토 의견을 확인하고 처리 내용을 기록',
    )
    expect(rows.find((row) => row.title === '주간 운영회의 자료 준비')!.nextAction).toBe(
      '진행 내용을 정리하고 검토를 요청',
    )
  })

  // **연결 문서는 없으면 오지 않는다**(명세가 optional로 적었다).
  it('연결된 문서가 있을 때만 그 이름이 온다', async () => {
    const rows = await list('/api/my/tasks?tab=inProgress')
    expect(rows.find((row) => row.title === '행사 안전 안내문 검토')!.linkedDocument).toBe(
      '행사 안전 안내문 초안',
    )
    expect(
      rows.find((row) => row.title === '주간 운영회의 자료 준비')!.linkedDocument,
    ).toBeUndefined()
  })

  // **거르는 것은 서버가 한다.** 받아온 것을 화면에서 거르면 갈피의 건수와 어긋난다.
  it('검색어로 거르는 것을 서버가 한다', async () => {
    expect(titles(await list('/api/my/tasks?tab=inProgress&query=건의'))).toEqual([
      '학생 건의 답변 문안 검토',
    ])
    // 업무 이름으로도 그 업무가 속한 행사 이름으로도 찾는다.
    expect(titles(await list('/api/my/tasks?tab=inProgress&query=체육대회'))).toEqual([
      '행사 안전 안내문 검토',
    ])
  })

  it('명세에 없는 갈피를 물으면 막힌다', async () => {
    expect((await ask('/api/my/tasks?tab=없는갈피')).status).toBe(422)
  })

  // 갈피도 화면 안의 칸에 산다 — 안 넘기면 좁히지 않는다. 갈피 셋의 합이 곧
  // 내 업무 전부이므로 '안 고른 것'에 뜻이 있다.
  it('갈피를 안 넘기면 내 업무 전부가 온다', async () => {
    expect((await list('/api/my/tasks')).length).toBe(6)
  })

  // 갈피의 건수는 **검색어와 무관하다** — 인자를 받지 않는 자리다.
  it('갈피마다의 건수를 센다', async () => {
    expect(await one('/api/my/task-tab-counts')).toEqual({
      todo: 1,
      inProgress: 3,
      done: 2,
    })
  })

  it('내 업무의 상태별 건수를 센다', async () => {
    expect(await one('/api/my/task-alerts')).toEqual({
      delayedCount: 1,
      todoCount: 1,
      reviewCount: 2,
      // **홈이 그리는 한 줄은 서버가 만든다.** 갈피 '진행 중'의 수와 같은 셈이다 —
      // 화면이 두 수를 더하면 그 묶는 규칙이 화면에 박히고, 홈과 MY-01이 갈린다.
      myWorkNote: '진행 중·검토 필요 3건',
    })
  })
})
