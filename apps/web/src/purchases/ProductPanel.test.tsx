// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { readCoupangUrl, type PurchaseCandidate } from '@vada/contracts'
import ProductPanel from './ProductPanel'
import { candidate } from './purchase-fixtures'
import type { Candidates } from './useCandidates'

afterEach(cleanup)
const link = { ...readCoupangUrl('https://www.coupang.com/vp/products/1?itemId=2&vendorItemId=3')!, start: 0, end: 0 }
const state = (candidates: PurchaseCandidate[] | null, { loads = 0, loadError = false } = {}): Candidates =>
  ({ candidates, truncated: false, loadError, loads, busy: false, refresh: vi.fn(), setHidden: vi.fn() })

test('링크 패널은 후보의 상품 정보를 오른쪽에 보여 주고 닫을 수 있다', async () => {
  const onClose = vi.fn()
  render(<ProductPanel link={link} onClose={onClose}
    candidates={state([candidate({ product: { ...candidate().product!, listPrice: 12000, discountPercent: 18 } })])} />)
  const panel = await screen.findByRole('dialog', { name: '모닝글로리 유성매직 12색' })
  expect(panel.className).toContain('right-0')
  expect(within(panel).getByText('예상 9,800원 · 10/9 기준')).toBeTruthy()
  expect(within(panel).getByText('정가 12,000원 · 18% 할인')).toBeTruthy()
  expect(within(panel).getByText('도착 예정: 내일(금) 도착 예정')).toBeTruthy()
  expect(within(panel).getByRole('link', { name: '쿠팡에서 보기' }).getAttribute('href')).toBe(link.url)
  fireEvent.click(within(panel).getByRole('button', { name: '패널 닫기' }))
  expect(onClose).toHaveBeenCalled()
})

test('후보를 아직 못 찾았거나, 조회가 실패했거나, 옵션을 모르면 그렇게 알린다', async () => {
  const view = render(<ProductPanel link={link} candidates={state(null)} onClose={() => {}} />)
  expect(await screen.findByText('상품 정보를 불러오는 중…')).toBeTruthy()
  view.rerender(<ProductPanel link={link} candidates={state([candidate({ lookup: 'failed', product: null })])} onClose={() => {}} />)
  expect(await screen.findByText('상품 정보를 가져오지 못했어요. 쿠팡에서 확인해 주세요.')).toBeTruthy()
  view.rerender(<ProductPanel link={link} onClose={() => {}}
    candidates={state([candidate({ optionKnown: false, product: { ...candidate().product!, price: null } })])} />)
  expect(await screen.findByText('옵션 미정')).toBeTruthy()
})

test('패널을 연 뒤 새로 받은 후보 목록에도 링크가 없거나 목록을 못 불러오면 쿠팡에서 확인하라고 알린다', async () => {
  const failed = '상품 정보를 가져오지 못했어요. 쿠팡에서 확인해 주세요.'
  const view = render(<ProductPanel link={link} candidates={state([], { loads: 1 })} onClose={() => {}} />)
  expect(await screen.findByText('상품 정보를 불러오는 중…')).toBeTruthy()
  view.rerender(<ProductPanel link={link} candidates={state([], { loads: 2 })} onClose={() => {}} />)
  expect(await screen.findByText(failed)).toBeTruthy()
  view.rerender(<ProductPanel link={null} candidates={state([], { loads: 2 })} onClose={() => {}} />)
  view.rerender(<ProductPanel link={link} candidates={state(null, { loadError: true })} onClose={() => {}} />)
  expect(await screen.findByText(failed)).toBeTruthy()
})
