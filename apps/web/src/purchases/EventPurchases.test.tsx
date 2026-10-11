// @vitest-environment jsdom
import { useState } from 'react'
import { afterEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { PurchaseItemSummary } from '@vada/contracts'
import { json, mockApi } from '../test-support/mock-api'
import EventPurchases, { type PurchaseView } from './EventPurchases'
import { candidate, item } from './purchase-fixtures'
import { addDays, todayInSeoul } from './purchase-view'
import { useCandidates } from './useCandidates'
import { useEventPurchases } from './useEventPurchases'

afterEach(() => { cleanup(); vi.unstubAllGlobals() })
const base = '/api/organizations/o/events/e/purchase-items'
const candidatesBase = '/api/organizations/o/events/e/purchase-candidates'
function Harness({ initialView = 'mine', readOnly }: { initialView?: PurchaseView; readOnly?: boolean }) {
  const state = useEventPurchases('o', 'e', true)
  const candidates = useCandidates('o', 'e', true, false)
  const [view, setView] = useState<PurchaseView>(initialView)
  return <EventPurchases state={state} candidates={candidates} view={view} onViewChange={setView} onShowMessage={() => {}} readOnly={readOnly} />
}
function setup(items: PurchaseItemSummary[], initialView: PurchaseView = 'mine', candidates = [candidate()], readOnly = false) {
  const api = mockApi()
  api.on('GET', base, () => json({ items, truncated: false }))
  api.on('GET', candidatesBase, () => json({ candidates, truncated: false }))
  render(<Harness initialView={initialView} readOnly={readOnly} />)
  return api
}
const lastBody = (api: ReturnType<typeof mockApi>) => api.calls.at(-1)?.body

test('내 품목은 작성 중·진행 중·끝남으로 나누고, 행사 전체는 제출된 품목을 요청자와 함께 보여 준다', async () => {
  const api = setup([
    item({ id: 'd1', productName: '유성매직' }),
    item({ id: 'p1', productName: '박스테이프', status: 'pending', submissionId: 's1' }),
    item({ id: 'x1', productName: '이름표', status: 'rejected', submissionId: 's1', decisionReason: '규격 확인 필요' }),
    item({ id: 'o1', productName: '생수', status: 'approved', submissionId: 's2', mine: false, requester: { id: 'q', name: '다른 기획' },
      departmentName: '홍보부', purchasedAt: '2026-10-08T06:00:00Z' }),
  ])
  expect(within(await screen.findByRole('region', { name: '작성 중' })).getByText('유성매직')).toBeTruthy()
  expect(within(screen.getByRole('region', { name: '진행 중' })).getByText('박스테이프')).toBeTruthy()
  const ended = screen.getByRole('region', { name: '끝남' })
  expect(within(ended).getByText('반려 사유: 규격 확인 필요')).toBeTruthy()
  expect(within(ended).getByRole('button', { name: '다시 담기' })).toBeTruthy()
  expect(screen.queryByText('생수')).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: '행사 전체' }))
  expect(screen.queryByText('유성매직')).toBeNull()
  expect(screen.getByText('다른 기획 · 홍보부')).toBeTruthy()
  expect(screen.getByRole('button', { name: '받았어요' })).toBeTruthy()
  api.assertNoUnexpectedRequests()
})

test('고른 작성 중 품목을 제출하고, 채울 칸이 남은 품목이 섞이면 제출을 막는다', async () => {
  const api = setup([item({ id: 'd1', productName: '유성매직' }), item({ id: 'd2', productName: '박스테이프', quantity: null })])
  fireEvent.click(await screen.findByRole('checkbox', { name: '모두 선택' }))
  expect(screen.getByText('제출 전에 채울 칸이 있는 품목이 있어요.')).toBeTruthy()
  expect(screen.getByRole('button', { name: '선택한 2개 제출' }).hasAttribute('disabled')).toBe(true)
  fireEvent.click(screen.getByRole('checkbox', { name: '박스테이프 고르기' }))
  api.on('POST', `${base}/submit`, () => json({ items: [item({ id: 'd1', productName: '유성매직', status: 'pending', version: 2, submissionId: 's1' })] }))
  fireEvent.click(screen.getByRole('button', { name: '선택한 1개 제출' }))
  expect(await within(await screen.findByRole('region', { name: '진행 중' })).findByText('유성매직')).toBeTruthy()
  expect(lastBody(api)).toEqual({ items: [{ id: 'd1', version: 1 }] })
  api.assertNoUnexpectedRequests()
})

