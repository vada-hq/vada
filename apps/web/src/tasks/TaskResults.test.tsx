// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { TaskDetail } from '@vada/contracts'
import { asElement } from '@/test-support/elements'
import { councilView } from '@/test-support/council-fixtures'
import { json, mockApi } from '@/test-support/mock-api'
import { eventSummary } from '@/test-support/event-fixtures'
import { purchaseDetail } from '@/test-support/purchase-fixtures'
import { taskDetail } from '@/test-support/task-detail-fixtures'
import { resetAddress } from '@/test-support/address-reset'
import { PurchaseRoute } from '@/test-support/purchase-route'
import { confirmLeave } from '@/lib/leave-guard'
import { ROOM_LOST, TASK_INVALID, PERMISSION_CHANGED } from '@/lib/messages'
import { eventDetail } from '@/test-support/event-fixtures'
import { staffForm } from '@/test-support/staff-registration-fixtures'
import { TaskDetailDialog } from './TaskDetailDialog'

afterEach(async () => {
  cleanup()
  await resetAddress()
  vi.unstubAllGlobals()
})

const TASK_ID = '00000000-0000-4000-8000-0000000000a1'
const EVENT_ID = '00000000-0000-4000-8000-0000000000e1'
const ROOM_ID = '00000000-0000-4000-8000-0000000000b1'
const BASE = '/api/organizations/c1'
const URL_TASK = `${BASE}/tasks/${TASK_ID}`

const MEMBER_ID = '00000000-0000-4000-8000-0000000000c1'

function setup(task: TaskDetail) {
  const api = mockApi()
  let current = task
  api.on('GET', URL_TASK, () => json({ task: current }))
  api.on('GET', `${BASE}/purchase-requests/r1`, () => json({ request: purchaseDetail('r1') }))
  api.on('GET', `${BASE}/events`, () =>
    json({ events: [eventSummary({ id: EVENT_ID, name: '환영회' })], truncated: false }),
  )
  const handlers = {
    onClose: vi.fn(),
    onChanged: vi.fn(),
    onLost: vi.fn(),
    onForbidden: vi.fn(),
  }
  render(
    <PurchaseRoute
      view={councilView('c1', { memberId: MEMBER_ID })}
      onForbidden={handlers.onForbidden}
    >
      <TaskDetailDialog
        view={councilView('c1', { memberId: MEMBER_ID })}
        taskId={TASK_ID}
        {...handlers}
      />
    </PurchaseRoute>,
  )
  return { api, handlers, change: (next: TaskDetail) => (current = next) }
}

const detail = (extra: Partial<TaskDetail> = {}) =>
  taskDetail({ id: TASK_ID, title: '현수막 사기', ...extra })
const submitIn = (name: string) =>
  fireEvent.submit(within(screen.getByRole('dialog', { name })).getByRole('form'))

test('결과물이 없고 만들 수 있는 것도 없으면 결과물 없음만 보인다', async () => {
  setup(detail())
  const region = await screen.findByRole('region', { name: '결과물' })
  expect(within(region).getByText('결과물 없음')).toBeTruthy()
  expect(within(region).queryByRole('button')).toBeNull()
})

test('결과물 줄은 종류와 제목과 단계를 보이고, canMake에 있는 버튼만 보인다', async () => {
  setup(
    detail({
      results: [
        { kind: 'request', id: 'r1', title: '현수막 요청', stage: 'in_progress' },
        { kind: 'message', id: 'm1', title: '내일 총회', stage: 'finished' },
        { kind: 'request', id: 'r2', title: '옛 요청', stage: 'excluded' },
        { kind: 'event', id: 'e1', title: '봄 행사', stage: 'none' },
        { kind: 'message', id: 'm2', title: null, stage: 'excluded' },
      ],
      canMake: ['request', 'message'],
    }),
  )
  const region = await screen.findByRole('region', { name: '결과물' })
  const lines = within(region)
    .getAllByRole('listitem')
    .map(item => item.textContent)
  expect(lines).toEqual([
    '구매 요청 · 현수막 요청진행 중',
    '공지 · 내일 총회끝남',
    '구매 요청 · 옛 요청취소',
    '행사 · 봄 행사',
    '공지 · 삭제된 메시지취소',
  ])
  expect(within(region).getByRole('button', { name: '구매 요청 만들기' })).toBeTruthy()
  expect(within(region).getByRole('button', { name: '공지 만들기' })).toBeTruthy()
  expect(within(region).queryByRole('button', { name: '신청 양식 만들기' })).toBeNull()
  expect(within(region).queryByRole('button', { name: '행사 만들기' })).toBeNull()
})

