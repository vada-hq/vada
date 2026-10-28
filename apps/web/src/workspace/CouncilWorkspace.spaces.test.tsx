// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { Action, SidebarEvent } from '@vada/contracts'
import { councilView, MEMBER_PERMISSIONS, teamResponse } from '@/test-support/council-fixtures'
import { roomList } from '@/test-support/chat-fixtures'
import { EVENT_ID, eventDetail, eventSummary } from '@/test-support/event-fixtures'
import { json, mockApi } from '@/test-support/mock-api'
import { settlementOf } from '@/test-support/settlement-fixtures'
import type { Page } from './pages'
import { COUNCIL_ID, WorkspaceAt } from '@/test-support/workspace-at'

// 옆 메뉴 '공간' 묶음(028 조각 1, DEC-85·DEC-96): 완료하지 않은 행사 줄, [전체 행사 보기], [+ 새 행사].
afterEach(() => {
  cleanup()
  window.history.replaceState(null, '', '/')
  vi.unstubAllGlobals()
})

const base = `/api/organizations/${COUNCIL_ID}`
const OTHER_ID = '00000000-0000-4000-8000-0000000000e2'
const NEW_ID = '00000000-0000-4000-8000-0000000000e3'

const row = (id: string, name: string, status: SidebarEvent['status']): SidebarEvent => ({
  id,
  name,
  status,
})
const THREE = [
  row(EVENT_ID, '2026 체육대회', 'ongoing'),
  row(OTHER_ID, '2026학년도 새내기 배움터', 'upcoming'),
  row('00000000-0000-4000-8000-0000000000e4', '축제', 'ended'),
]

type Setup = { page?: Page; events?: SidebarEvent[][]; permissions?: Action[] }

// events는 옆 메뉴 묶음 읽기마다의 응답이다(마지막 것을 되풀이한다).
function open({ page = 'home', events = [THREE], permissions }: Setup = {}) {
  const api = mockApi()
  let reads = 0
  api.on('GET', base, () => json(councilView(COUNCIL_ID, permissions ? { permissions } : {})))
  api.on('GET', `${base}/members`, () => json(teamResponse()))
  api.on('GET', `${base}/rooms`, () => json(roomList()))
  for (const taskScope of ['mine', 'all'])
    api.on(
      'GET',
      `${base}/tasks?view=${taskScope}&status=open${taskScope === 'all' ? '&event=none' : ''}`,
      () => json({ tasks: [], truncated: false }),
    )
  api.on('GET', `${base}/home`, () => json({}, 500))
  api.on('GET', `${base}/events/open`, () => {
    const answer = events[Math.min(reads, events.length - 1)]!
    reads += 1
    return json({ events: answer, more: false })
  })
  api.on('GET', `${base}/events`, () => json({ events: [eventSummary()], truncated: false }))
  api.on('GET', `${base}/events/${EVENT_ID}`, () => json({ event: eventDetail() }))
  // 행사 화면은 메시지 탭 배지를 위해 그 행사의 방을 읽는다(022 조각 9).
  for (const id of [EVENT_ID, NEW_ID])
    api.on('GET', `${base}/events/${id}/rooms`, () => json({ rooms: [], archived: false }))
  api.on('GET', `${base}/tasks?view=all&status=open&event=${NEW_ID}`, () =>
    json({ tasks: [], truncated: false }),
  )
  api.on('GET', `${base}/events/${NEW_ID}/registration-forms`, () =>
    json({ forms: [], truncated: false, actions: [] }),
  )
  api.on('GET', `${base}/events/${NEW_ID}/settlement`, () => json(settlementOf()))
  render(<WorkspaceAt startPage={page} />)
  return { api, reads: () => reads }
}

const aside = () => screen.getByRole('complementary', { name: '학생회 작업 공간' })
const spaces = async () => within(aside()).findByRole('group', { name: '행사' })
const current = () =>
  within(aside())
    .queryAllByRole('button')
    .filter(button => button.getAttribute('aria-current') === 'page')
    .map(button => button.textContent)

