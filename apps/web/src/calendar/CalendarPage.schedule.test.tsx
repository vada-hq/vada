// @vitest-environment jsdom
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { CalendarItem } from '@vada/contracts'
import { resetWindowHistory, windowHistoryIdle } from '@/lib/use-window-history'
import { navigate } from '@/lib/app-location'
import { councilView, teamResponse } from '@/test-support/council-fixtures'
import { eventSummary } from '@/test-support/event-fixtures'
import { json, mockApi } from '@/test-support/mock-api'
import { COUNCIL_ID } from '@/test-support/workspace-at'
import {
  DEPARTMENT_ID,
  SCHEDULE_ID,
  scheduleCalendarItem,
  scheduleDetail,
} from '@/test-support/schedule-fixtures'
import CalendarPage from './CalendarPage'

const base = `/api/organizations/${COUNCIL_ID}`
const october = `${base}/calendar?from=2026-09-27&to=2026-10-31`
const november = `${base}/calendar?from=2026-11-01&to=2026-12-05`
let api: ReturnType<typeof mockApi>
let items: CalendarItem[]
const forbidden = vi.fn()
const view = () => councilView(COUNCIL_ID, { permissions: ['schedule.create'] })
const mount = (v = view()) => render(<CalendarPage view={v} onForbidden={forbidden} />)

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-10-28T03:00:00Z'))
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({ matches: true, addEventListener() {}, removeEventListener() {} })),
  )
  window.history.replaceState(null, '', `/calendar/${COUNCIL_ID}`)
  items = []
  forbidden.mockClear()
  api = mockApi()
  api.on('GET', october, () => json({ items, truncated: false }))
  api.on('GET', november, () => json({ items, truncated: false }))
  api.on('GET', `${base}/events`, () => json({ events: [], truncated: false }))
  api.on('GET', `${base}/schedule/options`, () =>
    json({ departments: teamResponse().departments.map(({ id, name }) => ({ id, name })) }),
  )
  api.on('GET', `${base}/schedule/${SCHEDULE_ID}`, () => json({ item: scheduleDetail() }))
})

afterEach(async () => {
  cleanup()
  await windowHistoryIdle()
  resetWindowHistory()
  api.assertNoUnexpectedRequests()
  window.history.replaceState(null, '', '/')
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

test('생성 권한이 없으면 머리·고른 날·빈 목록에 일정 추가가 없다', async () => {
  mount(councilView(COUNCIL_ID, { permissions: [] }))
  await screen.findByText('일정 없음')
  expect(screen.queryByRole('button', { name: '일정 추가' })).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: '목록' }))
  expect(screen.getByText('이 달 일정 없음')).toBeTruthy()
  expect(screen.queryByRole('button', { name: '일정 추가' })).toBeNull()
})

test('고른 날로 만들고 성공 뒤 그날 줄을 다시 읽는다', async () => {
  api.on('POST', `${base}/schedule`, ({ body }) => {
    expect(body).toMatchObject({
      title: '학교 답사',
      when: { allDay: true, startsOn: '2026-10-29' },
    })
    items = [scheduleCalendarItem({ start: '2026-10-29' })]
    return json({ item: scheduleDetail({ start: '2026-10-29' }) }, 201)
  })
  mount()
  fireEvent.click(await screen.findByRole('button', { name: '10월 29일 (목) 일정 0건' }))
  const day = screen.getByRole('region', { name: '10월 29일 (목)' })
  fireEvent.click(within(day).getByRole('button', { name: '일정 추가' }))
  expect(screen.getByLabelText<HTMLInputElement>('시작 날짜').value).toBe('2026-10-29')
  fireEvent.change(screen.getByLabelText('제목'), { target: { value: '학교 답사' } })
  fireEvent.click(screen.getByRole('button', { name: '저장' }))
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  expect(await within(day).findByRole('button', { name: '학교 답사' })).toBeTruthy()
})

test('빈 목록과 머리에 추가가 있고 회의 칩이 행사 뒤, 시험·학사·외부·기타 칩이 마감 뒤에 있다', async () => {
  mount()
  await screen.findByText('일정 없음')
  const chips = screen.getByRole('group', { name: '일정 유형' })
  expect(
    within(chips)
      .getAllByRole('button')
      .map(button => button.textContent),
  ).toEqual(['전체', '행사', '회의', '마감', '시험·학사', '외부', '기타'])
  fireEvent.click(screen.getByRole('button', { name: '목록' }))
  expect(screen.getAllByRole('button', { name: '일정 추가' })).toHaveLength(2)
})

test('줄을 누르면 일정 주소와 상세가 열리고 취소하면 줄이 빠진다', async () => {
  items = [scheduleCalendarItem()]
  api.on('POST', `${base}/schedule/${SCHEDULE_ID}/delete`, () => {
    items = []
    return json({ ok: true })
  })
  mount()
  const day = await screen.findByRole('region', { name: '10월 28일 (수)' })
  fireEvent.click(within(day).getByRole('button', { name: '학교 답사' }))
  expect(await screen.findByRole('dialog', { name: '학교 답사' })).toBeTruthy()
  expect(window.location.pathname).toBe(`/schedule/${COUNCIL_ID}/${SCHEDULE_ID}`)
  fireEvent.click(screen.getByRole('button', { name: '일정 취소' }))
  fireEvent.click(screen.getByRole('button', { name: '일정 취소' }))
  await waitFor(() => expect(window.location.pathname).toBe(`/calendar/${COUNCIL_ID}`))
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  expect(await screen.findByText('일정 없음')).toBeTruthy()
  expect(screen.queryByRole('button', { name: '학교 답사' })).toBeNull()
})

