// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { EventRecordView } from './EventRecordView'
import {
  RECORD_COUNCIL,
  RECORD_EVENT,
  RECORD_MEETING,
  RECORD_NOW,
  recordSample,
} from './test-support/record-samples'

afterEach(() => {
  cleanup()
  window.history.replaceState(null, '', '/')
  vi.restoreAllMocks()
})

function show(record = recordSample()) {
  render(<EventRecordView councilId={RECORD_COUNCIL} record={record} now={RECORD_NOW} />)
}

const section = (name: string) => screen.getByRole('region', { name })

test('머리는 행사명, 기간, 담당, 완료 처리일과 완료한 사람이다', () => {
  show()
  const head = screen.getByRole('group', { name: '행사 기록 머리' })
  expect(within(head).getByRole('heading', { name: '가을 축제 학생회 부스' })).toBeTruthy()
  expect(head.textContent).toContain('10월 17일 (토) 11:00 ~ 17:00')
  expect(head.textContent).toContain('담당 기획부, 대외협력부 · 이기획')
  expect(head.textContent).toContain('완료 처리 10월 24일 (토) · 김회장')
})

test('목차와 본문 대목은 개요·성과·타임라인·근거 자료 넷이고, 살(현장 운영·회고·인수인계·발행)은 없다', () => {
  show()
  const toc = screen.getByRole('navigation', { name: '목차' })
  expect(
    within(toc)
      .getAllByRole('button')
      .map(item => item.textContent),
  ).toEqual(['개요', '성과', '타임라인', '근거 자료'])
  for (const name of ['개요', '성과', '타임라인', '근거 자료']) expect(section(name)).toBeTruthy()
  expect(screen.queryByText(/현장 운영|회고|인수인계|발행/)).toBeNull()
})

test('목차를 누르면 그 대목으로 옮기고 그 칸을 강조한다', () => {
  const scroll = vi.fn()
  Element.prototype.scrollIntoView = scroll
  show()
  const toc = screen.getByRole('navigation', { name: '목차' })
  expect(within(toc).getByRole('button', { name: '개요' }).getAttribute('aria-current')).toBe(
    'true',
  )
  fireEvent.click(within(toc).getByRole('button', { name: '타임라인' }))
  expect(scroll).toHaveBeenCalledTimes(1)
  expect(scroll.mock.contexts[0]).toBe(section('타임라인'))
  expect(within(toc).getByRole('button', { name: '타임라인' }).getAttribute('aria-current')).toBe(
    'true',
  )
  expect(within(toc).getByRole('button', { name: '개요' }).getAttribute('aria-current')).toBeNull()
})

test('개요는 일시, 장소, 담당 부서, 책임자, 완료 처리다', () => {
  show()
  const text = section('개요').textContent
  expect(text).toContain('10월 17일 (토) 11:00 ~ 17:00')
  expect(text).toContain('학생회관 앞 잔디밭')
  expect(text).toContain('기획부, 대외협력부')
  expect(text).toContain('이기획')
  expect(text).toContain('10월 24일 (토) · 김회장')
})

test('성과는 신청·취소·출석·출석률, 예산·실제·차이·집행률, 업무 끝남/전체를 서버 값 그대로 보인다', () => {
  show()
  const text = section('성과').textContent
  expect(text).toContain('신청 215 · 취소 5 · 출석 186 · 출석률 89%')
  expect(text).toContain('예산 1,200,000원 · 실제 1,104,000원 · 차이 96,000원 · 집행률 92%')
  expect(text).toContain('끝남 14 / 전체 16')
})

test('비율이 없으면(분모 0) 그 칸을 빼고, 예산을 넘긴 차이는 음수다', () => {
  show(
    recordSample({
      outcome: {
        registrations: { total: 0, cancelled: 0, attended: 0, rate: null },
        money: { budget: 0, actual: 30000, difference: -30000, rate: null },
        tasks: { done: 0, total: 0 },
      },
    }),
  )
  const text = section('성과').textContent
  expect(text).toContain('신청 0 · 취소 0 · 출석 0')
  expect(text).not.toContain('출석률')
  expect(text).toContain('예산 0원 · 실제 30,000원 · 차이 -30,000원')
  expect(text).not.toContain('집행률')
})

test('타임라인은 시각순 줄이고 회의 줄을 누르면 그 회의로 간다', () => {
  show()
  const rows = within(section('타임라인')).getAllByRole('listitem')
  expect(rows.map(row => row.textContent)).toEqual([
    expect.stringContaining('행사 만듦'),
    expect.stringContaining('일시·장소 변경'),
    expect.stringContaining('부스 운영 점검 회의'),
    expect.stringContaining('완료'),
  ])
  expect(rows[0]!.textContent).toContain('9월 20일 (일) 10:00')
  expect(rows[0]!.textContent).toContain('이기획')
  fireEvent.click(within(rows[2]!).getByRole('button', { name: /부스 운영 점검 회의/ }))
  expect(window.location.pathname).toBe(`/meetings/${RECORD_COUNCIL}/${RECORD_MEETING}`)
})

test.each([
  ['업무 16건', 'tasks'],
  ['회의 3건', 'meetings'],
  ['구매 요청 6건', 'money'],
])('근거 자료 %s를 누르면 그 행사의 %s 탭으로 간다', (name, tab) => {
  show()
  fireEvent.click(within(section('근거 자료')).getByRole('button', { name }))
  expect(window.location.pathname + window.location.search).toBe(
    `/events/${RECORD_COUNCIL}/${RECORD_EVENT}?tab=${tab}`,
  )
})