test('받을 날짜 대화상자의 빠른 버튼은 한국 날짜로 바꿔 저장한다', async () => {
  const api = setup([item({ id: 'd1', productName: '유성매직' })])
  fireEvent.click(await screen.findByRole('checkbox', { name: '유성매직 고르기' }))
  fireEvent.click(screen.getByRole('button', { name: '받을 날짜 바꾸기' }))
  const dialog = await screen.findByRole('dialog', { name: '받을 날짜' })
  fireEvent.click(within(dialog).getByRole('button', { name: '1주 안' }))
  const date = addDays(todayInSeoul(), 7)
  api.on('POST', `${base}/needed-by`, () => json({ items: [item({ id: 'd1', productName: '유성매직', version: 2, neededBy: date })] }))
  fireEvent.click(within(dialog).getByRole('button', { name: '저장' }))
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  expect(lastBody(api)).toEqual({ items: [{ id: 'd1', version: 1 }], neededBy: date })
  const [, month, day] = date.split('-')
  expect(screen.getByText(`용도: 부스 안내판 · 받을 날짜: ${Number(month)}월 ${Number(day)}일까지`)).toBeTruthy()
})

test('수정 대화상자는 빈 칸을 모르는 값으로 저장하고, 잘못된 값이면 저장을 막는다', async () => {
  const api = setup([item({ id: 'd1', productName: '유성매직' })])
  fireEvent.click(await screen.findByRole('button', { name: '수정' }))
  const dialog = await screen.findByRole('dialog', { name: '품목 수정' })
  fireEvent.change(within(dialog).getByLabelText('수량'), { target: { value: '0' } })
  expect(within(dialog).getByRole('button', { name: '저장' }).hasAttribute('disabled')).toBe(true)
  fireEvent.change(within(dialog).getByLabelText('수량'), { target: { value: '5' } })
  fireEvent.change(within(dialog).getByLabelText('선택 옵션'), { target: { value: '  ' } })
  fireEvent.change(within(dialog).getByLabelText('용도'), { target: { value: '계주 바통' } })
  api.on('PATCH', `${base}/d1`, () => json({ items: [item({ id: 'd1', productName: '유성매직', version: 2, quantity: 5, selectedOption: null, note: '계주 바통' })] }))
  fireEvent.click(within(dialog).getByRole('button', { name: '저장' }))
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  expect(lastBody(api)).toMatchObject({ version: 1, quantity: 5, selectedOption: null, note: '계주 바통', optionRequired: true })
  expect(screen.getByText('제출 전 확인: 선택 옵션')).toBeTruthy()
})

test('작성 중 품목은 확인한 뒤에만 지운다', async () => {
  const api = setup([item({ id: 'd1', productName: '유성매직' })])
  fireEvent.click(await screen.findByRole('button', { name: '지우기' }))
  const dialog = await screen.findByRole('dialog', { name: '작성 중 품목을 지울까요?' })
  api.on('POST', `${base}/d1/delete`, () => json({ items: [] }))
  fireEvent.click(within(dialog).getByRole('button', { name: '지우기' }))
  expect(await screen.findByText('아직 담은 품목이 없어요')).toBeTruthy()
  expect(lastBody(api)).toEqual({ version: 1 })
})

