// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { type CouncilView, type TaskSummary } from '@vada/contracts'
import { navigate, useHere } from '@/lib/app-location'
import { openRecord } from '@/lib/go-to'
import { windowHistoryIdle } from '@/lib/use-window-history'
import { councilView, teamResponse } from '@/test-support/council-fixtures'
import { json, mockApi } from '@/test-support/mock-api'
import { taskDetail } from '@/test-support/task-detail-fixtures'
import { departmentColorOf } from './department-color'
import { TaskCard } from './TaskCard'
import { TaskPanel } from './TaskPanel'
import { TaskRow } from './TaskRow'
import { TaskTable } from './TaskTable'

const C = '00000000-0000-4000-8000-0000000000c1'
const T = '00000000-0000-4000-8000-0000000000a1'
const ROOM = '00000000-0000-4000-8000-0000000000b1'
const direct = { councilId: C, meId: 'm1', canDirect: true }
const person = { id: 'm2', name: '이재정', current: true }
const directUrl = `/api/organizations/${C}/direct`
const chatPath = `/chat/${C}/${ROOM}`
const nameButton = () => screen.getByRole('button', { name: '이재정님과 1:1 대화' })

afterEach(async () => {
  cleanup()
  await windowHistoryIdle()
  window.history.replaceState(null, '', '/')
  vi.unstubAllGlobals()
})

function serveDirect() {
  const api = mockApi()
  api.on('POST', directUrl, () => json({ roomId: ROOM }))
  return api
}

function card(assignee: TaskSummary['assignee'] = person, canDirect = true, mine = false) {
  const onOpen = vi.fn()
  const dragStart = vi.fn(() => true)
  render(
    <ul onClick={onOpen}>
      <TaskCard
        task={taskDetail({ assignee })}
        direct={{ ...direct, canDirect }}
        variant={mine ? 'mine' : 'board'}
        color={departmentColorOf(null, [])}
        busy={false}
        onOpen={onOpen}
        drag={{ enabled: true, active: false, start: dragStart, end: () => {} }}
      />
    </ul>,
  )
  return { onOpen, dragStart }
}

test('보드 이름 클릭은 1:1만 열고 카드 열기와 끌기를 시작하지 않는다', async () => {
  const api = serveDirect()
  const { onOpen, dragStart } = card()
  expect(fireEvent.dragStart(nameButton())).toBe(false)
  expect(dragStart).not.toHaveBeenCalled()
  fireEvent.click(nameButton())
  await waitFor(() => expect(location.pathname).toBe(chatPath))
  expect(api.calls.filter(call => call.method === 'POST')).toEqual([
    expect.objectContaining({ path: directUrl, body: { memberId: person.id } }),
  ])
  expect(onOpen).not.toHaveBeenCalled()
})

test.each([
  ['본인', { ...person, id: direct.meId }, true],
  ['떠난 사람', { ...person, current: false }, true],
  ['미배정', null, true],
  ['1:1 권한 없음', person, false],
] as const)('%s 카드의 담당자는 1:1 단추가 아니다', (_, assignee, canDirect) => {
  card(assignee, canDirect)
  expect(screen.queryByRole('button', { name: /님과 1:1 대화/ })).toBeNull()
  expect(screen.getByRole('button', { name: '현수막 주문' })).toBeTruthy()
})

test('내 업무 카드는 본인을 1:1 단추로 보이지 않는다', () => {
  card({ ...person, id: direct.meId }, true, true)
  expect(screen.queryByRole('button', { name: /님과 1:1 대화/ })).toBeNull()
})

test('줄 목록의 이름도 1:1을 열고 업무 열기는 부르지 않는다', async () => {
  serveDirect()
  const onOpen = vi.fn()
  render(
    <ul>
      <TaskRow
        task={taskDetail()}
        direct={direct}
        busy={false}
        show={{ assignee: true, department: true, event: true }}
        onOpen={onOpen}
      />
    </ul>,
  )
  fireEvent.click(nameButton())
  await waitFor(() => expect(location.pathname).toBe(chatPath))
  expect(onOpen).not.toHaveBeenCalled()
})

test('1:1 문맥을 받지 않는 홈의 줄은 담당자 글과 업무 열기를 유지한다', () => {
  render(
    <ul>
      <TaskRow
        task={taskDetail()}
        busy={false}
        show={{ assignee: true, department: true, event: true }}
        onOpen={() => {}}
      />
    </ul>,
  )
  expect(screen.getByText(person.name)).toBeTruthy()
  expect(screen.queryByRole('button', { name: /님과 1:1 대화/ })).toBeNull()
})

function table(editable = true, canDirect = true) {
  const save = vi.fn(() => Promise.resolve(true))
  render(
    <TaskTable
      direct={{ ...direct, canDirect }}
      sections={[
        {
          key: 'all',
          title: '업무',
          tasks: [taskDetail({ actions: editable ? ['task.change_assignee'] : [] })],
        },
      ]}
      summary={false}
      inEvent={false}
      lookups={{ team: teamResponse(), events: [], linkable: [] }}
      cells={{
        busy: new Set(),
        errors: {},
        patches: {},
        save,
        fail: () => {},
        clearPatches: () => {},
      }}
      onOpenTask={() => {}}
    />,
  )
  return save
}