test('최상위 행사 칸이 없고, 공간 묶음에 행사 줄(첫 글자, 이름, 상태 글)과 두 링크가 서버 차례대로 있다', async () => {
  open()
  const group = await spaces()
  await within(group).findByText('2026 체육대회')
  expect(within(aside()).queryByRole('button', { name: '행사' })).toBeNull()
  const lines = within(group)
    .getAllByRole('button')
    .map(button => button.textContent)
  expect(lines).toEqual([
    '체2026 체육대회진행 중',
    '새2026학년도 새내기 배움터기획 중',
    '축축제후속 정리 중',
    '전체 행사 보기',
    '새 행사',
  ])
  // 긴 이름은 한 줄 말줄임이고 올리면 전체 이름이 보인다.
  const name = within(group).getByText('2026학년도 새내기 배움터')
  expect(name.className).toContain('truncate')
  expect(name.getAttribute('title')).toBe('2026학년도 새내기 배움터')
  // 줄에 배지가 없다.
  expect(group.querySelector('[data-slot="badge"]')).toBeNull()
})

test('행사 줄을 누르면 그 행사가 열리고 그 줄이 켜진다', async () => {
  open()
  const group = await spaces()
  fireEvent.click(await within(group).findByRole('button', { name: /2026 체육대회/ }))
  expect(await screen.findByRole('heading', { name: '신입생 환영회' })).toBeTruthy()
  expect(window.location.pathname).toBe(`/events/${COUNCIL_ID}/${EVENT_ID}`)
  expect(window.location.search).toBe('')
  expect(screen.getByRole('tab', { name: '메시지', selected: true })).toBeTruthy()
  expect(current()).toEqual(['체2026 체육대회진행 중'])
  // 켜진 줄의 파란 바탕에서도 상태 글이 4.5:1을 넘게 한 단계 진하다.
  expect(within(aside()).getByText('진행 중').className).toContain('text-gray-600')
  expect(within(aside()).getByText('기획 중').className).toContain('text-gray-500')
})

test('묶음에 없는 행사(6번째, 완료)를 열거나 행사 목록이면 [전체 행사 보기]가 켜진다', async () => {
  open({ events: [THREE.slice(1)] })
  const group = await spaces()
  await within(group).findByText('축제')
  window.history.pushState(null, '', `/events/${COUNCIL_ID}/${EVENT_ID}`)
  window.dispatchEvent(new PopStateEvent('popstate'))
  await screen.findByRole('heading', { name: '신입생 환영회' })
  expect(current()).toEqual(['전체 행사 보기'])
  fireEvent.click(within(group).getByRole('button', { name: '전체 행사 보기' }))
  expect(await screen.findByRole('heading', { level: 1, name: '행사' })).toBeTruthy()
  expect(window.location.pathname).toBe(`/events/${COUNCIL_ID}`)
  expect(current()).toEqual(['전체 행사 보기'])
})

test('부원에게는 [+ 새 행사]가 없다', async () => {
  open({ permissions: MEMBER_PERMISSIONS })
  const group = await spaces()
  await within(group).findByText('축제')
  expect(within(group).getByRole('button', { name: '전체 행사 보기' })).toBeTruthy()
  expect(within(group).queryByRole('button', { name: '새 행사' })).toBeNull()
})

test('행사가 없으면 두 링크만 있고 안내 문구가 없다', async () => {
  const { reads } = open({ events: [[]] })
  const group = await spaces()
  await waitFor(() => expect(reads()).toBeGreaterThan(0))
  await within(group).findByRole('button', { name: '새 행사' })
  expect(group.textContent).toBe('행사전체 행사 보기새 행사')
})

test('[+ 새 행사]는 새 행사 창을 열고, 만들면 그 행사의 개요 탭이 열리며 옆 메뉴에 그 줄이 켜져 생긴다', async () => {
  const made = row(NEW_ID, '가을 축제', 'upcoming')
  const { api } = open({ events: [THREE, [made, ...THREE]] })
  api.on('POST', `${base}/events`, () =>
    json({ event: eventDetail({ id: NEW_ID, name: '가을 축제' }) }, 201),
  )
  api.on('GET', `${base}/events/${NEW_ID}`, () =>
    json({ event: eventDetail({ id: NEW_ID, name: '가을 축제' }) }),
  )
  const group = await spaces()
  fireEvent.click(await within(group).findByRole('button', { name: '새 행사' }))
  const dialog = await screen.findByRole('dialog', { name: '새 행사' })
  fireEvent.change(within(dialog).getByLabelText(/행사명/), { target: { value: '가을 축제' } })
  fireEvent.click(within(dialog).getByRole('button', { name: '만들기' }))
  expect(await screen.findByRole('tab', { name: '개요', selected: true })).toBeTruthy()
  expect(window.location.pathname).toBe(`/events/${COUNCIL_ID}/${NEW_ID}`)
  expect(window.location.search).toBe('?tab=overview')
  await within(group).findByText('가을 축제')
  expect(current()).toEqual(['가가을 축제기획 중'])
})

