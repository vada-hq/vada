// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { PurchaseDetail } from '@vada/contracts'
import Purchases from './Purchases'

afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks() })
const props = { organizationId: 'o', eventId: 'e' }
const link = 'https://www.coupang.com/vp/products/1?itemId=2&vendorItemId=3'
const draft = (): PurchaseDetail => ({ id: 'r', organizationId: 'o', eventId: 'e', requesterId: 'u', departmentId: 'd',
  purpose: '접수용', neededBy: '2026-10-09', estimatedShippingCost: null, status: 'draft', version: 1,
  createdAt: '2026-09-29T00:00:00Z', updatedAt: '2026-09-29T00:00:00Z', estimatedTotal: null,
  warnings: [], sources: [{ id: 'm', content: '테이블 2개 준비', authorId: 'u', createdAt: '2026-09-29T00:00:00Z' }],
  history: [], items: [{ id: 'i', position: 0, productUrl: link, productName: '테이블', selectedOption: '무광화이트',
    optionRequired: true, quantity: 2, packagingUnit: null, estimatedUnitPrice: 11590, productSnapshot: { price: 11590 }, productFetchedAt: '2026-09-29T00:00:00Z' }] })
const ok = (body: unknown) => ({ ok: true, status: 200, json: async () => body })
const list = () => ok({ requests: [], nextCursor: null })

test('finance rejection requires a reason, confirms once and shows the result to the requester', async () => {
  const submitted = { ...draft(), status: 'submitted' as const, version: 2 }
  const rejected = { ...submitted, status: 'rejected' as const, version: 3,
    history: [{ id: 'h', actorId: 'f', action: 'rejected', version: 3, reason: '수량 재확인', changes: {}, createdAt: '2026-09-29T01:00:00Z' }] }
  let resolve!: (value: unknown) => void
  const fetcher = vi.fn().mockResolvedValueOnce(ok({ requests: [submitted], nextCursor: null }))
    .mockResolvedValueOnce(ok({ request: submitted })).mockImplementationOnce(() => new Promise(r => { resolve = r }))
  vi.stubGlobal('fetch', fetcher)
  vi.spyOn(window, 'confirm').mockReturnValue(true)
  const view = render(<Purchases {...props} finance />)
  fireEvent.click(await screen.findByRole('button', { name: /접수용/ }))
  const reject = await screen.findByRole('button', { name: '요청 반려' })
  expect(reject.hasAttribute('disabled')).toBe(true)
  fireEvent.change(screen.getByLabelText('반려 사유'), { target: { value: '수량 재확인' } })
  fireEvent.click(reject)
  fireEvent.click(screen.getByRole('button', { name: '요청 승인' }))
  expect(fetcher).toHaveBeenCalledTimes(3)
  expect(JSON.parse(fetcher.mock.calls[2]![1].body)).toEqual({ version: 2, decision: 'rejected', reason: '수량 재확인' })
  await act(async () => resolve(ok({ request: rejected })))
  expect(await screen.findByRole('heading', { name: '구매요청서 · 반려' })).toBeTruthy()
  expect(screen.queryByRole('button', { name: '요청 승인' })).toBeNull()
  view.unmount()
  fetcher.mockResolvedValueOnce(ok({ requests: [rejected], nextCursor: null })).mockResolvedValueOnce(ok({ request: rejected }))
  render(<Purchases {...props} />)
  fireEvent.click(await screen.findByRole('button', { name: /접수용/ }))
  expect(await screen.findByText('수량 재확인')).toBeTruthy()
})

test('approval confirmation can be cancelled and stale decisions require reloading', async () => {
  const submitted = { ...draft(), status: 'submitted', version: 2 }
  const fetcher = vi.fn().mockResolvedValueOnce(ok({ requests: [submitted], nextCursor: null }))
    .mockResolvedValueOnce(ok({ request: submitted }))
    .mockResolvedValueOnce({ ok: false, status: 409, json: async () => ({ error: 'VERSION_CONFLICT' }) })
  vi.stubGlobal('fetch', fetcher)
  const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
  render(<Purchases {...props} finance />)
  fireEvent.click(await screen.findByRole('button', { name: /접수용/ }))
  fireEvent.click(await screen.findByRole('button', { name: '요청 승인' }))
  expect(fetcher).toHaveBeenCalledTimes(2)
  confirm.mockReturnValue(true)
  fireEvent.click(screen.getByRole('button', { name: '요청 승인' }))
  expect((await screen.findByRole('alert')).textContent).toContain('다시 불러')
  expect(screen.getByRole('button', { name: '요청 승인' }).hasAttribute('disabled')).toBe(true)
})

