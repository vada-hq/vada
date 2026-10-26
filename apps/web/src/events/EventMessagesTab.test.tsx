// @vitest-environment jsdom
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { EventRoomsResponse, RoomSummary } from '@vada/contracts'
import { message, messagePage, room, roomDetail } from '@/test-support/chat-fixtures'
import { councilView, MEMBER_PERMISSIONS } from '@/test-support/council-fixtures'
import {
  eventDetail,
  eventSummary,
  EVENT_ID,
  MEMBER,
  uuidTeam,
} from '@/test-support/event-fixtures'
import { serveEventRooms, WithChat } from '@/test-support/event-rooms'
import { json, mockApi } from '@/test-support/mock-api'
import { COUNCIL_ID } from '@/test-support/workspace-at'
import { purchaseDetail } from '@/test-support/purchase-fixtures'
import EventsPage from './EventsPage'

// 행사 메시지 탭(022 조각 9, 정한 것 26·28·29). 방 번호는 주소에 남으므로 uuid다.
const ORG = `/api/organizations/${COUNCIL_ID}`
const EVENT_AT = `/events/${COUNCIL_ID}/${EVENT_ID}`
const NOTICE = '00000000-0000-4000-8000-0000000000a1'
const PLAN = '00000000-0000-4000-8000-0000000000a2'
const MSG = '00000000-0000-4000-8000-0000000000b1'
const pathNow = () => window.location.pathname + window.location.search

const eventRoom = (id: string, extra: Partial<RoomSummary>) =>
  room(id, { eventId: EVENT_ID, eventName: '신입생 환영회', ...extra })
const notice = (extra: Partial<RoomSummary> = {}) => eventRoom(NOTICE, { unread: 2, ...extra })
const plan = (extra: Partial<RoomSummary> = {}) =>
  eventRoom(PLAN, { type: 'department', name: '기획부', departmentId: 'd1', unread: 3, ...extra })

beforeEach(() => window.history.replaceState(null, '', EVENT_AT))
afterEach(() => {
  cleanup()
  window.history.replaceState(null, '', '/')
  vi.unstubAllGlobals()
})

function serveRoom(api: ReturnType<typeof mockApi>, summary: RoomSummary, text: string) {
  api.on('GET', `${ORG}/rooms/${summary.id}`, () => json(roomDetail(summary)))
  api.on('GET', `${ORG}/rooms/${summary.id}/messages`, () =>
    json(messagePage([message(MSG, text)])),
  )
  api.on('POST', `${ORG}/rooms/${summary.id}/read`, () => new Response(null, { status: 204 }))
}

function setup(body: EventRoomsResponse, options: { completed?: boolean } = {}) {
  const api = mockApi()
  const status = options.completed ? 'completed' : 'upcoming'
  api.on('GET', `${ORG}/events`, () =>
    json({ events: [eventSummary({ status })], truncated: false }),
  )
  api.on('GET', `${ORG}/events/${EVENT_ID}`, () => json({ event: eventDetail({ status }) }))
  api.on('GET', `${ORG}/members`, () => json(uuidTeam()))
  serveEventRooms(api, COUNCIL_ID, EVENT_ID, body)
  for (const summary of body.rooms)
    serveRoom(api, summary, summary.type === 'department' ? '부서방 글' : '공지방 글')
  render(
    <WithChat councilId={COUNCIL_ID}>
      {chat => (
        <EventsPage
          view={councilView(COUNCIL_ID, { memberId: MEMBER.m1, permissions: MEMBER_PERMISSIONS })}
          onForbidden={vi.fn()}
          onTasksChanged={vi.fn()}
          {...chat}
        />
      )}
    </WithChat>,
  )
  return api
}

const switchButton = (name: RegExp) =>
  within(screen.getByRole('group', { name: '대화방' })).getByRole('button', { name })

test('메시지가 첫 탭이자 기본 탭이고, 요약 줄 대신 방 전환과 방마다 배지, 탭 배지는 그 합이다', async () => {
  setup({ rooms: [notice(), plan()], archived: false })
  const tab = await screen.findByRole('tab', { name: /메시지/ })
  expect(screen.getAllByRole('tab')[0]).toBe(tab)
  expect(tab.getAttribute('aria-selected')).toBe('true')
  await waitFor(() => expect(within(tab).getByLabelText('안 읽은 메시지 5개')).toBeTruthy())
  const group = screen.getByRole('group', { name: '대화방' })
  expect(
    within(group)
      .getAllByRole('button')
      .map(button => button.textContent),
  ).toEqual(['공지방2', '기획부 방3'])
  expect(screen.queryByRole('group', { name: '행사 요약' })).toBeNull()
  // 처음 여는 방은 내 부서방이고, 방 이름은 방 전환이 보여 제목 줄이 없다.
  expect(await screen.findByText('부서방 글')).toBeTruthy()
  expect(switchButton(/기획부 방/).getAttribute('aria-pressed')).toBe('true')
  expect(screen.queryByRole('heading', { name: /기획부/ })).toBeNull()
  expect(pathNow()).toBe(EVENT_AT)
})

