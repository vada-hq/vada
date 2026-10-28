// @vitest-environment jsdom
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { CALENDAR_ITEM_LIMIT, calendarTitleOf } from '@vada/contracts'
import { councilView } from '@/test-support/council-fixtures'
import { calendarItem, calendarItems } from '@/test-support/calendar-fixtures'
import { deferredResponse, json, mockApi } from '@/test-support/mock-api'
import { COUNCIL_ID } from '@/test-support/workspace-at'
import CalendarPage from './CalendarPage'

const base = `/api/organizations/${COUNCIL_ID}/calendar`
const october = `${base}?from=2026-09-27&to=2026-10-31`
const november = `${base}?from=2026-11-01&to=2026-12-05`
let api: ReturnType<typeof mockApi>
const forbidden = vi.fn()
const page = () => (
  <CalendarPage view={councilView(COUNCIL_ID, { permissions: [] })} onForbidden={forbidden} />
)
const selectedDay = () => screen.getByRole('region', { name: '10월 28일 (수)' })
const mockWidth = (wide: boolean) =>
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({ matches: wide, addEventListener() {}, removeEventListener() {} })),
  )

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-10-28T03:00:00Z'))
  forbidden.mockClear()
  mockWidth(true)
  window.history.replaceState(null, '', `/calendar/${COUNCIL_ID}`)
  api = mockApi()
  api.on('GET', october, () => json({ items: calendarItems, truncated: false }))
  api.on('GET', november, () => json({ items: [], truncated: false }))
})

afterEach(() => {
  cleanup()
  api.assertNoUnexpectedRequests()
  window.history.replaceState(null, '', '/')
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

test('권한으로 읽기를 가리지 않고 모은 일정 경로 한 번만 읽으며 쓰기 동작이 없다', async () => {
  render(page())
  await screen.findByRole('button', { name: '10월 28일 (수) 일정 4건' })
  expect(screen.getByRole('heading', { name: '2026년 10월' })).toBeTruthy()
  expect(screen.getByRole('button', { name: '구독' })).toBeTruthy()
  for (const item of calendarItems.filter(item => item.start.startsWith('2026-10-28')))
    expect(within(selectedDay()).getByRole('button', { name: calendarTitleOf(item) })).toBeTruthy()
  expect(api.calls.map(({ method, path }) => [method, path])).toEqual([['GET', october]])
  expect(screen.queryByRole('button', { name: /^(시작|끝내기|업무 추가|일정 추가)/ })).toBeNull()
  expect(screen.queryByRole('combobox')).toBeNull()
})

test.each([
  ['task_due', `/tasks/${COUNCIL_ID}/0199d1a0-0000-7000-8000-0000000000a1`],
  ['event', `/events/${COUNCIL_ID}/0199d1a0-0000-7000-8000-0000000000e1?tab=overview`],
  [
    'registration_close',
    `/events/${COUNCIL_ID}/0199d1a0-0000-7000-8000-0000000000e1?tab=registrations`,
  ],
  ['purchase_needed_by', `/purchases/${COUNCIL_ID}/0199d1a0-0000-7000-8000-0000000000b1`],
])('%s 줄은 서버가 준 원본 주소로 간다', async (source, path) => {
  render(page())
  const name = calendarTitleOf(calendarItems.find(item => item.source === source)!)
  await screen.findByRole('button', { name: '10월 28일 (수) 일정 4건' })
  fireEvent.click(within(selectedDay()).getByRole('button', { name }))
  await waitFor(() => expect(window.location.pathname + window.location.search).toBe(path))
  expect(api.calls.every(call => call.method === 'GET')).toBe(true)
})

test('달을 옮기면 새 범위를 읽고 늦은 앞 달 응답을 버린다', async () => {
  const pending = deferredResponse()
  api.on('GET', october, () => pending.promise)
  render(page())
  expect(await screen.findByText('일정 불러오는 중…')).toBeTruthy()
  expect(screen.queryByText('0건')).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: '다음 달' }))
  expect(await screen.findByText('일정 없음')).toBeTruthy()
  expect(screen.getByRole('heading', { name: '2026년 11월' })).toBeTruthy()
  await act(async () => pending.resolve(json({ items: calendarItems, truncated: false })))
  expect(screen.queryByText(calendarItems[0]!.title)).toBeNull()
  expect(api.calls.map(call => call.path)).toEqual([october, november])
})

