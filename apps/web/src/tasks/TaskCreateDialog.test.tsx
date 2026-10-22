// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { CouncilView, EventSummary } from '@vada/contracts'
import { councilView, MEMBER_PERMISSIONS, teamResponse } from '@/test-support/council-fixtures'
import { eventSummary } from '@/test-support/event-fixtures'
import { deferredResponse, json, mockApi } from '@/test-support/mock-api'
import { taskDetail } from '@/test-support/task-detail-fixtures'
import { EVENTS_LOAD_FAILED, TASK_ERRORS } from '@/lib/messages'
import { TaskCreateDialog } from './TaskCreateDialog'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const CREATE = '/api/organizations/c1/tasks'

// 계약은 번호가 uuid이길 요구하므로 시험용 번호를 uuid로 바꾼다.
const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const D1 = uuid(11)
const M2 = uuid(2)
const swap: Record<string, string> = { d1: D1, d2: uuid(12), m1: uuid(1), m2: M2, m3: uuid(3) }
const uuidTeam = () => {
  const team = teamResponse()
  return {
    members: team.members.map(item => ({
      ...item,
      id: swap[item.id] ?? item.id,
      departments: item.departments.map(d => ({ ...d, id: swap[d.id] ?? d.id })),
    })),
    departments: team.departments.map(item => ({ ...item, id: swap[item.id] ?? item.id })),
  }
}

// 재정부 부장 이재정(m2)이 본 학생회: 권한 목록에 부서를 정하는 칸이 없다.
function headView(): CouncilView {
  const view = councilView('c1', { councilRank: null, permissions: MEMBER_PERMISSIONS })
  return {
    ...view,
    me: {
      ...view.me,
      memberId: M2,
      departments: [{ id: D1, name: '재정부', role: 'finance', rank: 'head' }],
    },
  }
}

const EVENT_ID = uuid(21)
// 이재정(M2)이 책임자인 행사와 책임자가 없는 행사
const events: EventSummary[] = [
  eventSummary({ id: EVENT_ID, name: '환영회', owner: { id: M2, name: '이재정', current: true } }),
  eventSummary({ id: uuid(22), name: '체육대회', owner: null }),
]

function setup(view: CouncilView = councilView('c1'), eventId?: string) {
  const api = mockApi()
  api.on('GET', '/api/organizations/c1/members', () => json(uuidTeam()))
  api.on('GET', '/api/organizations/c1/events', () => json({ events, truncated: false }))
  const handlers = { onClose: vi.fn(), onCreated: vi.fn(), onLost: vi.fn(), onForbidden: vi.fn() }
  render(<TaskCreateDialog view={view} open eventId={eventId} {...handlers} />)
  return { api, handlers }
}

const optionsOf = (name: string) =>
  within(screen.getByRole('combobox', { name }))
    .getAllByRole('option')
    .map(item => item.textContent)

test('닫혀 있으면 아무것도 읽지 않는다', () => {
  const api = mockApi()
  render(
    <TaskCreateDialog
      view={councilView('c1')}
      open={false}
      onClose={vi.fn()}
      onCreated={vi.fn()}
      onLost={vi.fn()}
      onForbidden={vi.fn()}
    />,
  )
  expect(screen.queryByRole('dialog')).toBeNull()
  expect(api.calls).toEqual([])
})

test('회장단은 모든 부서와 학생회 업무, 모든 운영진과 담당자 없음을 고르고 마감은 비어 있다', async () => {
  setup()
  await screen.findByRole('combobox', { name: '담당 부서' })
  expect(optionsOf('담당 부서')).toEqual(['재정부', '기획부', '학생회 업무'])
  expect(optionsOf('담당자')).toEqual(['담당자 없음', '김회장', '이재정', '박새내'])
  expect(screen.getByLabelText('마감')).toHaveProperty('value', '')
})

test('부서가 없는 운영진은 학생회 업무와 나만 고른다', async () => {
  setup(councilView('c1', { councilRank: null, memberId: 'm3' }))
  await screen.findByRole('combobox', { name: '담당 부서' })
  expect(optionsOf('담당 부서')).toEqual(['학생회 업무'])
  expect(optionsOf('담당자')).toEqual(['나'])
})

test('부장은 자기 부서를 고르면 모든 운영진을, 학생회 업무로 바꾸면 나만 고른다', async () => {
  setup(headView())
  await screen.findByRole('combobox', { name: '담당 부서' })
  expect(optionsOf('담당 부서')).toEqual(['재정부', '학생회 업무'])
  expect(optionsOf('담당자')).toEqual(['담당자 없음', '김회장', '이재정', '박새내'])
  fireEvent.change(screen.getByRole('combobox', { name: '담당 부서' }), { target: { value: '' } })
  expect(optionsOf('담당자')).toEqual(['나'])
  expect(screen.getByRole('combobox', { name: '담당자' })).toHaveProperty('value', M2)
})

