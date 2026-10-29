// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { TaskSummary } from '@vada/contracts'
import { councilView, teamResponse } from '@/test-support/council-fixtures'
import { COUNCIL_ID } from '@/test-support/workspace-at'
import { EVENT_ID } from '@/test-support/event-fixtures'
import { json, mockApi } from '@/test-support/mock-api'
import { narrowedTasksResponse } from '@/test-support/task-list-fake'
import { withTaskTab } from '@/lib/task-layout'
import { taskDetail } from '@/test-support/task-detail-fixtures'
import TasksPage from './TasksPage'

const DEPARTMENT = '0199d1a0-0000-7000-8000-0000000000d1'
const PERSON = '0199d1a0-0000-7000-8000-000000000001'

afterEach(() => {
  cleanup()
  window.history.replaceState(null, '', '/')
  window.localStorage.clear()
  vi.unstubAllGlobals()
})

function setup(
  eventId?: string,
  tasks: TaskSummary[] = [],
  truncated = false,
  options: Parameters<typeof councilView>[1] = {},
) {
  const api = mockApi()
  const base = `/api/organizations/${COUNCIL_ID}`
  // 보기(내 업무·담당자 없음)와 칩은 서버가 상한 전에 거른다. 서버처럼 적용해 답한다(행사는 가리지 않는다).
  const me = councilView(COUNCIL_ID, options).me
  const heads = me.departments.filter(dept => dept.rank !== null).map(dept => dept.id)
  api.onPrefix(
    'GET',
    `${base}/tasks?`,
    narrowedTasksResponse(() => tasks, { memberId: me.memberId, heads }, truncated),
  )
  api.on('GET', `${base}/members`, () => {
    const team = teamResponse()
    return json({
      ...team,
      departments: team.departments.map((dept, index) => ({
        ...dept,
        id: index === 0 ? DEPARTMENT : '0199d1a0-0000-7000-8000-0000000000d2',
      })),
      members: [...team.members, { ...team.members[0], id: PERSON, name: '김운영' }],
    })
  })
  render(
    <TasksPage
      view={councilView(COUNCIL_ID, options)}
      eventId={eventId}
      onForbidden={() => {}}
      onChanged={() => {}}
    />,
  )
  return api
}

test('학생회 업무가 기본이고 행사 없는 업무를 서버에서 읽으며 내 업무 탭은 모든 내 업무다', async () => {
  window.history.replaceState(null, '', `/tasks/${COUNCIL_ID}`)
  const api = setup()
  const menuTabs = screen.getByRole('tablist', { name: '업무 보기' })
  expect(
    within(menuTabs)
      .getAllByRole('tab')
      .map(tab => tab.textContent),
  ).toEqual(['학생회 업무', '내 업무'])
  expect(screen.getByRole('tab', { name: '학생회 업무' }).getAttribute('aria-selected')).toBe(
    'true',
  )
  await waitFor(() =>
    expect(api.calls.some(call => call.path.endsWith('view=all&status=open&event=none'))).toBe(
      true,
    ),
  )
  fireEvent.click(screen.getByRole('button', { name: '행사 업무 포함' }))
  await waitFor(() => expect(window.location.search).toBe('?events=include'))
  fireEvent.click(screen.getByRole('tab', { name: '내 업무' }))
  await waitFor(() => expect(window.location.search).toBe('?tab=mine'))
  expect(api.calls.some(call => call.path.endsWith('view=mine&status=open'))).toBe(true)
  expect(withTaskTab('m1', {})).toEqual({ tab: 'mine' })
})

test('행사 업무에는 메뉴 탭과 행사 포함 칩 없이 전체 업무/내 업무 토글과 담당자 없음 칩이 있다', async () => {
  window.history.replaceState(null, '', `/events/${COUNCIL_ID}/${EVENT_ID}?tab=tasks`)
  const api = setup(EVENT_ID)
  expect(screen.queryByRole('tablist', { name: '업무 보기' })).toBeNull()
  expect(screen.queryByRole('button', { name: '행사 업무 포함' })).toBeNull()
  expect(await screen.findByRole('button', { name: '담당자 없음 0' })).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: '담당자 없음 0' }))
  await waitFor(() => expect(window.location.search).toBe('?tab=tasks&assignee=none'))
  fireEvent.click(screen.getByRole('button', { name: '내 업무' }))
  await waitFor(() => expect(window.location.search).toBe('?tab=tasks&view=mine&assignee=none'))
  expect(api.calls.some(call => call.path.endsWith(`view=all&status=open&event=${EVENT_ID}`))).toBe(
    true,
  )
  expect(api.calls.some(call => call.path.includes('event=none'))).toBe(false)
})