test('전체·행사·마감 칩은 날짜를 보존하고 주소와 월 칸·고른 날을 함께 거른다', async () => {
  render(page())
  await screen.findByRole('button', { name: '10월 28일 (수) 일정 4건' })
  const chips = screen.getByRole('group', { name: '일정 유형' })
  fireEvent.click(within(chips).getByRole('button', { name: '행사' }))
  expect(window.location.search).toBe('?kind=event')
  expect(screen.getByRole('button', { name: '10월 28일 (수) 일정 1건' })).toBeTruthy()
  expect(within(selectedDay()).queryByText('공연 참가 신청 마감')).toBeNull()
  fireEvent.click(within(chips).getByRole('button', { name: '마감' }))
  expect(window.location.search).toBe('?kind=deadline')
  expect(screen.getByRole('button', { name: '10월 28일 (수) 일정 3건' })).toBeTruthy()
  expect(within(selectedDay()).queryByText('가을 축제')).toBeNull()
  fireEvent.click(within(chips).getByRole('button', { name: '전체' }))
  expect(window.location.search).toBe('')
  expect(api.calls).toHaveLength(1)
})

test('목록 보기는 달 안의 날짜만 묶고 여러 날 일정을 걸친 날마다 보인다', async () => {
  window.history.replaceState(null, '', `/calendar/${COUNCIL_ID}?view=list&kind=event`)
  render(page())
  await screen.findByRole('region', { name: '10월 28일 (수)' })
  expect(screen.queryByRole('button', { name: '10월 28일 (수) 일정 1건' })).toBeNull()
  expect(screen.getAllByText('오늘')).toHaveLength(2)
  expect(screen.getAllByRole('button', { name: '가을 축제' })).toHaveLength(3)
  expect(screen.queryByRole('region', { name: '9월 30일 (수)' })).toBeNull()
  expect(screen.queryByText('공연 참가 신청 마감')).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: '월' }))
  expect(window.location.search).toBe('?view=month&kind=event')
  expect(screen.getByRole('button', { name: '10월 28일 (수) 일정 1건' })).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: '목록' }))
  fireEvent.click(screen.getByRole('button', { name: '다음 달' }))
  expect(await screen.findByText('이 달 일정 없음')).toBeTruthy()
  expect(api.calls).toHaveLength(2)
})

test('좁은 화면은 주소를 더하지 않고 목록, 명시한 월 선택은 좁아도 월이다', async () => {
  mockWidth(false)
  const mounted = render(page())
  await screen.findByRole('region', { name: '10월 28일 (수)' })
  expect(screen.getByRole('button', { name: '목록' }).getAttribute('aria-pressed')).toBe('true')
  expect(window.location.search).toBe('')
  fireEvent.click(screen.getByRole('button', { name: '월' }))
  expect(window.location.search).toBe('?view=month')
  mounted.unmount()
  render(page())
  expect(await screen.findByRole('button', { name: '10월 28일 (수) 일정 4건' })).toBeTruthy()
})

test.each([403, 500])('%s 실패는 다시 시도할 수 있고 403만 학생회를 다시 읽는다', async status => {
  api.on('GET', october, () =>
    json({ error: status === 403 ? 'FORBIDDEN' : 'INTERNAL_ERROR' }, status),
  )
  render(page())
  expect(await screen.findByRole('button', { name: '다시 시도' })).toBeTruthy()
  expect(forbidden).toHaveBeenCalledTimes(status === 403 ? 1 : 0)
  expect(screen.queryByText('0건')).toBeNull()
  api.on('GET', october, () => json({ items: [], truncated: false }))
  fireEvent.click(screen.getByRole('button', { name: '다시 시도' }))
  expect(await screen.findByText('일정 없음')).toBeTruthy()
})

test('빈 날은 회색 0건, 잘림은 계약 상한을 알리고 지남은 빨강과 아이콘·글로 보인다', async () => {
  api.on('GET', october, () => json({ items: [calendarItem({ overdue: true })], truncated: true }))
  render(page())
  expect(await screen.findByText(`일정이 많아 ${CALENDAR_ITEM_LIMIT}개만 보여요.`)).toBeTruthy()
  const late = within(selectedDay()).getByText('지남')
  expect(late.className).toContain('text-red-700')
  expect(within(selectedDay()).getByText('종일')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: '10월 29일 (목) 일정 0건' }))
  const empty = screen.getByRole('region', { name: '10월 29일 (목)' })
  expect(within(empty).getByText('0건').className).toContain('text-gray-500')
  expect(within(empty).getByText('일정 없음')).toBeTruthy()
})
