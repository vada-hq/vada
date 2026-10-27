// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { TaskDetail } from '@vada/contracts'
import { councilView, teamResponse } from '@/test-support/council-fixtures'
import { json, mockApi } from '@/test-support/mock-api'
import { taskDetail } from '@/test-support/task-detail-fixtures'
import { TaskPanel } from './TaskPanel'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const URL_TASK = '/api/organizations/c1/tasks/t1'

function setup(task: TaskDetail = taskDetail()) {
  const api = mockApi()
  api.on('GET', URL_TASK, () => json({ task }))
  api.on('GET', '/api/organizations/c1/members', () => json(teamResponse()))
  const handlers = { onClose: vi.fn(), onChanged: vi.fn(), onLost: vi.fn(), onForbidden: vi.fn() }
  render(<TaskPanel view={councilView('c1')} taskId="t1" {...handlers} />)
  return { api, handlers }
}

const posts = (api: ReturnType<typeof mockApi>) =>
  api.calls.filter(call => call.method === 'POST').map(({ path, body }) => ({ path, body }))

test('담당자 칸을 누르고 사람을 고르면 저장 버튼 없이 맡기기 API로 바로 보내고 되돌리기 띠를 단다', async () => {
  const { api, handlers } = setup()
  api.on('POST', `${URL_TASK}/assignee`, () =>
    json({ task: taskDetail({ assignee: { id: 'm3', name: '박새내', current: true } }) }),
  )
  fireEvent.click(await screen.findByRole('button', { name: '담당자 이재정' }))
  fireEvent.click(await screen.findByRole('option', { name: /박새내/ }))
  await waitFor(() =>
    expect(posts(api)).toEqual([{ path: `${URL_TASK}/assignee`, body: { assigneeId: 'm3' } }]),
  )
  expect(await screen.findByText('담당자 변경: 박새내')).toBeTruthy()
  expect(screen.queryByRole('button', { name: '저장' })).toBeNull()
  expect(handlers.onChanged).toHaveBeenCalled()
  api.assertNoUnexpectedRequests()
})

test('담당자 찾기 칸에 이름을 치면 목록이 좁혀지고 Enter로 고른다', async () => {
  const { api } = setup()
  api.on('POST', `${URL_TASK}/assignee`, () => json({ task: taskDetail() }))
  fireEvent.click(await screen.findByRole('button', { name: '담당자 이재정' }))
  const search = await screen.findByRole('combobox', { name: '이름으로 찾기' })
  fireEvent.change(search, { target: { value: '김' } })
  expect(screen.getAllByRole('option').map(option => option.textContent)).toEqual(['김회장'])
  fireEvent.keyDown(search, { key: 'Enter' })
  await waitFor(() => expect(posts(api)[0]?.body).toEqual({ assigneeId: 'm1' }))
})

test('마감 칸에서 [마감 없음]을 고르면 고치기 API에 마감 칸 하나만 보낸다', async () => {
  const { api } = setup()
  api.on('POST', URL_TASK, () => json({ task: taskDetail({ dueDate: null }) }))
  fireEvent.click(await screen.findByRole('button', { name: /^마감 10월 25일/ }))
  fireEvent.click(await screen.findByRole('button', { name: '마감 없음' }))
  await waitFor(() => expect(posts(api)).toEqual([{ path: URL_TASK, body: { dueDate: null } }]))
})

test('달력에서 날을 누르면 그 날로 보낸다', async () => {
  const { api } = setup()
  api.on('POST', URL_TASK, () => json({ task: taskDetail({ dueDate: '2026-10-29' }) }))
  fireEvent.click(await screen.findByRole('button', { name: /^마감 10월 25일/ }))
  fireEvent.click(await screen.findByRole('button', { name: '10월 29일 (목)' }))
  await waitFor(() => expect(posts(api)[0]?.body).toEqual({ dueDate: '2026-10-29' }))
})

test('상태 단추를 누르면 상태 API로 바로 보낸다', async () => {
  const { api } = setup()
  api.on('POST', `${URL_TASK}/status`, () => json({ task: taskDetail({ status: 'done' }) }))
  fireEvent.click(await screen.findByRole('button', { name: '끝남' }))
  await waitFor(() =>
    expect(posts(api)).toEqual([{ path: `${URL_TASK}/status`, body: { status: 'done' } }]),
  )
})