test('제목이 비어 있거나 공백뿐이면 만들기가 꺼져 있다', async () => {
  setup()
  const button = await screen.findByRole('button', { name: '만들기' })
  expect(button).toHaveProperty('disabled', true)
  fireEvent.change(screen.getByLabelText('제목'), { target: { value: '   ' } })
  expect(button).toHaveProperty('disabled', true)
  fireEvent.change(screen.getByLabelText('제목'), { target: { value: '현수막' } })
  expect(button).toHaveProperty('disabled', false)
})

test('내용과 마감과 담당을 채워 만들면 계약 모양으로 보내고 두 번 눌러도 한 번만 간다', async () => {
  const { api, handlers } = setup()
  const pending = deferredResponse()
  api.on('POST', CREATE, () => pending.promise)
  await screen.findByRole('combobox', { name: '담당 부서' })
  fireEvent.change(screen.getByLabelText('제목'), { target: { value: ' 현수막 주문 ' } })
  fireEvent.change(screen.getByLabelText('내용'), { target: { value: '3m' } })
  fireEvent.change(screen.getByLabelText('마감'), { target: { value: '2026-10-25' } })
  fireEvent.change(screen.getByRole('combobox', { name: '담당 부서' }), { target: { value: D1 } })
  fireEvent.change(screen.getByRole('combobox', { name: '담당자' }), { target: { value: M2 } })
  const form = screen.getByRole('form', { name: '업무 만들기' })
  fireEvent.submit(form)
  fireEvent.submit(form)
  await waitFor(() =>
    expect(screen.getByRole('button', { name: '만들기' })).toHaveProperty('disabled', true),
  )
  pending.resolve(json({ task: taskDetail() }, 201))
  await waitFor(() => expect(handlers.onCreated).toHaveBeenCalledTimes(1))
  expect(api.calls.filter(call => call.method === 'POST')).toEqual([
    expect.objectContaining({
      body: {
        title: ' 현수막 주문 ',
        body: '3m',
        dueDate: '2026-10-25',
        departmentId: D1,
        assigneeId: M2,
        eventId: null,
      },
    }),
  ])
})

test('비운 내용과 마감과 담당자는 null로 보낸다', async () => {
  const { api, handlers } = setup()
  api.on('POST', CREATE, () => json({ task: taskDetail() }, 201))
  await screen.findByRole('combobox', { name: '담당 부서' })
  fireEvent.change(screen.getByLabelText('제목'), { target: { value: '청소' } })
  fireEvent.click(screen.getByRole('button', { name: '만들기' }))
  await waitFor(() => expect(handlers.onCreated).toHaveBeenCalled())
  expect(api.calls.at(-1)?.body).toEqual({
    title: '청소',
    body: null,
    dueDate: null,
    departmentId: null,
    assigneeId: null,
    eventId: null,
  })
})

test.each([
  [409, 'TASK_ASSIGNEE_INVALID', /지금 운영진만/],
  [409, 'TASK_DEPARTMENT_INVALID', /부서가 아니에요/],
  [429, 'TOO_MANY_REQUESTS', /너무 빨리/],
])('만들기 %i %s는 만들기 옆에 보이고 입력은 그대로다', async (status, code, message) => {
  const { api, handlers } = setup()
  api.on('POST', CREATE, () => json({ error: code }, status))
  await screen.findByRole('combobox', { name: '담당 부서' })
  fireEvent.change(screen.getByLabelText('제목'), { target: { value: '청소' } })
  fireEvent.click(screen.getByRole('button', { name: '만들기' }))
  expect((await screen.findByRole('alert')).textContent).toMatch(message)
  expect(screen.getByLabelText('제목')).toHaveProperty('value', '청소')
  expect(handlers.onLost).not.toHaveBeenCalled()
  expect(screen.getByRole('button', { name: '만들기' })).toHaveProperty('disabled', false)
})

test('만들다가 권한을 잃으면(403) 이유를 알리고 학생회를 다시 읽는다', async () => {
  const { api, handlers } = setup()
  api.on('POST', CREATE, () => json({ error: 'FORBIDDEN' }, 403))
  await screen.findByRole('combobox', { name: '담당 부서' })
  fireEvent.change(screen.getByLabelText('제목'), { target: { value: '청소' } })
  fireEvent.click(screen.getByRole('button', { name: '만들기' }))
  await waitFor(() => expect(handlers.onLost).toHaveBeenCalledTimes(1))
  expect(handlers.onForbidden).toHaveBeenCalledTimes(1)
})