test('unknown finance decision result preserves reason and blocks retry until reloaded', async () => {
  const submitted = { ...draft(), status: 'submitted', version: 2 }
  vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(ok({ requests: [submitted], nextCursor: null }))
    .mockResolvedValueOnce(ok({ request: submitted })).mockRejectedValueOnce(new Error('offline')))
  vi.spyOn(window, 'confirm').mockReturnValue(true)
  render(<Purchases {...props} finance />)
  fireEvent.click(await screen.findByRole('button', { name: /접수용/ }))
  fireEvent.change(await screen.findByLabelText('반려 사유'), { target: { value: '수량 확인 필요' } })
  fireEvent.click(screen.getByRole('button', { name: '요청 반려' }))
  expect((await screen.findByRole('alert')).textContent).toContain('다시 불러')
  expect(screen.getByDisplayValue('수량 확인 필요')).toBeTruthy()
  expect(screen.getByRole('button', { name: '요청 반려' }).hasAttribute('disabled')).toBe(true)
  expect(screen.getByRole('button', { name: '요청 승인' }).hasAttribute('disabled')).toBe(true)
})

test('finance request fields are read-only and clears details when finance permission is revoked', async () => {
  const submitted = { ...draft(), status: 'submitted', version: 2 }
  const fetcher = vi.fn().mockResolvedValueOnce(ok({ requests: [submitted], nextCursor: null }))
    .mockResolvedValueOnce(ok({ request: submitted }))
    .mockResolvedValueOnce({ ok: false, status: 403, json: async () => ({ error: 'FORBIDDEN' }) })
  vi.stubGlobal('fetch', fetcher)
  render(<Purchases {...props} finance />)
  fireEvent.click(await screen.findByRole('button', { name: /접수용/ }))
  expect(await screen.findByDisplayValue('무광화이트')).toBeTruthy()
  expect(fetcher).toHaveBeenLastCalledWith('/api/organizations/o/events/e/purchase-requests/finance/r', expect.anything())
  expect(screen.getByText('테이블 2개 준비')).toBeTruthy()
  expect(screen.getByLabelText('구매 목적').closest('fieldset')?.disabled).toBe(true)
  expect(screen.queryByRole('button', { name: '초안 만들기' })).toBeNull()
  expect(screen.queryByRole('button', { name: '초안 저장' })).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: '요청 목록 새로고침' }))
  await screen.findByRole('alert')
  expect(screen.queryByDisplayValue('무광화이트')).toBeNull()
  expect(screen.queryByText('테이블 2개 준비')).toBeNull()
})

test('submits saved draft with unknown costs once, confirms and makes it read-only', async () => {
  const ready = draft()
  ready.items[0]!.estimatedUnitPrice = null
  let resolve!: (value: unknown) => void
  const fetcher = vi.fn().mockResolvedValueOnce(ok({ requests: [ready], nextCursor: null }))
    .mockResolvedValueOnce(ok({ request: ready })).mockImplementationOnce(() => new Promise(r => { resolve = r }))
  vi.stubGlobal('fetch', fetcher)
  const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
  render(<Purchases {...props} />)
  fireEvent.click(await screen.findByRole('button', { name: /접수용/ }))
  const button = await screen.findByRole('button', { name: '요청서 제출' })
  expect(button.hasAttribute('disabled')).toBe(false)
  fireEvent.click(button)
  expect(fetcher).toHaveBeenCalledTimes(2)
  confirm.mockReturnValue(true)
  fireEvent.click(button)
  fireEvent.click(button)
  expect(fetcher).toHaveBeenCalledTimes(3)
  expect(fetcher).toHaveBeenLastCalledWith('/api/organizations/o/events/e/purchase-requests/r/submit', expect.objectContaining({ method: 'POST', body: JSON.stringify({ version: 1 }) }))
  await act(async () => resolve(ok({ request: { ...ready, version: 2, status: 'submitted' } })))
  expect(await screen.findByText('제출했어요. 접수 상태로 변경되었습니다.')).toBeTruthy()
  expect(screen.queryByRole('button', { name: '초안 저장' })).toBeNull()
  expect(screen.queryByRole('button', { name: '초안 폐기' })).toBeNull()
  expect(screen.getByLabelText('구매 목적').closest('fieldset')?.disabled).toBe(true)
})