test('행사 개요의 옛 담당자 없음 주소도 칩이 켜져 있고 눌러 해제한다', async () => {
  window.history.replaceState(
    null,
    '',
    `/events/${COUNCIL_ID}/${EVENT_ID}?tab=tasks&view=unassigned`,
  )
  setup(EVENT_ID)
  const chip = await screen.findByRole('button', { name: '담당자 없음 0' })
  expect(chip.getAttribute('aria-pressed')).toBe('true')
  fireEvent.click(chip)
  await waitFor(() => expect(window.location.search).toBe('?tab=tasks'))
  expect(chip.getAttribute('aria-pressed')).toBe('false')
})

test('칩 수는 거르기 전 목록에서 세고 누르는 칩은 하나만 켜지며 필터를 함께 해제한다', async () => {
  window.history.replaceState(null, '', `/tasks/${COUNCIL_ID}`)
  const api = setup(undefined, [
    taskDetail({ id: 'a', title: '지난 업무', overdue: true, assignee: null }),
    taskDetail({ id: 'b', title: '담당자 없는 업무', assignee: null, dueDate: null }),
    taskDetail({
      id: 'c',
      title: '내 카드',
      assignee: { id: 'm1', name: '김회장', current: true },
      department: { id: DEPARTMENT, name: '재정부' },
    }),
  ])
  const chip = await screen.findByRole('button', { name: '담당자 없음 2' })
  await screen.findByRole('button', { name: '재정부' })
  const row = screen.getByRole('group', { name: '업무 범위' })
  expect(row.textContent).toMatch(
    /^지남 1내 담당 1담당자 없음 2마감 없음 1재정부기획부부서 없음행사 업무 포함담당자 전체.*전체 업무내 업무$/,
  )
  expect(within(row).queryByRole('button', { name: '내 담당 1' })).toBeNull()
  fireEvent.click(chip)
  await waitFor(() => expect(window.location.search).toBe('?assignee=none'))
  expect(screen.queryByRole('button', { name: '내 카드' })).toBeNull()
  expect(screen.getByText('담당자 없음만 보고 있어요')).toBeTruthy()
  expect(screen.getByRole('button', { name: '지난 업무' })).toBeTruthy()
  expect(screen.getByRole('button', { name: '담당자 없는 업무' })).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: '지남 1' }))
  await waitFor(() => expect(window.location.search).toBe('?due=overdue'))
  expect(chip.getAttribute('aria-pressed')).toBe('false')
  expect(screen.queryByRole('button', { name: '담당자 없는 업무' })).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: '필터 해제' }))
  await waitFor(() => expect(window.location.search).toBe(''))
  fireEvent.click(screen.getByRole('button', { name: '재정부' }))
  fireEvent.click(screen.getByRole('button', { name: '내 업무' }))
  await waitFor(() => expect(window.location.search).toContain('only=mine'))
  expect(window.location.search).toContain(`dept=${DEPARTMENT}`)
  expect(screen.getByRole('button', { name: '내 카드' })).toBeTruthy()
  expect(screen.queryByRole('button', { name: '지난 업무' })).toBeNull()
  expect(screen.getByRole('button', { name: '담당자 없음 2' })).toBeTruthy()
  // 보이는 목록은 상한 전에 서버가 거르고, 칩 수는 따로 읽은 전체 열린 목록에서 센다.
  expect(api.calls.some(call => call.path.includes('view=unassigned'))).toBe(true)
  expect(api.calls.some(call => call.path.includes('view=mine'))).toBe(true)
  fireEvent.click(screen.getByRole('button', { name: '필터 해제' }))
  expect(screen.getByRole('button', { name: '전체 업무' }).getAttribute('aria-pressed')).toBe(
    'true',
  )
})

