import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { createApp } from '../../../api/src/app.ts'
import { freshDb } from '../../../api/src/db/testing.ts'
import { inMemoryCounter } from '../../../api/src/public/rate-limit.ts'
import { inMemoryAttempts } from '../../../api/src/idempotency.ts'
import {
  departments,
  documents,
  events,
  members,
  organizations,
  tasks,
  users,
} from '../../../api/src/db/schema.ts'
import { ScreenRouter } from '../screens/ScreenRouter'
import { readListSource, readObjectSource } from './catalog'
import { loadSources, useServer } from './server'

// **업무 화면 넷을 끝까지 뚫는다**(TASK-01 · EVT-TASK-01 · EVT-TASK-02 · MY-01).
//
// 화면 넷이 한 표를 본다 — 상시 업무와 행사 업무가 같은 `tasks`이고 다른 것은
// 무엇으로 거르느냐뿐이다. 그래서 여기서 재는 것도 화면마다의 값이 아니라
// **한 표에서 나온 값이 화면마다 옳게 갈리는가**다.
//
// | 화면 | 읽기 |
// | --- | --- |
// | TASK-01 | `task.board`(열 넷) · `task.alerts` |
// | EVT-TASK-01 | `event.taskBoard`(열 넷) · `event.taskAlerts` |
// | EVT-TASK-02 | `task.detail` · `task.reviewStatus` |
// | MY-01 | `my.tasks` · `my.taskAlerts` · `my.taskTabCounts` |
//
// **읽기는 `<ScreenRouter>`를 그려서 잰다.** 그릇에 손으로 값을 먹이면 거르개가
// 달린 화면이 서버에 붙는 순간 터지는 것을 못 본다 — 이 넷은 전부 거르개가 달렸고,
// 그 값은 화면 안의 칸에 산다.
//
// **쓰기는 없다.** 업무를 더하거나 고치는 동작을 명세가 전부 `pending`으로 적어
// 두었다.

const NOW = new Date('2026-07-21T10:00:00+09:00')

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

  await fresh.db.insert(organizations).values([
    { id: 'ORG-01', name: '제12대 학생회' },
    // **옆 학생회를 하나 더 둔다.** 울타리를 재려면 넘어갈 담이 있어야 한다.
    { id: 'ORG-02', name: '옆 학생회' },
  ])
  await fresh.db.insert(departments).values([
    { id: 'D-01', orgId: 'ORG-01', name: '운영부', sortOrder: 0 },
    { id: 'D-02', orgId: 'ORG-01', name: '홍보부', sortOrder: 1 },
    { id: 'D-99', orgId: 'ORG-02', name: '남의 부서' },
  ])
  await fresh.db.insert(users).values({ id: 'U-01', email: 'haerang@example.ac.kr' })
  await fresh.db.insert(members).values([
    { id: 'M-01', orgId: 'ORG-01', name: '박해랑', departmentId: 'D-01', userId: 'U-01' },
    { id: 'M-02', orgId: 'ORG-01', name: '이윤슬', departmentId: 'D-02' },
    { id: 'M-99', orgId: 'ORG-02', name: '남의 사람', departmentId: 'D-99' },
  ])
  await fresh.db.insert(events).values([
    // 개발용 응답도 아는 id다(행사 작업 공간의 머리가 아직 가짜에서 온다).
    // **이름은 개발용 응답에 없는 것으로 둔다** — 그래야 서버를 거친 증거가 된다.
    {
      id: 'E-01',
      orgId: 'ORG-01',
      title: '2026 소프트웨어융합대학 가을 한마당',
      updatedAt: NOW,
    },
    { id: 'E-99', orgId: 'ORG-02', title: '남의 행사', updatedAt: NOW },
  ])

  const due = (text: string) => new Date(`${text}T00:00:00+09:00`)

  await fresh.db.insert(tasks).values([
    // ── 상시 업무(TASK-01) ────────────────────────────────────────────────
    {
      id: 'OT-01',
      orgId: 'ORG-01',
      title: '동아리방 물품 정기 점검',
      departmentId: 'D-01',
      status: 'planned',
      cycle: '매월',
      dueDate: due('2026-08-01'),
    },
    {
      id: 'OT-02',
      orgId: 'ORG-01',
      title: '학생 건의함 확인과 답변',
      departmentId: 'D-02',
      status: 'inProgress',
      cycle: '매주',
      dueDate: due('2026-07-18'),
      assigneeMemberId: 'M-02',
    },
    {
      id: 'OT-03',
      orgId: 'ORG-01',
      title: '주간 운영회의 자료 준비',
      departmentId: 'D-01',
      status: 'review',
      cycle: '매주',
      dueDate: due('2026-07-22'),
      assigneeMemberId: 'M-01',
    },

    // ── 행사 업무(EVT-TASK-01 · EVT-TASK-02) ─────────────────────────────
    {
      id: 'ET-01',
      orgId: 'ORG-01',
      eventId: 'E-01',
      code: 'T-11',
      title: '한마당 현수막 디자인 확정',
      description: '검토 의견을 반영해 현수막 디자인을 수정합니다.',
      expectedOutput: '문서·파일',
      priority: '높음',
      departmentId: 'D-02',
      status: 'inProgress',
      dueDate: due('2026-07-18'),
      assigneeMemberId: 'M-02',
      submittedAt: new Date('2026-07-19T14:00:00+09:00'),
      reviewComment: '메인 색상이 가이드라인과 다릅니다.',
    },
    {
      id: 'ET-02',
      orgId: 'ORG-01',
      eventId: 'E-01',
      title: '한마당 참가자 명단 확정',
      departmentId: 'D-01',
      status: 'planned',
      dueDate: due('2026-07-25'),
      assigneeMemberId: 'M-01',
    },

    // 옆 학생회의 업무. 어느 화면에도 나오면 안 된다.
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
  ])

  await fresh.db.insert(documents).values({
    id: 'DOC-01',
    orgId: 'ORG-01',
    eventId: 'E-01',
    taskId: 'ET-01',
    title: '한마당 현수막 제작 사양서',
  })

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
  })

  // **인자를 그대로 넘긴다.** 주소만 넘기면 인자가 통째로 빠진다.
  restore = useServer({
    baseUrl: 'http://server',
    fetch: async (input, init) => app.request(String(input), init),
  })
}, 60_000)