test('구매 요청 만들기는 제목이 채워진 전용 페이지를 열고 taskId를 보존해 보낸다', async () => {
  const { api, change } = setup(detail({ canMake: ['request'], event: null }))
  fireEvent.click(await screen.findByRole('button', { name: '구매 요청 만들기' }))
  const form = await screen.findByRole('form', { name: '구매 요청 내기' })
  expect(asElement(within(form).getByLabelText(/제목/), HTMLInputElement).value).toBe('현수막 사기')
  fireEvent.change(within(form).getByLabelText(/이름/), { target: { value: '현수막' } })
  api.on('POST', `${BASE}/purchase-requests`, () => json({ request: { id: 'r1' } }, 201))
  change(
    detail({
      status: 'in_progress',
      results: [{ kind: 'request', id: 'r1', title: '현수막 사기', stage: 'in_progress' }],
    }),
  )
  fireEvent.submit(form)
  await waitFor(() => expect(screen.queryByRole('form', { name: '구매 요청 내기' })).toBeNull())
  const post = api.calls.find(call => call.method === 'POST')!
  expect(post.body).toMatchObject({ title: '현수막 사기', taskId: TASK_ID })
  expect(window.location.pathname).toBe('/purchases/c1/r1')
})

test('이을 수 없는 업무면 409 문구를 창 안에 보이고 창은 그대로다', async () => {
  const { api } = setup(detail({ canMake: ['request'] }))
  fireEvent.click(await screen.findByRole('button', { name: '구매 요청 만들기' }))
  const form = await screen.findByRole('form', { name: '구매 요청 내기' })
  fireEvent.change(within(form).getByLabelText(/이름/), { target: { value: '현수막' } })
  api.on('POST', `${BASE}/purchase-requests`, () => json({ error: 'TASK_INVALID' }, 409))
  fireEvent.submit(form)
  expect(await within(form).findByText(TASK_INVALID)).toBeTruthy()
  expect(screen.getByRole('form', { name: '구매 요청 내기' })).toBeTruthy()
  // 닫으면 업무를 다시 읽는다(낡은 만들기 버튼이 남지 않게).
  const reads = () => api.calls.filter(call => call.path === URL_TASK).length
  const before = reads()
  fireEvent.click(within(form).getByRole('button', { name: '취소' }))
  confirmLeave()
  await waitFor(() => expect(reads()).toBeGreaterThan(before))
})

test('403이면 창을 닫고 이유를 부모에게 넘긴다', async () => {
  const { api, handlers } = setup(detail({ canMake: ['request'] }))
  fireEvent.click(await screen.findByRole('button', { name: '구매 요청 만들기' }))
  const form = await screen.findByRole('form', { name: '구매 요청 내기' })
  fireEvent.change(within(form).getByLabelText(/이름/), { target: { value: '현수막' } })
  api.on('POST', `${BASE}/purchase-requests`, () => json({ error: 'FORBIDDEN' }, 403))
  fireEvent.submit(form)
  expect(await screen.findByText(PERMISSION_CHANGED)).toBeTruthy()
  expect(handlers.onForbidden).toHaveBeenCalled()
})