test('행사 목록 머리의 [새 행사]로 만들어도 옆 메뉴가 바로 다시 읽는다', async () => {
  const made = row(NEW_ID, '가을 축제', 'upcoming')
  const { api, reads } = open({ page: 'events', events: [THREE, [made, ...THREE]] })
  api.on('POST', `${base}/events`, () =>
    json({ event: eventDetail({ id: NEW_ID, name: '가을 축제' }) }, 201),
  )
  api.on('GET', `${base}/events/${NEW_ID}`, () =>
    json({ event: eventDetail({ id: NEW_ID, name: '가을 축제' }) }),
  )
  const group = await spaces()
  await within(group).findByText('축제')
  const before = reads()
  const header = screen
    .getAllByRole('button', { name: '새 행사' })
    .find(button => !group.contains(button))!
  fireEvent.click(header)
  const dialog = await screen.findByRole('dialog', { name: '새 행사' })
  fireEvent.change(within(dialog).getByLabelText(/행사명/), { target: { value: '가을 축제' } })
  fireEvent.click(within(dialog).getByRole('button', { name: '만들기' }))
  await within(group).findByText('가을 축제')
  expect(reads()).toBe(before + 1)
  expect(await screen.findByRole('tab', { name: '개요', selected: true })).toBeTruthy()
  expect(window.location.pathname + window.location.search).toBe(
    `/events/${COUNCIL_ID}/${NEW_ID}?tab=overview`,
  )
})

test('행사 기본정보를 고치면 옆 메뉴가 바로 다시 읽어 새 이름을 보인다', async () => {
  const renamed = [row(EVENT_ID, '2026 가을 체육대회', 'ongoing'), ...THREE.slice(1)]
  const { api } = open({ events: [THREE, renamed] })
  api.on('GET', `${base}/events/${EVENT_ID}`, () =>
    json({ event: eventDetail({}, ['event.update']) }),
  )
  api.on('POST', `${base}/events/${EVENT_ID}`, () =>
    json({ event: eventDetail({ name: '2026 가을 체육대회' }, ['event.update']) }),
  )
  api.on('GET', `${base}/events/${EVENT_ID}/registration-forms`, () =>
    json({ forms: [], truncated: false, actions: [] }),
  )
  const group = await spaces()
  fireEvent.click(await within(group).findByRole('button', { name: /2026 체육대회/ }))
  // 고치기는 개요의 요약 줄에 있다(메시지 탭은 요약 줄 대신 방 전환이다).
  fireEvent.click(await screen.findByRole('tab', { name: '개요' }))
  fireEvent.click(await screen.findByRole('button', { name: '기본정보 수정' }))
  const panel = await screen.findByRole('dialog', { name: '행사 기본정보 수정' })
  fireEvent.click(within(panel).getByRole('button', { name: '저장' }))
  expect(await within(group).findByText('2026 가을 체육대회')).toBeTruthy()
})

test('휴대폰 서랍에도 같은 공간 묶음이 있다', async () => {
  open()
  await spaces()
  fireEvent.click(screen.getByRole('button', { name: '메뉴 열기' }))
  const sheet = await screen.findByRole('dialog', { name: '학생회 작업 공간' })
  const group = within(sheet).getByRole('group', { name: '행사' })
  expect(within(group).getByText('2026 체육대회')).toBeTruthy()
  expect(within(group).getByRole('button', { name: '전체 행사 보기' })).toBeTruthy()
})

test('서랍의 [+ 새 행사]는 서랍을 닫고 새 행사 창을 열며, 창을 닫으면 초점이 메뉴 열기 단추로 돌아온다', async () => {
  open()
  await spaces()
  const opener = screen.getByRole('button', { name: '메뉴 열기' })
  fireEvent.click(opener)
  const sheet = await screen.findByRole('dialog', { name: '학생회 작업 공간' })
  fireEvent.click(within(sheet).getByRole('button', { name: '새 행사' }))
  const dialog = await screen.findByRole('dialog', { name: '새 행사' })
  expect(screen.queryByRole('dialog', { name: '학생회 작업 공간' })).toBeNull()
  // 창 아래의 [닫기](오른쪽 위 X와 같은 이름)
  fireEvent.click(within(dialog).getAllByRole('button', { name: '닫기' }).at(-1)!)
  await waitFor(() => expect(screen.queryByRole('dialog', { name: '새 행사' })).toBeNull())
  await waitFor(() => expect(document.activeElement).toBe(opener))
})
