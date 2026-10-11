// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { json, mockApi } from '../test-support/mock-api'
import { event } from '../test-support/workflow-fixtures'
import Records from './Records'
import { facts } from './record-fixtures'

afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks() })
const path = '/api/organizations/o/records'
const done = { ...event(), name: '새내기 배움터', completedAt: '2026-03-11T01:00:00.000Z' }

test('완료한 행사마다 결과보고서 상태, 날짜·담당, 숫자, 완료한 날을 보이고 누르면 연다', async () => {
  const api = mockApi()
  api.on('GET', path, () => json({ records: [
    { event: done, report: { status: 'published', publishedAt: '2026-03-13T01:00:00.000Z' },
      facts: facts({ event: { ...facts().event, startsAt: '2026-03-06T10:00' } }) },
    { event: { ...done, id: 'e9', name: '개강총회' }, report: { status: 'draft', publishedAt: null },
      facts: facts({ owner: { department: null, person: '정민재' }, registrations: null }) },
    { event: { ...done, id: 'e8', name: '간식 나눔' }, report: null,
      facts: facts({ event: { ...facts().event, startsAt: null }, owner: { department: null, person: null } }) },
  ] }))
  const onOpen = vi.fn()
  render(<Records organizationId="o" onOpen={onOpen} />)
  const list = await screen.findByRole('list', { name: '완료한 행사' })
  const [first, second, third] = within(list).getAllByRole('article')
  expect(within(first!).getByText('발행')).toBeTruthy()
  expect(within(first!).getByText('2026. 3. 6. · 기획부')).toBeTruthy()
  expect(within(first!).getByText('참석 22명 (신청 26명)')).toBeTruthy()
  expect(within(first!).getByText('예산 집행 73%')).toBeTruthy()
  expect(within(first!).getByText('완료 업무 3건')).toBeTruthy()
  expect(within(first!).getByText('완료 2026. 3. 11.')).toBeTruthy()
  expect(within(second!).getByText('작성 중')).toBeTruthy()
  expect(within(second!).getByText('2026. 9. 26. · 정민재')).toBeTruthy()
  expect(within(third!).getByText('작성 전')).toBeTruthy()
  expect(within(third!).getByText('날짜 미정')).toBeTruthy()
  fireEvent.click(within(second!).getByRole('button', { name: '개강총회' }))
  expect(onOpen).toHaveBeenCalledWith(expect.objectContaining({ id: 'e9' }))
})

test('없으면 빈 상태, 못 받으면 다시 불러오기를 보인다', async () => {
  const api = mockApi()
  api.on('GET', path, () => json({ records: [] }))
  render(<Records organizationId="o" onOpen={vi.fn()} />)
  expect(await screen.findByText('완료한 행사가 아직 없어요')).toBeTruthy()
  cleanup()
  const failing = mockApi()
  failing.on('GET', path, () => json({ error: 'FORBIDDEN' }, 403))
  render(<Records organizationId="o" onOpen={vi.fn()} />)
  expect(await screen.findByText('기록을 불러오지 못했어요.')).toBeTruthy()
  expect(screen.getByRole('button', { name: '다시 불러오기' })).toBeTruthy()
})