test('방 전환으로 공지방을 열면 주소에 그 방이 남고, 다른 탭에서는 요약 줄이 돌아온다', async () => {
  setup({ rooms: [notice(), plan()], archived: false })
  await screen.findByText('부서방 글')
  fireEvent.click(switchButton(/공지방/))
  expect(await screen.findByText('공지방 글')).toBeTruthy()
  expect(pathNow()).toBe(`${EVENT_AT}?room=${NOTICE}`)
  fireEvent.click(screen.getByRole('tab', { name: '개요' }))
  expect(await screen.findByRole('group', { name: '행사 요약' })).toBeTruthy()
  expect(screen.queryByRole('group', { name: '대화방' })).toBeNull()
})

test('부서가 없는 회장단은 공지방만 있고 그 방이 열린다', async () => {
  setup({ rooms: [notice()], archived: false })
  await screen.findByText('공지방 글')
  const group = screen.getByRole('group', { name: '대화방' })
  expect(
    within(group)
      .getAllByRole('button')
      .map(button => button.textContent),
  ).toEqual(['공지방2'])
})

test('완료된 행사의 방은 읽기만이고 입력칸 자리에 완료된 행사가 있다', async () => {
  setup(
    { rooms: [notice({ readOnly: true }), plan({ readOnly: true })], archived: true },
    { completed: true },
  )
  expect(await screen.findByText('부서방 글')).toBeTruthy()
  expect(screen.getByText('완료된 행사')).toBeTruthy()
  expect(screen.queryByRole('textbox', { name: '메시지' })).toBeNull()
})

test('방이 없는 옛 완료 행사는 대화방 없음이다', async () => {
  setup({ rooms: [], archived: true }, { completed: true })
  expect(await screen.findByText('대화방 없음')).toBeTruthy()
  expect(screen.queryByRole('group', { name: '대화방' })).toBeNull()
})

test('열린 방도 방 목록이 보관되면 입력칸을 숨기고 보관이 풀리면 다시 보인다', async () => {
  const api = setup({ rooms: [notice(), plan()], archived: false })
  let archived = false
  api.on('GET', `${ORG}/events/${EVENT_ID}/rooms`, () =>
    json({ rooms: [notice({ readOnly: archived }), plan({ readOnly: archived })], archived }),
  )
  await screen.findByRole('textbox', { name: '메시지' })
  archived = true
  fireEvent(document, new Event('visibilitychange'))
  await screen.findByText('완료된 행사')
  expect(screen.queryByRole('textbox', { name: '메시지' })).toBeNull()
  archived = false
  fireEvent(document, new Event('visibilitychange'))
  expect(await screen.findByRole('textbox', { name: '메시지' })).toBeTruthy()
})

test('행사 방 메시지에서 연 구매 요청은 그 행사가 골라진 채로 열리고 바꿀 수 있다', async () => {
  const api = setup({ rooms: [notice(), plan()], archived: false })
  api.on('GET', `${ORG}/tasks?view=mine&status=open`, () => json({ tasks: [], truncated: false }))
  await screen.findByText('부서방 글')
  fireEvent.keyDown(await screen.findByRole('button', { name: '메시지 동작' }), { key: 'Enter' })
  fireEvent.click(await screen.findByRole('menuitem', { name: '구매 요청 만들기' }))
  const form = await screen.findByRole('form', { name: '구매 요청 내기' })
  const select = within(form).getByLabelText(/행사/) as HTMLSelectElement
  await waitFor(() => expect(select.value).toBe(EVENT_ID))
  expect(select.disabled).toBe(false)
  fireEvent.change(select, { target: { value: '' } })
  expect(select.value).toBe('')
})

test('행사 상품 패널의 자동 채움과 실제 제출 본문이 같은 행사와 원문을 유지한다', async () => {
  const api = setup({ rooms: [notice(), plan()], archived: false })
  const link = 'https://www.coupang.com/vp/products/7334523?itemId=18698271'
  api.on('GET', `${ORG}/rooms/${PLAN}/messages`, () => json(messagePage([message(MSG, link)])))
  api.on('GET', `${ORG}/tasks?view=mine&status=open`, () => json({ tasks: [], truncated: false }))
  api.on('POST', `${ORG}/product-info`, () =>
    json({
      product: {
        name: '행사용 네임펜',
        items: [{ itemId: '18698271', name: '네임펜 세트', price: 9900, listPrice: null }],
        selectedItemId: '18698271',
        shipping: null,
        deliveryEta: null,
        rocket: false,
      },
      reason: null,
    }),
  )
  api.on('POST', `${ORG}/purchase-requests`, () => json({ request: purchaseDetail('r7') }, 201))
  fireEvent.click(await screen.findByRole('link', { name: link }))
  const panel = within(await screen.findByRole('complementary', { name: '상품 정보' }))
  fireEvent.click(await panel.findByRole('button', { name: '구매 요청 만들기' }))
  const form = within(await screen.findByRole('form', { name: '구매 요청 내기' }))
  await waitFor(() => expect(form.getByLabelText<HTMLSelectElement>(/행사/).value).toBe(EVENT_ID))
  expect(form.getByLabelText<HTMLInputElement>('품목 1 이름').value).toBe('네임펜 세트')
  expect(form.getByLabelText<HTMLInputElement>('품목 1 링크').value).toBe(link)
  fireEvent.click(form.getByRole('button', { name: '내기' }))
  await waitFor(() =>
    expect(api.calls.some(call => call.path === `${ORG}/purchase-requests`)).toBe(true),
  )
  expect(api.calls.find(call => call.path === `${ORG}/purchase-requests`)?.body).toMatchObject({
    eventId: EVENT_ID,
    sourceMessageId: MSG,
    items: [{ name: '네임펜 세트', link }],
  })
})