afterAll(async () => {
  restore()
  await close()
})

describe('상시 업무 보드가 저장소에서 온다(TASK-01)', () => {
  it('내 학생회의 상시 업무를 열마다 그린다', async () => {
    draw('TASK-01')
    await waitFor(() =>
      expect(screen.getByText('동아리방 물품 정기 점검')).toBeInTheDocument(),
    )
    const page = drawn()
    // 행사에 걸린 업무도, 남의 학생회 업무도 이 보드에 없다.
    expect(page).not.toContain('한마당 현수막 디자인 확정')
    expect(page).not.toContain('남의 상시 업무')
    // 개발용 응답의 카드가 아니라는 증거.
    expect(page).not.toContain('게시판 공지물 정리')
  })

  // **완성된 글과 색을 서버가 준다.** 화면이 상태를 말로 옮기지 않는다.
  it('담당자 없음과 지연을 서버가 말로 만들어 준다', async () => {
    await loadSources([
      { key: 'task.board', params: { scope: 'all', status: 'planned' } },
      { key: 'task.board', params: { scope: 'all', status: 'inProgress' } },
    ])
    const planned = readListSource('task.board', { scope: 'all', status: 'planned' })
    expect(planned[0]).toMatchObject({
      title: '동아리방 물품 정기 점검',
      department: '운영부',
      departmentTone: 'teal',
      assignee: '담당자 없음 · 배정 필요',
      cycle: '매월',
      dueDate: '2026-08-01',
      // 먼저 봐야 하는 카드는 부서 색이 아니라 경고 색을 두른다.
      tone: 'red',
    })

    const late = readListSource('task.board', { scope: 'all', status: 'inProgress' })[0]!
    expect(late.alert).toBe('지연')
    expect(late.alertTone).toBe('red')
  })

  // **보는 범위와 무관하게 보드 전체를 센다.** 화면이 세면 '내 업무'로 좁힌 순간
  // 건수가 함께 줄고, 그러면 '지연 1건'이 사람마다 다른 수가 된다.
  it('보드 위의 건수가 저장소에서 온다', async () => {
    await loadSources([{ key: 'task.alerts', params: {} }])
    expect(readObjectSource('task.alerts')).toEqual({
      delayedCount: 1,
      reviewCount: 1,
      mineCount: 1,
      unassignedCount: 1,
    })
  })
})