test('공지 만들기는 공지방에 보통 메시지로 taskId를 보낸다. 내용이 비면 보내지 않는다', async () => {
  const { api } = setup(detail({ canMake: ['message'] }))
  api.on('GET', `${BASE}/rooms`, () =>
    json({
      rooms: [
        { id: 'x', type: 'leadership' },
        { id: ROOM_ID, type: 'all_members' },
      ],
      unreadTotal: 0,
      mentionTotal: 0,
    }),
  )
  fireEvent.click(await screen.findByRole('button', { name: '공지 만들기' }))
  const dialog = await screen.findByRole('dialog', { name: '공지 만들기' })
  await waitFor(() => expect(api.calls.some(call => call.path === `${BASE}/rooms`)).toBe(true))
  fireEvent.submit(within(dialog).getByRole('form'))
  expect(await within(dialog).findByText('내용을 입력해 주세요')).toBeTruthy()
  expect(api.calls.some(call => call.method === 'POST')).toBe(false)
  fireEvent.change(within(dialog).getByLabelText(/내용/), { target: { value: '내일 총회' } })
  api.on('POST', `${BASE}/rooms/${ROOM_ID}/messages`, () => json({ id: 'm1' }, 201))
  await waitFor(() => {
    submitIn('공지 만들기')
    expect(api.calls.some(call => call.method === 'POST')).toBe(true)
  })
  expect(api.calls.find(call => call.method === 'POST')!.body).toEqual({
    body: '내일 총회',
    taskId: TASK_ID,
  })
})

test('학생회 업무의 공지는 행사 방이 아닌 학생회 공지방에 보낸다', async () => {
  const { api } = setup(detail({ canMake: ['message'] }))
  api.on('GET', `${BASE}/rooms`, () =>
    json({
      rooms: [
        { id: 'event-notice', type: 'all_members', eventId: EVENT_ID, eventName: '환영회' },
        { id: ROOM_ID, type: 'all_members', eventId: null, eventName: null },
      ],
      unreadTotal: 0,
      mentionTotal: 0,
    }),
  )
  fireEvent.click(await screen.findByRole('button', { name: '공지 만들기' }))
  const dialog = await screen.findByRole('dialog', { name: '공지 만들기' })
  fireEvent.change(within(dialog).getByLabelText(/내용/), { target: { value: '내일 총회' } })
  api.on('POST', `${BASE}/rooms/${ROOM_ID}/messages`, () => json({ id: 'm1' }, 201))
  await waitFor(() => {
    submitIn('공지 만들기')
    expect(api.calls.some(call => call.path === `${BASE}/rooms/${ROOM_ID}/messages`)).toBe(true)
  })
})

test('행사에 이은 업무의 공지는 그 행사의 공지방에 보낸다', async () => {
  const { api } = setup(detail({ canMake: ['message'], event: { id: EVENT_ID, name: '환영회' } }))
  api.on('GET', `${BASE}/events/${EVENT_ID}/rooms`, () =>
    json({
      rooms: [
        { id: 'dept', type: 'department', eventId: EVENT_ID, eventName: '환영회' },
        { id: ROOM_ID, type: 'all_members', eventId: EVENT_ID, eventName: '환영회' },
      ],
      archived: false,
    }),
  )
  fireEvent.click(await screen.findByRole('button', { name: '공지 만들기' }))
  const dialog = await screen.findByRole('dialog', { name: '공지 만들기' })
  fireEvent.change(within(dialog).getByLabelText(/내용/), { target: { value: '내일 리허설' } })
  api.on('POST', `${BASE}/rooms/${ROOM_ID}/messages`, () => json({ id: 'm1' }, 201))
  await waitFor(() => {
    submitIn('공지 만들기')
    expect(api.calls.some(call => call.path === `${BASE}/rooms/${ROOM_ID}/messages`)).toBe(true)
  })
  expect(api.calls.some(call => call.path === `${BASE}/rooms`)).toBe(false)
})

