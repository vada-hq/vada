import { expect, test } from 'vitest'
import { scheduleDetail } from '@/test-support/schedule-fixtures'
import { googleCalendarUrl } from './google-calendar'

const vadaUrl = 'https://vada.example/schedule/council/item'
const queryOf = (extra: Parameters<typeof scheduleDetail>[0] = {}) =>
  new URL(googleCalendarUrl(scheduleDetail(extra), vadaUrl)).searchParams

test('Google 템플릿은 제목·장소·메모와 원본 주소를 인코딩한다', () => {
  const url = new URL(googleCalendarUrl(scheduleDetail({ title: '답사 & 회의 / 점검' }), vadaUrl))
  expect(url.origin + url.pathname).toBe('https://calendar.google.com/calendar/render')
  expect(url.searchParams.get('action')).toBe('TEMPLATE')
  expect(url.searchParams.get('text')).toBe('답사 & 회의 / 점검')
  expect(url.searchParams.get('location')).toBe('학생회관')
  expect(url.searchParams.get('details')).toBe(`출입구 확인\n${vadaUrl}`)
  expect(url.searchParams.get('ctz')).toBe('Asia/Seoul')
})

test.each([
  [{}, '20261028/20261029'],
  [{ end: '2026-10-31' }, '20261028/20261101'],
  [{ start: '2026-12-31' }, '20261231/20270101'],
  [
    { allDay: false, start: '2026-10-28T14:00', end: '2026-10-28T16:30' },
    '20261028T140000/20261028T163000',
  ],
  [{ allDay: false, start: '2026-10-31T23:30' }, '20261031T233000/20261101T003000'],
])('종일 끝은 다음 날, 시각 끝이 없으면 한 시간이다: %j', (extra, expected) => {
  expect(queryOf(extra).get('dates')).toBe(expected)
})

test('메모와 장소가 없으면 메모에는 원본 주소만 둔다', () => {
  const query = queryOf({ memo: null, place: null })
  expect(query.get('details')).toBe(vadaUrl)
  expect(query.get('location')).toBe('')
})
