// @vitest-environment jsdom
import { resetAddress } from '@/test-support/address-reset'
import { afterEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import {
  EVENT_SETTLEMENTS_LIMIT,
  type EventSettlementRow,
  type EventSettlementsResponse,
} from '@vada/contracts'
import { MEMBER_PERMISSIONS } from '@/test-support/council-fixtures'
import { eventSummary } from '@/test-support/event-fixtures'
import { BASE, serveFinance, showFinance } from '@/test-support/expense-harness'
import { COUNCIL_ID } from '@/test-support/finance-at'
import { SETTLEMENT_LOAD_FAILED } from '@/lib/messages'
import { json } from '@/test-support/mock-api'

afterEach(async () => {
  cleanup()
  await resetAddress()
  vi.unstubAllGlobals()
})

const SETTLEMENTS = `${BASE}/event-settlements`
const ids = {
  ended: '00000000-0000-4000-8000-0000000000a1',
  clean: '00000000-0000-4000-8000-0000000000a2',
  ongoing: '00000000-0000-4000-8000-0000000000a3',
  done: '00000000-0000-4000-8000-0000000000a4',
}

const row = (
  id: string,
  name: string,
  status: EventSettlementRow['event']['status'],
  settlement: EventSettlementRow['settlement'],
): EventSettlementRow => ({ event: eventSummary({ id, name, status }), settlement })

function response(overrides: Partial<EventSettlementsResponse> = {}): EventSettlementsResponse {
  return {
    period: { id: '00000000-0000-4000-8000-0000000000f1', name: '2026년 2학기' },
    events: [
      row(ids.ended, '봄 축제', 'ended', { remaining: 3, settled: false }),
      row(ids.clean, '체육 대회', 'ended', { remaining: 0, settled: true }),
      row(ids.ongoing, '전시', 'ongoing', { remaining: 1, settled: false }),
      row(ids.done, '개강 파티', 'completed', { remaining: 0, settled: true }),
    ],
    truncated: false,
    ...overrides,
  }
}

async function open(
  data: EventSettlementsResponse | null,
  permissions?: typeof MEMBER_PERMISSIONS,
) {
  const api = serveFinance()
  api.on('GET', SETTLEMENTS, () => (data ? json(data) : json({}, 500)))
  showFinance(permissions)
  fireEvent.click(screen.getByRole('tab', { name: '행사 정산' }))
  return api
}

const listed = () => screen.findByRole('list', { name: '행사 정산' })
const rowOf = (name: string) => {
  const item = screen.getByText(name).closest('li')
  if (!item) throw new Error(`줄이 없다: ${name}`)
  return within(item)
}

test('서버 차례대로 줄마다 행사 이름, 상태, 정산 남은 것 수가 있고 누르면 그 행사의 예산·정산이 열린다', async () => {
  await open(response())
  const list = await listed()
  expect(
    within(list)
      .getAllByRole('listitem')
      .map(item => item.textContent),
  ).toEqual([
    expect.stringContaining('봄 축제'),
    expect.stringContaining('체육 대회'),
    expect.stringContaining('전시'),
    expect.stringContaining('개강 파티'),
  ])
  expect(screen.getByText('2026년 2학기')).toBeTruthy()
  expect(rowOf('봄 축제').getByText('끝남')).toBeTruthy()
  expect(rowOf('봄 축제').getByText('정산 남은 것 3')).toBeTruthy()
  // 끝났고 남은 것이 없는 행사는 홈 '정산할 행사'와 같은 말이다.
  expect(rowOf('체육 대회').getByText('완료 가능')).toBeTruthy()
  expect(rowOf('전시').getByText('진행 중')).toBeTruthy()
  expect(rowOf('전시').getByText('정산 남은 것 1')).toBeTruthy()
  expect(rowOf('개강 파티').getByText('완료')).toBeTruthy()
  expect(rowOf('개강 파티').getByText('정산 남은 것 0')).toBeTruthy()
  fireEvent.click(rowOf('봄 축제').getByRole('button', { name: '봄 축제' }))
  await waitFor(() =>
    expect(`${window.location.pathname}${window.location.search}`).toBe(
      `/events/${COUNCIL_ID}/${ids.ended}?tab=money`,
    ),
  )
})

test('재정 역할이 아닌 운영진도 같은 목록을 보고 처리 버튼은 없다', async () => {
  await open(response(), MEMBER_PERMISSIONS)
  const list = await listed()
  expect(
    within(list)
      .getAllByRole('button')
      .map(button => button.textContent),
  ).toEqual(['봄 축제', '체육 대회', '전시', '개강 파티'])
  expect(screen.getByRole('tab', { name: '행사 정산' }).getAttribute('aria-selected')).toBe('true')
})

test('행사가 없으면 행사 없음이다', async () => {
  await open(response({ events: [] }))
  expect(await screen.findByText('행사 없음')).toBeTruthy()
})

test('넘친 목록은 상한을 알리고, 읽지 못하면 다시 시도할 수 있다', async () => {
  await open(response({ truncated: true }))
  expect(
    await screen.findByText(`행사가 많아서 ${EVENT_SETTLEMENTS_LIMIT}개만 보여요.`),
  ).toBeTruthy()
  cleanup()
  await resetAddress()
  const api = await open(null)
  expect(await screen.findByText(SETTLEMENT_LOAD_FAILED)).toBeTruthy()
  api.on('GET', SETTLEMENTS, () => json(response()))
  fireEvent.click(screen.getByRole('button', { name: '다시 시도' }))
  expect(await listed()).toBeTruthy()
})

test('긴 행사 이름은 줄을 넘지 않고 바뀐다', async () => {
  await open(
    response({
      events: [row(ids.ended, 'ㄱ'.repeat(100), 'ended', { remaining: 1, settled: false })],
    }),
  )
  await listed()
  expect(screen.getByRole('button', { name: 'ㄱ'.repeat(100) }).className).toContain(
    'wrap-anywhere',
  )
})