describe('행사 업무 보드가 저장소에서 온다(EVT-TASK-01)', () => {
  it('그 행사의 업무만 그린다', async () => {
    draw('EVT-TASK-01', { eventId: 'E-01' })
    await waitFor(() =>
      expect(screen.getByText('한마당 현수막 디자인 확정')).toBeInTheDocument(),
    )
    const page = drawn()
    // 상시 업무도 남의 학생회 업무도 이 보드에 없다.
    expect(page).not.toContain('동아리방 물품 정기 점검')
    expect(page).not.toContain('남의 상시 업무')
    // 화면의 제목은 그 행사의 이름이고, 그 이름도 저장소에서 온다.
    expect(page).toContain('2026 소프트웨어융합대학 가을 한마당')
  })

  it('카드가 업무를 가리키는 값과 문서 표시를 든다', async () => {
    const params = { eventId: 'E-01', scope: 'all', status: 'inProgress' }
    await loadSources([{ key: 'event.taskBoard', params }])
    expect(readListSource('event.taskBoard', params)[0]).toMatchObject({
      id: 'ET-01',
      // 늦은 기한에는 그 사실이 붙어서 온다 — 이 카드는 따로 붙일 자리가 없다.
      dueDate: '2026-07-18 · 지연',
      hasDocuments: true,
    })
  })

  it('이 행사의 보드 전체를 센다', async () => {
    const params = { eventId: 'E-01' }
    await loadSources([{ key: 'event.taskAlerts', params }])
    expect(readObjectSource('event.taskAlerts', params)).toEqual({
      delayedCount: 1,
      reviewCount: 0,
      mineCount: 1,
      unassignedCount: 0,
    })
  })
})

describe('업무 상세가 저장소에서 온다(EVT-TASK-02)', () => {
  it('한 업무의 값을 완성된 글로 그린다', async () => {
    draw('EVT-TASK-02', { taskId: 'ET-01' })
    await waitFor(() =>
      expect(screen.getByText('한마당 현수막 디자인 확정')).toBeInTheDocument(),
    )
    const page = drawn()
    expect(page).toContain('T-11')
    // 늦었으면 그 사실까지 붙어서 온다.
    expect(page).toContain('2026-07-18 · 지연')
    // 개발용 응답의 업무가 아니라는 증거.
    expect(page).not.toContain('현수막 디자인 수정 반영')
  })

  it('검토 현황이 제출 여부에서 나온다', async () => {
    const params = { taskId: 'ET-01' }
    await loadSources([{ key: 'task.reviewStatus', params }])
    expect(readObjectSource('task.reviewStatus', params)).toEqual({
      submission: '제출 완료',
      submissionTone: 'blue',
      officialResult: '미확정',
      officialResultTone: 'gray',
      reviewComment: '메인 색상이 가이드라인과 다릅니다.',
      nextStepNote: '수정 후 재제출이 필요합니다.',
    })
  })

  it('이어진 항목이 저장소에서 온다', async () => {
    const params = { taskId: 'ET-01' }
    await loadSources([{ key: 'task.detail', params }])
    expect(readObjectSource('task.detail', params).linkedItems).toEqual([
      { label: '한마당 현수막 제작 사양서' },
    ])
  })
})

describe('내 업무가 저장소에서 온다(MY-01)', () => {
  it('처음 열면 해야 할 업무 갈피를 그린다', async () => {
    draw('MY-01')
    await waitFor(() =>
      expect(screen.getByText('한마당 참가자 명단 확정')).toBeInTheDocument(),
    )
    const page = drawn()
    // 남의 담당 업무도 남의 학생회 업무도 없다.
    expect(page).not.toContain('학생 건의함 확인과 답변')
    expect(page).not.toContain('남의 상시 업무')
    // 맥락은 그 업무가 속한 행사의 이름이다.
    expect(page).toContain('2026 소프트웨어융합대학 가을 한마당')
  })

  // **검토 중인 업무는 아직 안 끝났으므로 진행 중 갈피에 든다.** 묶는 규칙은
  // 서버가 갖는다 — 표에는 열 넷이 있고 갈피는 셋이다.
  it('검토 중인 업무가 진행 중 갈피에 든다', async () => {
    const params = { tab: 'inProgress', query: '' }
    await loadSources([{ key: 'my.tasks', params }])
    expect(readListSource('my.tasks', params).map((row) => row.title)).toEqual([
      '주간 운영회의 자료 준비',
    ])
  })

  it('갈피의 건수와 상태별 건수가 저장소에서 온다', async () => {
    await loadSources([
      { key: 'my.taskTabCounts', params: {} },
      { key: 'my.taskAlerts', params: {} },
    ])
    expect(readObjectSource('my.taskTabCounts')).toEqual({
      todo: 1,
      inProgress: 1,
      done: 0,
    })
    expect(readObjectSource('my.taskAlerts')).toEqual({
      delayedCount: 0,
      todoCount: 1,
      reviewCount: 1,
      // **갈피 '진행 중'의 수와 같다.** 검토 중인 업무는 아직 안 끝났으므로 진행 중에
      // 든다(labels.ts의 갈피 표). 홈의 '내 담당 업무' 카드가 이 글을 그대로 그린다.
      myWorkNote: '진행 중·검토 필요 1건',
    })
  })
})
