// @vitest-environment jsdom
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { deferredResponse, json, mockApi } from '@/test-support/mock-api'
import { COUNCIL_ID } from '@/test-support/workspace-at'
import { CalendarSubscription } from './CalendarSubscription'

const path = `/api/organizations/${COUNCIL_ID}/calendar/feed`
const feed = { createdAt: '2026-10-28T03:00:00Z' }
const url = `https://vada.example.test/api/public/calendar/${'a'.repeat(43)}.ics`
const forbidden = vi.fn()
let api: ReturnType<typeof mockApi>
const open = () => fireEvent.click(screen.getByRole('button', { name: '구독' }))
const renderSubscription = () =>
  render(<CalendarSubscription councilId={COUNCIL_ID} onForbidden={forbidden} />)

beforeEach(() => {
  api = mockApi()
  forbidden.mockClear()
  api.on('GET', path, () => json({ feed: null }))
  api.on('POST', path, () => json({ feed, url }, 201))
  api.on('POST', `${path}/delete`, () => json({ feed: null }))
})
afterEach(() => {
  cleanup()
  api.assertNoUnexpectedRequests()
  vi.unstubAllGlobals()
})

test('열 때만 상태를 읽고 주소 만들기 뒤 복사·캘린더 링크·두 줄 안내를 보이며 닫으면 주소를 버린다', async () => {
  const copy = vi.fn().mockResolvedValue(undefined)
  vi.stubGlobal('navigator', { clipboard: { writeText: copy } })
  renderSubscription()
  expect(api.calls).toHaveLength(0)
  open()
  fireEvent.click(await screen.findByRole('button', { name: '주소 만들기' }))
  const input = await screen.findByRole<HTMLInputElement>('textbox', { name: '구독 주소' })
  expect(input.readOnly).toBe(true)
  expect(input.value).toBe(url)
  fireEvent.click(screen.getByRole('button', { name: '복사' }))
  await waitFor(() => expect(copy).toHaveBeenCalledWith(url))
  const webcal = url.replace(/^https?:/, 'webcal:')
  expect(screen.getByRole('link', { name: 'Google 캘린더에 추가' }).getAttribute('href')).toBe(
    `https://calendar.google.com/calendar/r?cid=${encodeURIComponent(webcal)}`,
  )
  expect(screen.getByRole('link', { name: 'Apple·Outlook에서 열기' }).getAttribute('href')).toBe(
    webcal,
  )
  expect(screen.getByText('Google 캘린더는 컴퓨터에서 추가해요.')).toBeTruthy()
  expect(screen.getByText('주소는 이 창을 닫으면 다시 볼 수 없어요.')).toBeTruthy()
  fireEvent.click(screen.getAllByRole('button', { name: '닫기' })[0]!)
  api.on('GET', path, () => json({ feed }))
  open()
  expect(await screen.findByText(/구독 주소 사용 중 ·/)).toBeTruthy()
  expect(screen.queryByRole('textbox', { name: '구독 주소' })).toBeNull()
})

test('새 주소 만들기와 구독 끊기는 확인 뒤 보내며 닫으면 보내지 않는다', async () => {
  api.on('GET', path, () => json({ feed }))
  renderSubscription()
  open()
  fireEvent.click(await screen.findByRole('button', { name: '새 주소 만들기' }))
  const replace = screen.getByRole('dialog', { name: '새 주소 만들기' })
  expect(within(replace).getByText('예전 주소는 바로 멈춰요.')).toBeTruthy()
  expect(api.calls.filter(call => call.method === 'POST')).toHaveLength(0)
  fireEvent.click(within(replace).getAllByRole('button', { name: '닫기' })[0]!)
  fireEvent.click(screen.getByRole('button', { name: '구독 끊기' }))
  const disconnect = screen.getByRole('dialog', { name: '구독 끊기' })
  fireEvent.click(within(disconnect).getByRole('button', { name: '구독 끊기' }))
  expect(await screen.findByRole('button', { name: '주소 만들기' })).toBeTruthy()
  expect(
    api.calls.filter(call => call.method === 'POST').map(call => [call.path, call.body]),
  ).toEqual([[`${path}/delete`, {}]])
})

test('새 주소 확인 뒤 받은 주소만 표시하고 보내는 중 닫지 못한다', async () => {
  api.on('GET', path, () => json({ feed }))
  const pending = deferredResponse()
  api.on('POST', path, () => pending.promise)
  renderSubscription()
  open()
  fireEvent.click(await screen.findByRole('button', { name: '새 주소 만들기' }))
  fireEvent.click(
    within(screen.getByRole('dialog', { name: '새 주소 만들기' })).getByRole('button', {
      name: '새 주소 만들기',
    }),
  )
  expect(
    screen
      .getAllByRole('button', { name: '새 주소 만들기' })
      .some(button => button.getAttribute('aria-busy') === 'true'),
  ).toBe(true)
  fireEvent.keyDown(screen.getByRole('dialog', { name: '새 주소 만들기' }), { key: 'Escape' })
  pending.resolve(json({ feed, url }, 201))
  expect((await screen.findByRole<HTMLInputElement>('textbox', { name: '구독 주소' })).value).toBe(
    url,
  )
})

test('읽기 실패는 0건으로 바꾸지 않고 재시도하며 변경 실패는 상태를 보존한다', async () => {
  api.on('GET', path, () => json({}, 500))
  renderSubscription()
  open()
  expect(await screen.findByText('구독 상태를 불러오지 못했어요.')).toBeTruthy()
  expect(screen.queryByRole('button', { name: '주소 만들기' })).toBeNull()
  api.on('GET', path, () => json({ feed: null }))
  fireEvent.click(screen.getByRole('button', { name: '다시 시도' }))
  api.on('POST', path, () => json({}, 500))
  fireEvent.click(await screen.findByRole('button', { name: '주소 만들기' }))
  expect(await screen.findByText('구독 주소를 만들지 못했어요.')).toBeTruthy()
  expect(screen.getByRole('button', { name: '주소 만들기' })).toBeTruthy()
})

test('서버의 403은 상위 권한 처리로 넘긴다', async () => {
  api.on('GET', path, () => json({ error: 'FORBIDDEN' }, 403))
  renderSubscription()
  open()
  await waitFor(() => expect(forbidden).toHaveBeenCalledOnce())
})