test('0인 마감 칩은 숨기고 잘린 목록의 수에 +를 붙이며 담당자 선택은 주소에 남는다', async () => {
  window.history.replaceState(null, '', `/tasks/${COUNCIL_ID}?assignee=none`)
  setup(
    undefined,
    [taskDetail({ title: '김운영 업무', assignee: { id: PERSON, name: '김운영', current: true } })],
    true,
  )
  expect(await screen.findByRole('button', { name: '담당자 없음 0+' })).toBeTruthy()
  expect(screen.queryByRole('button', { name: /^지남 / })).toBeNull()
  expect(screen.queryByRole('button', { name: /^마감 없음 / })).toBeNull()
  await screen.findByRole('option', { name: '김운영' })
  fireEvent.change(await screen.findByRole('combobox', { name: '담당자별' }), {
    target: { value: PERSON },
  })
  await waitFor(() => expect(window.location.search).toBe(`?assignee=${PERSON}`))
  expect(screen.getByRole('button', { name: '김운영 업무' })).toBeTruthy()
  expect(screen.getByRole('button', { name: '담당자 없음 0+' }).getAttribute('aria-pressed')).toBe(
    'false',
  )
})

test('행사 주소로 다시 열어도 칩이 켜지고 담당 부서만 보이며 잘린 수를 유지한다', async () => {
  const tasks = [
    taskDetail({
      id: 'event-overdue',
      title: '지난 행사 업무',
      overdue: true,
      department: { id: DEPARTMENT, name: '재정부' },
    }),
    taskDetail({
      id: 'event-no-due',
      title: '마감 없는 행사 업무',
      dueDate: null,
      department: null,
      assignee: null,
    }),
  ]
  window.history.replaceState(null, '', `/events/${COUNCIL_ID}/${EVENT_ID}?tab=tasks&due=overdue`)
  setup(EVENT_ID, tasks, true)
  expect(
    (await screen.findByRole('button', { name: '지남 1+' })).getAttribute('aria-pressed'),
  ).toBe('true')
  expect(screen.getByRole('button', { name: '지난 행사 업무' })).toBeTruthy()
  expect(screen.queryByRole('button', { name: '마감 없는 행사 업무' })).toBeNull()
  const row = screen.getByRole('group', { name: '업무 범위' })
  expect(await within(row).findByRole('button', { name: '재정부' })).toBeTruthy()
  expect(within(row).queryByRole('button', { name: '기획부' })).toBeNull()
  expect(within(row).queryByRole('button', { name: '부서 없음' })).toBeNull()
  expect(within(row).queryByRole('button', { name: '행사 업무 포함' })).toBeNull()
  expect(within(row).getByRole('button', { name: '마감 없음 1+' })).toBeTruthy()
  expect(within(row).getByRole('button', { name: '담당자 없음 1+' })).toBeTruthy()
})

test.each([null, 'head'] as const)(
  '부원·부서장(%s)의 기본값은 전체이며 다른 부서 업무도 보인다',
  async (rank: 'head' | null) => {
    window.history.replaceState(null, '', `/tasks/${COUNCIL_ID}`)
    setup(undefined, [taskDetail({ title: '다른 부서 업무', department: null })], false, {
      councilRank: null,
      departments: [{ id: DEPARTMENT, name: '재정부', role: null, rank }],
    })
    expect(await screen.findByRole('button', { name: '다른 부서 업무' })).toBeTruthy()
    expect(screen.getByRole('button', { name: '전체 업무' }).getAttribute('aria-pressed')).toBe(
      'true',
    )
    expect(
      (await screen.findByRole('button', { name: '재정부' })).getAttribute('aria-pressed'),
    ).toBe('false')
    expect(window.location.search).toBe('')
  },
)

test('행사의 옛 내 부서 주소는 서버가 거르고 띠로 알리며 필터 해제로 풀린다', async () => {
  window.history.replaceState(
    null,
    '',
    `/events/${COUNCIL_ID}/${EVENT_ID}?tab=tasks&view=department`,
  )
  const api = setup(EVENT_ID)
  expect(await screen.findByText('내 부서만 보고 있어요')).toBeTruthy()
  expect(
    api.calls.some(call => call.path.endsWith(`view=department&status=open&event=${EVENT_ID}`)),
  ).toBe(true)
  fireEvent.click(screen.getByRole('button', { name: '필터 해제' }))
  await waitFor(() => expect(window.location.search).toBe('?tab=tasks'))
})