test.each([true, false])('표의 편집 권한 %s와 별개로 이름은 1:1을 연다', async editable => {
  serveDirect()
  table(editable)
  expect(nameButton().tabIndex).toBe(-1)
  if (editable) {
    const select = screen.getByRole('combobox', { name: '현수막 주문 담당자' })
    const cell = select.closest('td')!
    for (const key of ['Enter', 'F2']) {
      cell.focus()
      fireEvent.keyDown(cell, { key })
      expect(document.activeElement).toBe(select)
    }
  }
  fireEvent.click(nameButton())
  await waitFor(() => expect(location.pathname).toBe(chatPath))
})

test('1:1 권한이 없어도 표의 업무 읽기와 담당자 고르기는 유지된다', () => {
  const save = table(true, false)
  expect(screen.queryByRole('button', { name: /님과 1:1 대화/ })).toBeNull()
  expect(screen.getByText('현수막 주문')).toBeTruthy()
  fireEvent.change(screen.getByRole('combobox', { name: '현수막 주문 담당자' }), {
    target: { value: 'm3' },
  })
  expect(save).toHaveBeenCalledWith(expect.anything(), 'assignee', 'm3')
})

function PanelRoute({ view }: { view: CouncilView }) {
  const here = useHere()
  if (here.location?.type !== 'record' || here.location.record !== 'tasks') return null
  return (
    <TaskPanel
      view={view}
      taskId={here.location.recordId}
      onClose={() => {}}
      onChanged={() => {}}
      onLost={() => {}}
      onForbidden={() => {}}
    />
  )
}

test('패널 이름은 고르기를 열지 않고 주소 한 칸을 쌓으며 뒤로 가면 같은 업무 패널이다', async () => {
  const api = serveDirect()
  api.on('GET', `/api/organizations/${C}/tasks/${T}`, () => json({ task: taskDetail({ id: T }) }))
  api.on('GET', `/api/organizations/${C}/members`, () => json(teamResponse()))
  navigate(`/tasks/${C}`)
  openRecord('tasks', C, T)
  render(<PanelRoute view={councilView(C)} />)
  await screen.findByRole('button', { name: '이재정님과 1:1 대화' })
  await windowHistoryIdle()
  const depth = history.length
  expect(nameButton().closest('button button')).toBeNull()
  fireEvent.click(nameButton())
  await waitFor(() => expect(location.pathname).toBe(chatPath))
  expect(history.length).toBe(depth + 1)
  expect(screen.queryByRole('combobox', { name: '이름으로 찾기' })).toBeNull()
  await act(async () => {
    history.back()
  })
  await waitFor(() => expect(location.pathname).toBe(`/tasks/${C}/${T}`))
  await screen.findByRole('dialog', { name: '현수막 주문' })
  fireEvent.click(await screen.findByRole('button', { name: '담당자 이재정' }))
  expect(await screen.findByRole('combobox', { name: '이름으로 찾기' })).toBeTruthy()
})

test.each([
  ['본인', { ...person, id: direct.meId }, true],
  ['떠난 사람', { ...person, current: false }, true],
  ['미배정', null, true],
  ['1:1 권한 없음', person, false],
] as const)(
  '%s 패널은 1:1 단추 없이 업무 읽기와 담당자 고르기를 유지한다',
  async (_, assignee, canDirect) => {
    const api = mockApi()
    api.on('GET', `/api/organizations/${C}/tasks/${T}`, () =>
      json({ task: taskDetail({ id: T, assignee }) }),
    )
    api.on('GET', `/api/organizations/${C}/members`, () => json(teamResponse()))
    render(
      <TaskPanel
        view={councilView(C, { permissions: canDirect ? ['chat.direct'] : [] })}
        taskId={T}
        onClose={() => {}}
        onChanged={() => {}}
        onLost={() => {}}
        onForbidden={() => {}}
      />,
    )
    expect(await screen.findByText('크기는 3m로 해 주세요.')).toBeTruthy()
    expect(screen.queryByRole('button', { name: /님과 1:1 대화/ })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /^담당자 / }))
    expect(await screen.findByRole('combobox', { name: '이름으로 찾기' })).toBeTruthy()
  },
)

test('업무를 고칠 수 없어도 1:1 권한이 있으면 패널의 담당자와 대화할 수 있다', async () => {
  const api = serveDirect()
  api.on('GET', `/api/organizations/${C}/tasks/${T}`, () =>
    json({ task: taskDetail({ id: T, actions: [] }) }),
  )
  render(
    <TaskPanel
      view={councilView(C)}
      taskId={T}
      onClose={() => {}}
      onChanged={() => {}}
      onLost={() => {}}
      onForbidden={() => {}}
    />,
  )
  expect(await screen.findByRole('button', { name: '이재정님과 1:1 대화' })).toBeTruthy()
  expect(screen.queryByRole('button', { name: /^담당자 / })).toBeNull()
  expect(api.calls.some(call => call.path.endsWith('/members'))).toBe(false)
})