test('submission requires complete saved fields and cannot silently ignore unsaved edits', async () => {
  const incomplete = draft()
  incomplete.items[0]!.optionRequired = null
  const fetcher = vi.fn().mockResolvedValueOnce(ok({ requests: [incomplete], nextCursor: null }))
    .mockResolvedValueOnce(ok({ request: incomplete })).mockResolvedValueOnce(ok({ request: { ...draft(), version: 2 } }))
  vi.stubGlobal('fetch', fetcher)
  render(<Purchases {...props} />)
  fireEvent.click(await screen.findByRole('button', { name: /접수용/ }))
  expect((await screen.findByRole('button', { name: '요청서 제출' })).hasAttribute('disabled')).toBe(true)
  fireEvent.change(screen.getByLabelText('옵션 선택 필요 여부'), { target: { value: 'yes' } })
  expect(screen.getByRole('button', { name: '요청서 제출' }).hasAttribute('disabled')).toBe(true)
  expect(screen.getByText('수정한 내용을 먼저 저장해 주세요.')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: '초안 저장' }))
  await screen.findByText('저장했어요.')
  await waitFor(() => expect(screen.getByRole('button', { name: '요청서 제출' }).hasAttribute('disabled')).toBe(false))
})

test('unknown submission result blocks retries until reloaded; server incomplete error stays actionable', async () => {
  const fetcher = vi.fn().mockResolvedValueOnce(ok({ requests: [draft()], nextCursor: null }))
    .mockResolvedValueOnce(ok({ request: draft() }))
    .mockResolvedValueOnce({ ok: false, status: 400, json: async () => ({ error: 'SUBMISSION_INCOMPLETE' }) })
    .mockRejectedValueOnce(new Error('offline'))
    .mockResolvedValueOnce(ok({ request: { ...draft(), status: 'submitted', version: 2 } }))
  vi.stubGlobal('fetch', fetcher)
  vi.spyOn(window, 'confirm').mockReturnValue(true)
  render(<Purchases {...props} />)
  fireEvent.click(await screen.findByRole('button', { name: /접수용/ }))
  fireEvent.click(await screen.findByRole('button', { name: '요청서 제출' }))
  expect((await screen.findByRole('alert')).textContent).toContain('제출 필수값')
  fireEvent.click(screen.getByRole('button', { name: '요청서 제출' }))
  await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('결과를 확인하지 못했어요'))
  expect(screen.getByRole('button', { name: '요청서 제출' }).hasAttribute('disabled')).toBe(true)
  fireEvent.click(screen.getByRole('button', { name: '요청서 다시 불러오기' }))
  expect(await screen.findByRole('heading', { name: '구매요청서 · 접수' })).toBeTruthy()
  expect(screen.queryByRole('button', { name: '요청서 제출' })).toBeNull()
})