test('운영진과 부서를 읽지 못하면 문구를 보이고 만들 수 없다', async () => {
  const api = mockApi()
  api.on('GET', '/api/organizations/c1/members', () => json({ error: 'X' }, 500))
  api.on('GET', '/api/organizations/c1/events', () => json({ events, truncated: false }))
  render(
    <TaskCreateDialog
      view={councilView('c1')}
      open
      onClose={vi.fn()}
      onCreated={vi.fn()}
      onLost={vi.fn()}
      onForbidden={vi.fn()}
    />,
  )
  expect((await screen.findByRole('alert')).textContent).toMatch(/불러오지 못했어요/)
  expect(screen.queryByRole('button', { name: '만들기' })).toBeNull()
})

test('행사를 읽지 못해도 문구를 보이고 만들 수 없다', async () => {
  const api = mockApi()
  api.on('GET', '/api/organizations/c1/members', () => json(uuidTeam()))
  api.on('GET', '/api/organizations/c1/events', () => json({ error: 'X' }, 500))
  render(
    <TaskCreateDialog
      view={councilView('c1')}
      open
      onClose={vi.fn()}
      onCreated={vi.fn()}
      onLost={vi.fn()}
      onForbidden={vi.fn()}
    />,
  )
  expect((await screen.findByRole('alert')).textContent).toBe(EVENTS_LOAD_FAILED)
  expect(screen.queryByRole('button', { name: '만들기' })).toBeNull()
})

test('행사 칸은 행사 없음으로 시작하고, 고른 행사를 요청에 담는다', async () => {
  const { api, handlers } = setup()
  api.on('POST', CREATE, () => json({ task: taskDetail() }, 201))
  await screen.findByRole('combobox', { name: '행사' })
  expect(optionsOf('행사')).toEqual(['행사 없음', '환영회', '체육대회'])
  expect(screen.getByRole('combobox', { name: '행사' })).toHaveProperty('value', '')
  fireEvent.change(screen.getByLabelText('제목'), { target: { value: '청소' } })
  fireEvent.change(screen.getByRole('combobox', { name: '행사' }), { target: { value: EVENT_ID } })
  fireEvent.click(screen.getByRole('button', { name: '만들기' }))
  await waitFor(() => expect(handlers.onCreated).toHaveBeenCalled())
  expect(api.calls.at(-1)?.body).toMatchObject({ eventId: EVENT_ID })
})

test('행사의 업무 탭에서 열면 그 행사가 골라져 있다', async () => {
  setup(councilView('c1'), EVENT_ID)
  const select = await screen.findByRole('combobox', { name: '행사' })
  expect(select).toHaveProperty('value', EVENT_ID)
})

test('내가 책임자인 행사를 고르면 모든 부서와 운영진을 고르고, 책임자가 아닌 행사로 돌리면 다시 좁아진다', async () => {
  const view = councilView('c1', { councilRank: null, permissions: MEMBER_PERMISSIONS })
  setup({ ...view, me: { ...view.me, memberId: M2 } })
  await screen.findByRole('combobox', { name: '행사' })
  expect(optionsOf('담당 부서')).toEqual(['학생회 업무'])
  expect(optionsOf('담당자')).toEqual(['나'])
  fireEvent.change(screen.getByRole('combobox', { name: '행사' }), { target: { value: EVENT_ID } })
  expect(optionsOf('담당 부서')).toEqual(['재정부', '기획부', '학생회 업무'])
  expect(optionsOf('담당자')).toEqual(['담당자 없음', '김회장', '이재정', '박새내'])
  fireEvent.change(screen.getByRole('combobox', { name: '행사' }), { target: { value: uuid(22) } })
  expect(optionsOf('담당 부서')).toEqual(['학생회 업무'])
  expect(optionsOf('담당자')).toEqual(['나'])
})

test('만들기 409 EVENT_INVALID는 만들기 옆에 보인다', async () => {
  const { api } = setup()
  api.on('POST', CREATE, () => json({ error: 'EVENT_INVALID' }, 409))
  await screen.findByRole('combobox', { name: '행사' })
  fireEvent.change(screen.getByLabelText('제목'), { target: { value: '청소' } })
  fireEvent.change(screen.getByRole('combobox', { name: '행사' }), { target: { value: EVENT_ID } })
  fireEvent.click(screen.getByRole('button', { name: '만들기' }))
  expect((await screen.findByRole('alert')).textContent).toBe(TASK_ERRORS.EVENT_INVALID)
})
