// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { EVENT_LIST_LIMIT } from '@vada/contracts'
import { RecordEventList } from './RecordEventList'
import { RECORD_NOW, recordItem } from './test-support/record-samples'

afterEach(cleanup)

const a = recordItem({ id: 'a', name: '가을 축제 학생회 부스' })
const b = recordItem({
  id: 'b',
  name: '봄 축제',
  startsAt: '2026-10-25T10:00',
  endsAt: null,
  departments: [],
  owner: null,
  completedAt: '2026-10-20T06:00:00.000Z',
  chips: { attended: 0, applied: 0, budget: 0, actual: 0, executionRate: null, tasksDone: 0 },
})

function show(events = [a, b], truncated = false) {
  const onOpen = vi.fn()
  render(<RecordEventList events={events} truncated={truncated} now={RECORD_NOW} onOpen={onOpen} />)
  return onOpen
}

const cards = () =>
  within(screen.getByRole('list', { name: '완료된 행사 목록' })).getAllByRole('listitem')

test('카드는 완료 배지, 행사명, 일시, 담당, 성과 칩 셋, 완료 처리일을 보인다', () => {
  show()
  const first = cards()[0]!
  const text = first.textContent
  expect(within(first).getByText('완료')).toBeTruthy()
  expect(within(first).getByRole('heading', { name: '가을 축제 학생회 부스' })).toBeTruthy()
  expect(text).toContain('10월 17일 (토) 11:00 ~ 17:00')
  expect(text).toContain('담당 기획부, 대외협력부 · 이기획')
  expect(text).toContain('참석 186명 (신청 210명)')
  expect(text).toContain('예산 집행 92%')
  expect(text).toContain('완료 업무 14건')
  expect(text).toContain('완료 처리 10월 24일 (토)')
})

test('담당이 없으면 미정, 예산이 없으면 예산 없음 칩이다', () => {
  show()
  const text = cards()[1]!.textContent
  expect(text).toContain('담당 미정 · 미정')
  expect(text).toContain('예산 없음')
  expect(text).toContain('참석 0명 (신청 0명)')
})

test('기록 상태 배지와 미발행 안내, 설명 글은 없다(DEC-110 살)', () => {
  show()
  expect(screen.queryByText(/미발행|발행 v|인수인계/)).toBeNull()
})

test('[상세 보기]를 누르면 그 행사를 연다', () => {
  const onOpen = show()
  fireEvent.click(within(cards()[1]!).getByRole('button', { name: /상세 보기/ }))
  expect(onOpen).toHaveBeenCalledWith('b')
})

test('행사명으로 찾고, 맞는 것이 없으면 결과 없음이다', () => {
  show()
  const search = screen.getByRole('searchbox', { name: '행사명 찾기' })
  fireEvent.change(search, { target: { value: '봄' } })
  expect(cards().map(card => card.querySelector('h3')?.textContent)).toEqual(['봄 축제'])
  fireEvent.change(search, { target: { value: '겨울' } })
  expect(screen.getByText('결과 없음')).toBeTruthy()
})

test('정렬은 완료 처리일순이 기본이고 행사 일시순으로 바꾼다', () => {
  show()
  const sort = screen.getByRole('combobox', { name: '정렬' }) as HTMLSelectElement
  expect(sort.value).toBe('completed')
  expect(cards().map(card => card.querySelector('h3')?.textContent)).toEqual([
    '가을 축제 학생회 부스',
    '봄 축제',
  ])
  fireEvent.change(sort, { target: { value: 'date' } })
  expect(cards().map(card => card.querySelector('h3')?.textContent)).toEqual([
    '봄 축제',
    '가을 축제 학생회 부스',
  ])
})

test('완료한 행사가 없으면 빈 상태 한 줄이다', () => {
  show([])
  expect(screen.getByText('완료된 행사 없음')).toBeTruthy()
  expect(screen.queryByRole('searchbox')).toBeNull()
})

test('목록이 잘렸으면 행사 목록처럼 알린다', () => {
  show([a], true)
  expect(screen.getByText(`행사가 많아서 ${EVENT_LIST_LIMIT}개만 보여요.`)).toBeTruthy()
})