test('행사 만들기는 이름과 taskId를 보낸다', async () => {
  const { api } = setup(detail({ canMake: ['event'] }))
  fireEvent.click(await screen.findByRole('button', { name: '행사 만들기' }))
  const dialog = await screen.findByRole('dialog', { name: '새 행사' })
  fireEvent.change(within(dialog).getByLabelText(/행사명/), { target: { value: '봄 축제' } })
  api.on('POST', `${BASE}/events`, () => json({ event: { id: EVENT_ID } }, 201))
  fireEvent.submit(within(dialog).getByRole('form'))
  await waitFor(() => expect(api.calls.some(call => call.method === 'POST')).toBe(true))
  expect(api.calls.find(call => call.method === 'POST')!.body).toMatchObject({
    name: '봄 축제',
    taskId: TASK_ID,
  })
})

test('신청 양식 만들기는 업무의 행사로 양식 화면을 대화상자에 열고 taskId를 보낸다', async () => {
  const { api } = setup(
    detail({ canMake: ['registration_form'], event: { id: EVENT_ID, name: '환영회' } }),
  )
  fireEvent.click(await screen.findByRole('button', { name: '신청 양식 만들기' }))
  const form = await screen.findByRole('form', { name: '신청 양식 만들기' })
  fireEvent.change(within(form).getByLabelText(/신청 마감/), {
    target: { value: '2026-11-01T18:00' },
  })
  api.on('POST', `${BASE}/events/${EVENT_ID}/registration-forms`, () =>
    json({ form: staffForm({ id: 'f1' }) }, 201),
  )
  fireEvent.submit(form)
  await waitFor(() => expect(api.calls.some(call => call.method === 'POST')).toBe(true))
  expect(api.calls.find(call => call.method === 'POST')!.body).toMatchObject({ taskId: TASK_ID })
})

test('공지 보내기가 404이면 업무가 아니라 방을 잃었다고 알린다', async () => {
  const { api, handlers } = setup(detail({ canMake: ['message'] }))
  api.on('GET', `${BASE}/rooms`, () =>
    json({
      rooms: [{ id: ROOM_ID, type: 'all_members' }],
      unreadTotal: 0,
      mentionTotal: 0,
    }),
  )
  fireEvent.click(await screen.findByRole('button', { name: '공지 만들기' }))
  const dialog = await screen.findByRole('dialog', { name: '공지 만들기' })
  fireEvent.change(within(dialog).getByLabelText(/내용/), { target: { value: '내일 총회' } })
  api.on('POST', `${BASE}/rooms/${ROOM_ID}/messages`, () => json({ error: 'NOT_FOUND' }, 404))
  await waitFor(() => {
    submitIn('공지 만들기')
    expect(handlers.onLost).toHaveBeenCalledWith(ROOM_LOST)
  })
})

test('신청 양식 창은 행사의 일시·장소 미정을 알리고, 만든 뒤 링크를 보인 다음 닫으면 업무를 다시 읽는다', async () => {
  const { api } = setup(
    detail({ canMake: ['registration_form'], event: { id: EVENT_ID, name: '환영회' } }),
  )
  api.on('GET', `${BASE}/events/${EVENT_ID}`, () =>
    json({ event: eventDetail({ id: EVENT_ID, startsAt: null, place: null }) }),
  )
  fireEvent.click(await screen.findByRole('button', { name: '신청 양식 만들기' }))
  const form = await screen.findByRole('form', { name: '신청 양식 만들기' })
  expect((await within(form).findAllByText('미정')).length).toBe(2)
  fireEvent.change(within(form).getByLabelText(/신청 마감/), {
    target: { value: '2026-11-01T18:00' },
  })
  api.on('POST', `${BASE}/events/${EVENT_ID}/registration-forms`, () =>
    json({ form: staffForm({ id: 'f1', name: '환영회 신청' }) }, 201),
  )
  fireEvent.submit(form)
  const heading = await screen.findByText('신청 양식 생성 완료')
  const created = asElement(heading.parentElement!.parentElement!.parentElement!, HTMLElement)
  const reads = () => api.calls.filter(call => call.path === URL_TASK).length
  const before = reads()
  fireEvent.click(within(created).getByRole('button', { name: '닫기' }))
  await waitFor(() => expect(reads()).toBeGreaterThan(before))
  expect(screen.queryByText('신청 양식 생성 완료')).toBeNull()
})