test('제목을 누르면 그 자리에서 고치고 Enter로 제목 하나만 보낸다', async () => {
  const { api } = setup()
  api.on('POST', URL_TASK, () => json({ task: taskDetail({ title: '현수막 두 장 주문' }) }))
  fireEvent.click(await screen.findByRole('button', { name: '현수막 주문' }))
  const box = screen.getByRole('textbox', { name: '제목' })
  fireEvent.change(box, { target: { value: '현수막 두 장 주문' } })
  fireEvent.keyDown(box, { key: 'Enter' })
  await waitFor(() =>
    expect(posts(api)).toEqual([{ path: URL_TASK, body: { title: '현수막 두 장 주문' } }]),
  )
  expect(await screen.findByRole('button', { name: '현수막 두 장 주문' })).toBeTruthy()
})

test('제목을 비우면 보내지 않고 칸 아래에 알린다', async () => {
  const { api } = setup()
  fireEvent.click(await screen.findByRole('button', { name: '현수막 주문' }))
  const box = screen.getByRole('textbox', { name: '제목' })
  fireEvent.change(box, { target: { value: '   ' } })
  fireEvent.keyDown(box, { key: 'Enter' })
  expect(await screen.findByText('제목을 입력해 주세요')).toBeTruthy()
  expect(posts(api)).toEqual([])
})

test('고치는 칸의 Esc는 고치기만 거두고 패널은 닫지 않는다. 그다음 Esc는 패널을 닫는다', async () => {
  const { api, handlers } = setup()
  fireEvent.click(await screen.findByRole('button', { name: '현수막 주문' }))
  const box = screen.getByRole('textbox', { name: '제목' })
  fireEvent.change(box, { target: { value: '바뀐 제목' } })
  fireEvent.keyDown(box, { key: 'Escape' })
  expect(screen.queryByRole('textbox', { name: '제목' })).toBeNull()
  expect(handlers.onClose).not.toHaveBeenCalled()
  fireEvent.keyDown(screen.getByRole('button', { name: '현수막 주문' }), { key: 'Escape' })
  await waitFor(() => expect(handlers.onClose).toHaveBeenCalled())
  expect(posts(api)).toEqual([])
})

test('고르기 창의 Esc는 창만 닫고 패널은 남는다', async () => {
  const { handlers } = setup()
  fireEvent.click(await screen.findByRole('button', { name: '담당자 이재정' }))
  const search = await screen.findByRole('combobox', { name: '이름으로 찾기' })
  fireEvent.keyDown(search, { key: 'Escape' })
  await waitFor(() => expect(screen.queryByRole('combobox', { name: '이름으로 찾기' })).toBeNull())
  expect(handlers.onClose).not.toHaveBeenCalled()
})

test('바꾸는 동작이 없으면 값은 글자뿐이고 고치는 단추도 지우기도 없다', async () => {
  const { api } = setup(
    taskDetail({
      actions: [],
      results: [{ kind: 'request', id: 'r1', title: '현수막 구매', stage: 'in_progress' }],
    }),
  )
  const panel = await screen.findByRole('dialog', { name: '현수막 주문' })
  await within(panel).findByText('이재정')
  expect(within(panel).queryByRole('button', { name: '담당자 이재정' })).toBeNull()
  expect(within(panel).queryByRole('button', { name: '현수막 주문' })).toBeNull()
  expect(within(panel).queryByRole('group', { name: '상태' })).toBeNull()
  expect(within(panel).queryByRole('button', { name: '만들기' })).toBeNull()
  expect(within(panel).getByText('현수막 구매')).toBeTruthy()
  fireEvent.keyDown(within(panel).getByRole('button', { name: '더 보기' }), { key: 'Enter' })
  const items = await screen.findAllByRole('menuitem')
  expect(items.map(item => item.textContent)).toEqual(['링크 복사', '이력 보기'])
  // 바꿀 수 없으면 사람 목록도 읽지 않는다.
  expect(api.calls.some(call => call.path.endsWith('/members'))).toBe(false)
})

test('결과물 [만들기] 메뉴는 만들면 업무 상태가 어떻게 바뀌는지 함께 보인다', async () => {
  setup(taskDetail({ canMake: ['request', 'message'] }))
  expect(await screen.findByText('만들면 업무 상태가 저절로 바뀌어요')).toBeTruthy()
  fireEvent.keyDown(screen.getByRole('button', { name: '만들기' }), { key: 'Enter' })
  const items = await screen.findAllByRole('menuitem')
  expect(items.map(item => item.textContent)).toEqual([
    '구매 요청내면 진행 중, 모두 결제되면 끝남',
    '공지공지방에 올리면 끝남',
  ])
})
