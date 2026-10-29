// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { appPath, eventRoomPath, recordPath, type TaskDetail } from '@vada/contracts'
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
import { TaskPanel } from './TaskPanel'
import { pickDateTime } from '@/test-support/date-field'

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
      <TaskPanel view={councilView('c1', { memberId: MEMBER_ID })} taskId={TASK_ID} {...handlers} />
    </PurchaseRoute>,
  )
  return { api, handlers, change: (next: TaskDetail) => (current = next) }
}

const detail = (extra: Partial<TaskDetail> = {}) =>
  taskDetail({ id: TASK_ID, title: '현수막 사기', ...extra })
// 결과물 [만들기] 메뉴에서 그 종류를 고른다. 항목 이름 뒤에 만들면 업무가 어떻게 되는지가 붙는다.
async function make(label: string) {
  fireEvent.keyDown(await screen.findByRole('button', { name: '만들기' }), { key: 'Enter' })
  fireEvent.click(await screen.findByRole('menuitem', { name: new RegExp(`^${label}`) }))
}
const submitIn = (name: string) =>
  fireEvent.submit(within(screen.getByRole('dialog', { name })).getByRole('form'))

test('결과물이 없고 만들 수 있는 것도 없으면 결과물 없음만 보인다', async () => {
  setup(detail())
  const region = await screen.findByRole('region', { name: '결과물' })
  expect(within(region).getByText('결과물 없음')).toBeTruthy()
  expect(within(region).queryByRole('button')).toBeNull()
})

test('결과물 줄은 종류와 제목과 단계를 보이고, [만들기] 메뉴에는 canMake에 있는 것만 있다', async () => {
  setup(
    detail({
      results: [
        {
          kind: 'request',
          id: 'r1',
          title: '현수막 요청',
          stage: 'in_progress',
          eventId: null,
          roomId: null,
        },
        {
          kind: 'message',
          id: 'm1',
          title: '내일 총회',
          stage: 'finished',
          eventId: null,
          roomId: ROOM_ID,
        },
        {
          kind: 'request',
          id: 'r2',
          title: '옛 요청',
          stage: 'excluded',
          eventId: null,
          roomId: null,
        },
        { kind: 'event', id: 'e1', title: '봄 행사', stage: 'none', eventId: null, roomId: null },
        { kind: 'message', id: 'm2', title: null, stage: 'excluded', eventId: null, roomId: null },
      ],
      canMake: ['request', 'message'],
    }),
  )
  const region = await screen.findByRole('region', { name: '결과물' })
  const lines = within(region)
    .getAllByRole('listitem')
    .map(item => item.textContent)
  expect(lines).toEqual([
    '구매 요청현수막 요청진행 중',
    '공지내일 총회끝남',
    '구매 요청옛 요청취소',
    '행사봄 행사',
    '공지삭제된 메시지취소',
  ])
  // 지운 공지는 열 곳이 없어 누를 수 없다.
  expect(within(region).queryByRole('button', { name: /삭제된 메시지/ })).toBeNull()
  fireEvent.keyDown(within(region).getByRole('button', { name: '만들기' }), { key: 'Enter' })
  const items = await screen.findAllByRole('menuitem')
  expect(items.map(item => item.textContent)).toEqual([
    '구매 요청내면 진행 중, 모두 결제되면 끝남',
    '공지공지방에 올리면 끝남',
  ])
})

test.each([
  ['request', 'r1', null, null, '/purchases/c1/r1'],
  ['event', EVENT_ID, null, null, recordPath('events', 'c1', EVENT_ID)],
  [
    'registration_form',
    'f1',
    EVENT_ID,
    null,
    appPath({
      type: 'record',
      record: 'events',
      councilId: 'c1',
      recordId: EVENT_ID,
      query: { tab: 'registrations' },
    }),
  ],
  ['message', 'm1', null, ROOM_ID, recordPath('chat', 'c1', ROOM_ID)],
  ['message', 'm1', EVENT_ID, ROOM_ID, eventRoomPath('c1', EVENT_ID, ROOM_ID)],
] as const)(
  '결과물 줄(%s)을 누르면 그 기록으로 간다',
  async (...[kind, id, eventId, roomId, target]) => {
    setup(detail({ results: [{ kind, id, title: '결과물', stage: 'none', eventId, roomId }] }))
    const region = await screen.findByRole('region', { name: '결과물' })
    fireEvent.click(within(region).getByRole('button', { name: /결과물$/ }))
    await waitFor(() => expect(window.location.pathname + window.location.search).toBe(target))
  },
)

test('구매 요청 만들기는 제목이 채워진 전용 페이지를 열고 taskId를 보존해 보낸다', async () => {
  const { api, change } = setup(detail({ canMake: ['request'], event: null }))
  await make('구매 요청')
  const form = await screen.findByRole('form', { name: '구매 요청 내기' })
  expect(asElement(within(form).getByLabelText(/제목/), HTMLInputElement).value).toBe('현수막 사기')
  fireEvent.change(within(form).getByLabelText(/이름/), { target: { value: '현수막' } })
  api.on('POST', `${BASE}/purchase-requests`, () => json({ request: { id: 'r1' } }, 201))
  change(
    detail({
      status: 'in_progress',
      results: [
        {
          kind: 'request',
          id: 'r1',
          title: '현수막 사기',
          stage: 'in_progress',
          eventId: null,
          roomId: null,
        },
      ],
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
  await make('구매 요청')
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
  await make('구매 요청')
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
  await make('공지')
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
  await make('공지')
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
  await make('공지')
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
  await make('행사')
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
  await make('신청 양식')
  const form = await screen.findByRole('form', { name: '신청 양식 만들기' })
  await pickDateTime(within(form).getByLabelText(/신청 마감/), '2026-11-01T18:00')
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
  await make('공지')
  const dialog = await screen.findByRole('dialog', { name: '공지 만들기' })
  fireEvent.change(within(dialog).getByLabelText(/내용/), { target: { value: '내일 총회' } })
  api.on('POST', `${BASE}/rooms/${ROOM_ID}/messages`, () => json({ error: 'NOT_FOUND' }, 404))
  await waitFor(() => {
    submitIn('공지 만들기')
    expect(handlers.onLost).toHaveBeenCalledWith(ROOM_LOST)
  })
})

test('신청 양식 창은 맨 위 행사 줄에 일시·장소 미정을 보이고, 만든 뒤 링크를 보인 다음 닫으면 업무를 다시 읽는다', async () => {
  const { api } = setup(
    detail({ canMake: ['registration_form'], event: { id: EVENT_ID, name: '환영회' } }),
  )
  api.on('GET', `${BASE}/events/${EVENT_ID}`, () =>
    json({ event: eventDetail({ id: EVENT_ID, startsAt: null, place: null }) }),
  )
  await make('신청 양식')
  const form = await screen.findByRole('form', { name: '신청 양식 만들기' })
  expect(await within(form).findByText('일시 미정 · 장소 미정')).toBeTruthy()
  await pickDateTime(within(form).getByLabelText(/신청 마감/), '2026-11-01T18:00')
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