test('creates from links, shows editable values and sources, saves with version, discards with confirmation', async () => {
  const saved = { ...draft(), version: 2, purpose: '수정 용도' }
  const fetcher = vi.fn().mockResolvedValueOnce(list()).mockResolvedValueOnce(ok({ request: draft() }))
    .mockResolvedValueOnce(ok({ request: saved })).mockResolvedValueOnce(ok({ request: { ...saved, version: 3, status: 'discarded' } }))
  vi.stubGlobal('fetch', fetcher)
  vi.spyOn(window, 'confirm').mockReturnValue(true)
  render(<Purchases {...props} />)
  await screen.findByText('아직 내 요청서가 없어요.')
  fireEvent.change(screen.getByLabelText('쿠팡 상품 링크'), { target: { value: link } })
  fireEvent.click(screen.getByRole('button', { name: '초안 만들기' }))
  expect(await screen.findByDisplayValue('무광화이트')).toBeTruthy()
  expect(screen.getByText('테이블 2개 준비')).toBeTruthy()
  expect((screen.getByLabelText('예상 배송비 (원)') as HTMLInputElement).value).toBe('')
  fireEvent.change(screen.getByLabelText('구매 목적'), { target: { value: '수정 용도' } })
  fireEvent.click(screen.getByRole('button', { name: '초안 저장' }))
  await screen.findByText('저장했어요.')
  const patch = JSON.parse(fetcher.mock.calls[2]![1].body)
  expect(patch.version).toBe(1)
  expect(patch.estimatedShippingCost).toBeNull()
  expect(patch.items[0].productSnapshot).toBeUndefined()
  fireEvent.click(screen.getByRole('button', { name: '초안 폐기' }))
  await screen.findByText('폐기했어요.')
  expect(screen.queryByRole('button', { name: '초안 저장' })).toBeNull()
  expect(JSON.parse(fetcher.mock.calls[3]![1].body)).toEqual({ version: 2 })
})

test('generation retry retains idempotency key and blocks double click', async () => {
  let resolve!: (value: unknown) => void
  const fetcher = vi.fn().mockResolvedValueOnce(list()).mockImplementationOnce(() => new Promise(r => { resolve = r }))
    .mockResolvedValueOnce(ok({ request: draft() }))
  vi.stubGlobal('fetch', fetcher)
  render(<Purchases {...props} />)
  await screen.findByText('아직 내 요청서가 없어요.')
  fireEvent.change(screen.getByLabelText('쿠팡 상품 링크'), { target: { value: link } })
  fireEvent.click(screen.getByRole('button', { name: '초안 만들기' }))
  fireEvent.submit(screen.getByRole('form', { name: '구매 초안 생성' }))
  expect(fetcher).toHaveBeenCalledTimes(2)
  await act(async () => resolve({ ok: false, status: 502, json: async () => ({ error: 'GENERATION_FAILED' }) }))
  await screen.findByRole('alert')
  fireEvent.click(screen.getByRole('button', { name: '초안 만들기' }))
  await screen.findByDisplayValue('무광화이트')
  expect(JSON.parse(fetcher.mock.calls[1]![1].body).idempotencyKey).toBe(JSON.parse(fetcher.mock.calls[2]![1].body).idempotencyKey)
})

test('conflict keeps edits and requires an explicit reload before retry', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(ok({ requests: [draft()], nextCursor: null }))
    .mockResolvedValueOnce(ok({ request: draft() }))
    .mockResolvedValueOnce({ ok: false, status: 409, json: async () => ({ error: 'VERSION_CONFLICT' }) }))
  render(<Purchases {...props} />)
  fireEvent.click(await screen.findByRole('button', { name: /접수용/ }))
  await screen.findByDisplayValue('무광화이트')
  fireEvent.change(screen.getByLabelText('구매 목적'), { target: { value: '내 수정' } })
  fireEvent.click(screen.getByRole('button', { name: '초안 저장' }))
  expect((await screen.findByRole('alert')).textContent).toContain('다시 불러')
  expect(screen.getByDisplayValue('내 수정')).toBeTruthy()
  expect(screen.getByRole('button', { name: '초안 저장' }).hasAttribute('disabled')).toBe(true)
})

test('permission loss clears private details and changing event ignores late responses', async () => {
  let resolve!: (value: unknown) => void
  vi.stubGlobal('fetch', vi.fn().mockImplementationOnce(() => new Promise(r => { resolve = r }))
    .mockResolvedValueOnce(ok({ requests: [draft()], nextCursor: null })).mockResolvedValueOnce({ ok: false, status: 403, json: async () => ({ error: 'FORBIDDEN' }) }))
  const view = render(<Purchases {...props} />)
  view.rerender(<Purchases {...props} eventId="e2" />)
  await screen.findByRole('button', { name: /접수용/ })
  await act(async () => resolve(ok({ requests: [{ ...draft(), purpose: '이전 행사' }], nextCursor: null })))
  expect(screen.queryByText(/이전 행사/)).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: /접수용/ }))
  expect((await screen.findByRole('alert')).textContent).toContain('접근')
  expect(screen.queryByRole('button', { name: /접수용/ })).toBeNull()
})