test('먼저 바뀐 품목이면 안내하고 목록을 새로 불러온다. 다시 담기와 받았어요를 보낸다', async () => {
  const api = setup([
    item({ id: 'p1', productName: '박스테이프', status: 'pending', submissionId: 's1', version: 2 }),
    item({ id: 'x1', productName: '이름표', status: 'cancelled', submissionId: 's1', version: 3 }),
    item({ id: 'b1', productName: '생수', status: 'approved', submissionId: 's2', version: 4, purchasedAt: '2026-10-08T06:00:00Z' }),
  ])
  api.on('POST', `${base}/p1/cancel`, () => json({ error: 'INVALID_STATE' }, 409))
  fireEvent.click(await screen.findByRole('button', { name: '요청 취소' }))
  expect(await screen.findByText('지금 상태에서는 할 수 없어요. 목록을 새로 불러왔어요.')).toBeTruthy()
  await waitFor(() => expect(api.calls.filter(call => call.method === 'GET' && call.path === base)).toHaveLength(2))
  api.on('POST', `${base}/x1/re-add`, () => json({ items: [item({ id: 'x1', productName: '이름표', status: 'cancelled', submissionId: 's1', version: 4 }),
    item({ id: 'n1', productName: '이름표' })] }))
  fireEvent.click(screen.getByRole('button', { name: '다시 담기' }))
  expect(await within(await screen.findByRole('region', { name: '작성 중' })).findByText('이름표')).toBeTruthy()
  api.on('POST', `${base}/b1/received`, () => json({ items: [item({ id: 'b1', productName: '생수', status: 'approved', submissionId: 's2', version: 5,
    purchasedAt: '2026-10-08T06:00:00Z', receivedAt: '2026-10-08T07:00:00Z', receivedBy: { id: 'u', name: '기획 테스터' } })] }))
  fireEvent.click(screen.getByRole('button', { name: '받았어요' }))
  expect(await within(await screen.findByRole('region', { name: '끝남' })).findByText('생수')).toBeTruthy()
  expect(lastBody(api)).toEqual({ version: 4, received: true })
})

test('품목을 누르면 근거 대화와 처리 기록을 보여 주고, 본인 결정은 따로 표시한다', async () => {
  const approved = item({ id: 'a1', productName: '생수', status: 'approved', submissionId: 's1', decidedBy: { id: 'u', name: '기획 테스터' } })
  const api = setup([approved])
  api.on('GET', `${base}/a1`, () => json({ item: { ...approved,
    sources: [{ id: 'm', content: '생수 10박스', authorName: '기획 테스터', createdAt: '2026-10-08T05:00:00Z' }],
    history: [{ id: 'h1', action: 'submitted', actor: { id: 'u', name: '기획 테스터' }, reason: null, changes: {}, createdAt: '2026-10-08T05:00:00Z' },
      { id: 'h2', action: 'approved', actor: { id: 'u', name: '기획 테스터' }, reason: null, changes: {}, createdAt: '2026-10-08T06:00:00Z' }] } }))
  fireEvent.click(await screen.findByRole('button', { name: '생수' }))
  const dialog = await screen.findByRole('dialog', { name: '생수' })
  expect(await within(dialog).findByText('생수 10박스')).toBeTruthy()
  expect(within(within(dialog).getByRole('region', { name: '처리 기록' })).getByText('본인 승인')).toBeTruthy()
})

test('대화상자에서 먼저 바뀐 품목이면 대화상자를 닫고 안내한다. 다시 열면 새로 불러온 버전으로 저장한다', async () => {
  const pending = item({ id: 'p1', productName: '박스테이프', status: 'pending', submissionId: 's1', version: 2 })
  const api = setup([pending])
  fireEvent.click(await screen.findByRole('button', { name: '날짜' }))
  const dialog = await screen.findByRole('dialog', { name: '받을 날짜' })
  api.on('POST', `${base}/needed-by`, () => json({ error: 'VERSION_CONFLICT' }, 409))
  api.on('GET', base, () => json({ items: [{ ...pending, status: 'approved', version: 3 }], truncated: false }))
  fireEvent.click(within(dialog).getByRole('button', { name: '1주 안' }))
  fireEvent.click(within(dialog).getByRole('button', { name: '저장' }))
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  expect(screen.getByText('다른 곳에서 먼저 바뀌었어요. 목록을 새로 불러왔어요.')).toBeTruthy()
  expect(await screen.findByText('승인')).toBeTruthy()
  const date = addDays(todayInSeoul(), 7)
  api.on('POST', `${base}/needed-by`, () => json({ items: [{ ...pending, status: 'approved', version: 4, neededBy: date }] }))
  fireEvent.click(screen.getByRole('button', { name: '날짜' }))
  const again = await screen.findByRole('dialog', { name: '받을 날짜' })
  fireEvent.click(within(again).getByRole('button', { name: '1주 안' }))
  fireEvent.click(within(again).getByRole('button', { name: '저장' }))
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  expect(lastBody(api)).toEqual({ items: [{ id: 'p1', version: 3 }], neededBy: date })
})

