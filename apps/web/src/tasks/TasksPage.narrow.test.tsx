// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { TASK_OPEN_LIMIT, type TaskSummary } from '@vada/contracts'
import { councilView, teamResponse } from '@/test-support/council-fixtures'
import { COUNCIL_ID } from '@/test-support/workspace-at'
import { json, mockApi } from '@/test-support/mock-api'
import { taskDetail } from '@/test-support/task-detail-fixtures'
import TasksPage from './TasksPage'

const PLANNING = '0199d1a0-0000-7000-8000-0000000000d1'
const FINANCE = '0199d1a0-0000-7000-8000-0000000000d2'
const PERSON = '0199d1a0-0000-7000-8000-000000000001'
const base = `/api/organizations/${COUNCIL_ID}/tasks`

afterEach(() => {
  cleanup()
  window.history.replaceState(null, '', '/')
  window.localStorage.clear()
  vi.unstubAllGlobals()
})

// 상한까지 앞선 업무: 재정부, 지금 운영진이 맡음, 마감 없음. 거르지 않은 열린 목록은 잘려 있다.
const ahead: TaskSummary[] = Array.from({ length: TASK_OPEN_LIMIT }, (_, index) =>
  taskDetail({
    id: `ahead-${index}`,
    title: `앞선 업무 ${index}`,
    dueDate: null,
    department: { id: FINANCE, name: '재정부' },
    assignee: { id: 'm2', name: '박재정', current: true },
  }),
)
const behind = taskDetail({
  id: 'behind',
  title: '상한 뒤 기획 업무',
  overdue: true,
  department: { id: PLANNING, name: '기획부' },
  assignee: null,
})

function setup(path: string, narrowed: string) {
  window.history.replaceState(null, '', path)
  const api = mockApi()
  for (const event of ['', '&event=none'])
    api.on('GET', `${base}?view=all&status=open${event}`, () =>
      json({ tasks: ahead, truncated: true }),
    )
  api.on('GET', `${base}?view=all&status=open${narrowed}`, () =>
    json({ tasks: [behind], truncated: false }),
  )
  // 좁은 화면의 상태 탭은 끝난 업무도 같은 거르기로 읽는다.
  api.onPrefix('GET', `${base}?view=all&status=done`, () => json({ tasks: [], truncated: false }))
  api.on('GET', `${base}/options`, () => json({ departments: [], linkableEvents: [] }))
  api.on('GET', `/api/organizations/${COUNCIL_ID}/members`, () => {
    const team = teamResponse()
    return json({
      ...team,
      departments: [
        { ...team.departments[0], id: FINANCE, name: '재정부' },
        { ...team.departments[0], id: PLANNING, name: '기획부' },
      ],
      members: [...team.members, { ...team.members[0], id: PERSON, name: '김운영' }],
    })
  })
  render(
    <TasksPage
      view={councilView(COUNCIL_ID, {
        councilRank: null,
        departments: [{ id: PLANNING, name: '기획부', role: null, rank: 'head' }],
      })}
      onForbidden={() => {}}
      onChanged={() => {}}
    />,
  )
  return api
}

test.each([
  ['부서 칩', `/tasks/${COUNCIL_ID}?dept=${PLANNING}`, `&event=none&dept=${PLANNING}`],
  ['지남 칩', `/tasks/${COUNCIL_ID}?due=overdue`, '&event=none&due=overdue'],
  ['홈 확인 필요', `/tasks/${COUNCIL_ID}?attention=true&events=include`, '&attention=true'],
  [
    '홈 직급 부서·사람·7일',
    `/tasks/${COUNCIL_ID}?heads=true&assignee=${PERSON}&due=week`,
    `&event=none&due=week&assignee=${PERSON}&heads=true`,
  ],
])(
  '%s: 서버가 상한 전에 거른 목록을 보여 상한 뒤 업무가 빠지지 않는다',
  async (_name, path, narrowed) => {
    const api = setup(path, narrowed)
    expect(await screen.findByRole('button', { name: '상한 뒤 기획 업무' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: '앞선 업무 0' })).toBeNull()
    // 칩 수는 지금처럼 거르지 않은 전체 열린 목록에서 센다(잘렸으면 +).
    expect(
      await screen.findByRole('button', { name: `마감 없음 ${TASK_OPEN_LIMIT}+` }),
    ).toBeTruthy()
    expect(screen.getByRole('button', { name: '담당자 없음 0+' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: /^지남 / })).toBeNull()
    api.assertNoUnexpectedRequests()
  },
)

test('거르지 않은 목록은 칩 수와 같은 응답을 다시 쓰고 거르기 키를 싣지 않는다', async () => {
  const api = setup(`/tasks/${COUNCIL_ID}`, '&never')
  expect(await screen.findByRole('button', { name: '앞선 업무 0' })).toBeTruthy()
  expect(screen.getByRole('button', { name: `마감 없음 ${TASK_OPEN_LIMIT}+` })).toBeTruthy()
  const reads = api.calls.filter(call => call.path.startsWith(`${base}?`))
  expect(new Set(reads.map(call => call.path))).toEqual(
    new Set([`${base}?view=all&status=open&event=none`, `${base}?view=all&status=done&event=none`]),
  )
  api.assertNoUnexpectedRequests()
})

test('행사에서 담당자 없음 칩과 내 업무 토글을 함께 켜면 서버에 둘 다 보낸다', async () => {
  const EVENT = '0199d1a0-0000-7000-8000-0000000000e1'
  window.history.replaceState(
    null,
    '',
    `/events/${COUNCIL_ID}/${EVENT}?tab=tasks&view=mine&assignee=none`,
  )
  const api = mockApi()
  api.onPrefix('GET', `${base}?`, () => json({ tasks: [], truncated: false }))
  api.on('GET', `${base}/options?event=${EVENT}`, () =>
    json({ departments: [], linkableEvents: [] }),
  )
  api.on('GET', `/api/organizations/${COUNCIL_ID}/members`, () => json(teamResponse()))
  render(
    <TasksPage
      view={councilView(COUNCIL_ID)}
      eventId={EVENT}
      onForbidden={() => {}}
      onChanged={() => {}}
    />,
  )
  await waitFor(() =>
    expect(api.calls.map(call => call.path)).toContain(
      `${base}?view=mine&status=open&event=${EVENT}&assignee=none`,
    ),
  )
  api.assertNoUnexpectedRequests()
})
