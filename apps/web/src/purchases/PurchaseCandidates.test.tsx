// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { PurchaseCandidate } from '@vada/contracts'
import { json, mockApi } from '../test-support/mock-api'
import PurchaseCandidates from './PurchaseCandidates'
import { candidate } from './purchase-fixtures'
import { useCandidates } from './useCandidates'
import type { PurchaseResult } from './useEventPurchases'

afterEach(() => { cleanup(); vi.unstubAllGlobals() })
const base = '/api/organizations/o/events/e/purchase-candidates'
type HarnessProps = { onAdd?: (ids: string[]) => Promise<PurchaseResult>; onShowMessage?: (messageId: string) => void }
function Harness({ onAdd = async () => ({ ok: true, items: [] }), onShowMessage = () => {} }: HarnessProps) {
  const state = useCandidates('o', 'e', true, false)
  return <PurchaseCandidates candidates={state} generating={false} onAdd={onAdd} onShowMessage={onShowMessage} />
}
function setup(candidates: PurchaseCandidate[], props: HarnessProps = {}) {
  const api = mockApi()
  api.on('GET', base, () => json({ candidates, truncated: false }))
  render(<Harness {...props} />)
  return api
}
const share = (messageId: string, name = '기획 테스터') => ({ messageId, author: { id: 'u', name }, sharedAt: '2026-10-09T05:12:00.000Z' })

test('후보는 가격·칩·공유한 사람을 보여 주고, 고른 후보만 담는다', async () => {
  const onAdd = vi.fn(async () => ({ ok: true as const, items: [] }))
  setup([
    candidate({ id: 'c1', shareCount: 3, shares: [share('m1'), share('m2', '박해랑')], draftedByMe: true,
      requests: [{ requester: { id: 'q', name: '박해랑' }, quantity: 2, status: 'pending' }] }),
    candidate({ id: 'c2', lookup: 'pending', product: null, optionKnown: false, fetchedAt: null }),
    candidate({ id: 'c3', optionKnown: false, product: { ...candidate().product!, name: '옵션 모르는 상품', price: null, inStock: false } }),
  ], { onAdd })
  expect(await screen.findByText('모닝글로리 유성매직 12색')).toBeTruthy()
  expect(screen.getByText('조회 가격은 참고값이에요. 옵션·포장 단위와 배송비·최종 결제 금액을 확인해 주세요.')).toBeTruthy()
  expect(screen.getByText('예상 9,800원 · 10/9 기준')).toBeTruthy()
  expect(screen.getByText('요청됨 · 박해랑 · 2개')).toBeTruthy()
  expect(screen.getByText('내가 담음')).toBeTruthy()
  expect(screen.getByRole('button', { name: '기획 테스터 · 10월 9일 오후 2:12에 공유 · 외 2번' })).toBeTruthy()
  expect(screen.getByText('상품 정보를 불러오는 중…')).toBeTruthy()
  expect(screen.getByText('옵션 미정')).toBeTruthy()
  expect(screen.getByText('품절')).toBeTruthy()
  expect(screen.getByText('금액 확인 필요 · 10/9 기준')).toBeTruthy()
  expect(screen.getByRole('button', { name: '선택한 0개 담기' }).hasAttribute('disabled')).toBe(true)
  fireEvent.click(screen.getByRole('checkbox', { name: '모닝글로리 유성매직 12색 고르기' }))
  fireEvent.click(screen.getByRole('checkbox', { name: '상품 정보를 불러오는 중… 고르기' }))
  fireEvent.click(screen.getByRole('button', { name: '선택한 2개 담기' }))
  await waitFor(() => expect(onAdd).toHaveBeenCalledWith(['c1', 'c2']))
})

test('숨기면 되돌리기를 보여 주고, 숨긴 후보 목록에서 누가 숨겼는지 보이며 다시 보일 수 있다', async () => {
  const visible = candidate({ id: 'c1' })
  const hidden = { ...visible, hidden: { by: { id: 'u', name: '기획 테스터' }, at: '2026-10-09T05:12:00.000Z' } }
  const api = setup([visible])
  api.on('POST', `${base}/c1/hidden`, call => json({ candidate: (call.body as { hidden: boolean }).hidden ? hidden : visible }))
  fireEvent.click(await screen.findByRole('button', { name: '숨기기' }))
  expect(await screen.findByText('후보를 숨겼어요.')).toBeTruthy()
  expect(screen.queryByRole('checkbox', { name: '모닝글로리 유성매직 12색 고르기' })).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: '숨긴 후보 1' }))
  expect(screen.getByText('기획 테스터 · 10월 9일에 숨김')).toBeTruthy()
  expect(screen.getByRole('button', { name: '다시 보이기' })).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: '되돌리기' }))
  expect(await screen.findByRole('checkbox', { name: '모닝글로리 유성매직 12색 고르기' })).toBeTruthy()
  expect(api.calls.filter(call => call.method === 'POST').map(call => call.body)).toEqual([{ hidden: true }, { hidden: false }])
})

test('공유 표시를 누르면 그 메시지로 가고, 여러 번 공유됐으면 펼쳐 고른다', async () => {
  const onShowMessage = vi.fn()
  setup([candidate({ id: 'c1', shareCount: 2, shares: [share('m2', '박해랑'), share('m1')] })], { onShowMessage })
  fireEvent.click(await screen.findByRole('button', { name: '박해랑 · 10월 9일 오후 2:12에 공유 · 외 1번' }))
  expect(onShowMessage).toHaveBeenLastCalledWith('m2')
  fireEvent.click(screen.getByText('공유 2번'))
  fireEvent.click(screen.getByRole('button', { name: '기획 테스터 · 10월 9일 오후 2:12에 공유' }))
  expect(onShowMessage).toHaveBeenLastCalledWith('m1')
})

test('후보가 없으면 대화에 링크를 올리라고 안내한다', async () => {
  setup([])
  expect(await screen.findByText('아직 올라온 쿠팡 링크가 없어요')).toBeTruthy()
  expect(screen.getByText('대화에 쿠팡 상품 링크를 올리면 여기에 모여요.')).toBeTruthy()
  expect(screen.queryByRole('button', { name: /담기$/ })).toBeNull()
})

test('후보를 불러오지 못하면 알리고 다시 시도한다', async () => {
  const api = mockApi()
  api.on('GET', base, () => json({ error: 'X' }, 500))
  render(<Harness />)
  expect(await screen.findByText('후보를 불러오지 못했어요.')).toBeTruthy()
  api.on('GET', base, () => json({ candidates: [candidate()], truncated: false }))
  fireEvent.click(screen.getByRole('button', { name: '다시 시도' }))
  expect(await screen.findByText('모닝글로리 유성매직 12색')).toBeTruthy()
})

test('긴 상품명·주소·이름은 카드 안에서 줄을 바꾼다', async () => {
  const long = '가'.repeat(120)
  setup([candidate({ id: 'c1', product: { ...candidate().product!, name: long }, shares: [share('m1', '이'.repeat(60))] }),
    candidate({ id: 'c2', lookup: 'failed', product: null,
      url: `https://www.coupang.com/vp/products/1?itemId=${'2'.repeat(20)}&vendorItemId=${'3'.repeat(20)}` })])
  expect((await screen.findByText(long)).className).toContain('wrap-anywhere')
  expect(screen.getByText(/^https:\/\/www\.coupang\.com/).className).toContain('wrap-anywhere')
  expect(screen.getByRole('button', { name: /^이+ · / }).className).toContain('wrap-anywhere')
})