test('작성 중 품목에는 가격이 조회한 참고값이라고 안내하고 금액에 예상을 붙인다', async () => {
  setup([item({ id: 'd1', productName: '유성매직' })])
  expect(await screen.findByText('조회 가격은 참고값이에요. 옵션·포장 단위와 배송비·최종 결제 금액을 확인해 주세요.')).toBeTruthy()
  expect(screen.getByText('12색 · 2개 · 예상 9,800원')).toBeTruthy()
})

test('후보 보기에서 골라 담으면 내 품목으로 가서 담았다고 알리고 후보를 새로 불러온다', async () => {
  const api = setup([], 'candidates')
  api.on('POST', `${base}/drafts`, () => json({ items: [item({ id: 'd1', productName: '유성매직' })] }, 201))
  fireEvent.click(await screen.findByRole('checkbox', { name: '모닝글로리 유성매직 12색 고르기' }))
  fireEvent.click(screen.getByRole('button', { name: '선택한 1개 담기' }))
  expect(await screen.findByText('1개를 담았어요. 확인하고 제출해 주세요.')).toBeTruthy()
  expect(screen.getByRole('button', { name: '내 품목' }).getAttribute('aria-pressed')).toBe('true')
  expect(api.calls.find(call => call.path === `${base}/drafts`)?.body).toEqual({ idempotencyKey: expect.any(String), candidateIds: ['c1'] })
  await waitFor(() => expect(api.calls.filter(call => call.method === 'GET' && call.path === candidatesBase)).toHaveLength(2))
})

test('제출 응답에서 가격이 바뀐 품목을 알린다', async () => {
  const api = setup([item({ id: 'd1', productName: '유성매직' })])
  fireEvent.click(await screen.findByRole('checkbox', { name: '유성매직 고르기' }))
  api.on('POST', `${base}/submit`, () => json({ items: [item({ id: 'd1', productName: '유성매직', status: 'pending', version: 2,
    submissionId: 's1', estimatedUnitPrice: 5200 })] }))
  fireEvent.click(screen.getByRole('button', { name: '선택한 1개 제출' }))
  expect(await screen.findByText('가격이 바뀐 품목이 있어 새 가격으로 제출했어요.')).toBeTruthy()
  expect(screen.getByText('유성매직 4,900원 → 5,200원')).toBeTruthy()
})

test('담은 품목이 없으면 후보에서 골라 담으라고 안내한다', async () => {
  setup([])
  expect(await screen.findByText('아직 담은 품목이 없어요')).toBeTruthy()
  expect(screen.getByText('후보에서 골라 담아 보세요.')).toBeTruthy()
  expect(screen.queryByRole('button', { name: '끼룩이로 담기' })).toBeNull()
})

test('완료한 행사의 구매는 보기만 한다: 고르기·제출·품목 단추가 없다', async () => {
  setup([
    item({ id: 'd1', productName: '유성매직' }),
    item({ id: 'p1', productName: '박스테이프', status: 'pending', submissionId: 's1' }),
    item({ id: 'x1', productName: '이름표', status: 'rejected', submissionId: 's1', decisionReason: '규격 확인 필요' }),
    item({ id: 'a1', productName: '생수', status: 'approved', submissionId: 's2', purchasedAt: '2026-10-08T06:00:00Z' }),
  ], 'mine', [candidate()], true)
  expect(within(await screen.findByRole('region', { name: '작성 중' })).getByText('유성매직')).toBeTruthy()
  expect(screen.queryAllByRole('checkbox')).toEqual([])
  for (const name of ['수정', '지우기', '요청 취소', '다시 담기', '받았어요', '날짜', /제출/, '받을 날짜 바꾸기']) {
    expect(screen.queryByRole('button', { name })).toBeNull()
  }
})