test('일정 주소는 시작한 달과 날을 고르고 읽기 권한을 동작 권한으로 가리지 않는다', async () => {
  window.history.replaceState(null, '', `/schedule/${COUNCIL_ID}/${SCHEDULE_ID}`)
  api.on('GET', `${base}/schedule/${SCHEDULE_ID}`, () =>
    json({ item: scheduleDetail({ start: '2026-11-15', actions: [] }) }),
  )
  mount(councilView(COUNCIL_ID, { permissions: [] }))
  expect(await screen.findByRole('dialog', { name: '학교 답사' })).toBeTruthy()
  expect(screen.queryByRole('button', { name: '수정' })).toBeNull()
  expect(screen.getByRole('heading', { name: '2026년 11월', hidden: true })).toBeTruthy()
  expect(await screen.findByRole('region', { name: '11월 15일 (일)', hidden: true })).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: '닫기' }))
  await waitFor(() => expect(window.location.pathname).toBe(`/calendar/${COUNCIL_ID}`))
})

test('없는 일정 주소는 일정 없음 안내 후 캘린더로 돌아간다', async () => {
  window.history.replaceState(null, '', `/schedule/${COUNCIL_ID}/${SCHEDULE_ID}`)
  api.on('GET', `${base}/schedule/${SCHEDULE_ID}`, () => json({ error: 'NOT_FOUND' }, 404))
  mount()
  await waitFor(() => expect(window.location.pathname).toBe(`/calendar/${COUNCIL_ID}`))
  expect(await screen.findByRole('status')).toHaveProperty('textContent', '일정 없음')
})

test('부서는 서버가 준 선택지만 보이고 서버 403은 부서 칸 오류로 보인다', async () => {
  api.on('POST', `${base}/schedule`, () => json({ error: 'FORBIDDEN' }, 403))
  api.on('GET', `${base}/schedule/options`, () =>
    json({ departments: [{ id: DEPARTMENT_ID, name: '기획부' }] }),
  )
  const own = councilView(COUNCIL_ID, {
    councilRank: null,
    permissions: ['schedule.create'],
    departments: [{ id: DEPARTMENT_ID, name: '기획부', role: null, rank: null }],
  })
  mount(own)
  await screen.findByText('일정 없음')
  fireEvent.click(screen.getAllByRole('button', { name: '일정 추가' })[0]!)
  expect(await screen.findByRole('option', { name: '기획부' })).toBeTruthy()
  expect(
    within(screen.getByLabelText('부서'))
      .getAllByRole('option')
      .map(option => option.textContent),
  ).toEqual(['부서 없음', '기획부'])
  fireEvent.change(screen.getByLabelText('제목'), { target: { value: '답사' } })
  fireEvent.click(screen.getByRole('button', { name: '저장' }))
  expect(await screen.findByText('이 부서는 고를 수 없어요.')).toBeTruthy()
  expect(screen.getByLabelText('부서').getAttribute('aria-invalid')).toBe('true')
})

test('수정 저장 뒤 상세와 목록이 바뀐다', async () => {
  items = [scheduleCalendarItem()]
  api.on('POST', `${base}/schedule/${SCHEDULE_ID}`, ({ body }) => {
    expect(body).toMatchObject({ title: '바뀐 답사' })
    items = [scheduleCalendarItem({ title: '바뀐 답사' })]
    return json({ item: scheduleDetail({ title: '바뀐 답사' }) })
  })
  mount()
  await screen.findByRole('region', { name: '10월 28일 (수)' })
  navigate(`/schedule/${COUNCIL_ID}/${SCHEDULE_ID}`)
  fireEvent.click(await screen.findByRole('button', { name: '수정' }))
  fireEvent.change(screen.getByLabelText('제목'), { target: { value: '바뀐 답사' } })
  fireEvent.click(screen.getByRole('button', { name: '저장' }))
  expect(await screen.findByRole('dialog', { name: '바뀐 답사' })).toBeTruthy()
})

test('서버가 준 모든 부서와 완료하지 않은 행사만 고를 수 있다', async () => {
  api.on('GET', `${base}/events`, () =>
    json({
      events: [
        eventSummary({ name: '준비 행사', status: 'upcoming' }),
        eventSummary({
          id: '0199d1a0-0000-7000-8000-0000000000e2',
          name: '완료 행사',
          status: 'completed',
        }),
      ],
      truncated: false,
    }),
  )
  mount()
  await screen.findByText('일정 없음')
  fireEvent.click(screen.getAllByRole('button', { name: '일정 추가' })[0]!)
  expect(await screen.findByRole('option', { name: '준비 행사' })).toBeTruthy()
  expect(
    within(screen.getByLabelText('부서'))
      .getAllByRole('option')
      .map(option => option.textContent),
  ).toEqual(['부서 없음', ...teamResponse().departments.map(department => department.name)])
  expect(screen.queryByRole('option', { name: '완료 행사' })).toBeNull()
})
