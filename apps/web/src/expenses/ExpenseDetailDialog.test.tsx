// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { ReceiptSummary } from '@vada/contracts'
import { json, mockApi } from '../test-support/mock-api'
import ExpenseDetailDialog from './ExpenseDetailDialog'
import { expense } from './expense-fixtures'

afterEach(() => { cleanup(); vi.unstubAllGlobals() })
const detail = '/api/organizations/o/expenses/x1'
const receipt = (overrides: Partial<ReceiptSummary> = {}): ReceiptSummary => ({ id: 'r1', fileName: '영수증.jpg', contentType: 'image/jpeg', size: 3,
  kind: 'statement', uploadedBy: { id: 'f', name: '재정 테스터' }, createdAt: '2026-10-09T06:00:00.000Z', ...overrides })
function setup(initial = expense(), finance = true) {
  const api = mockApi()
  api.on('GET', detail, () => json({ expense: initial }))
  const onChanged = vi.fn()
  render(<ExpenseDetailDialog organizationId="o" expenseId="x1" finance={finance} onClose={() => {}} onChanged={onChanged} />)
  return { api, onChanged }
}
const choose = (dialog: HTMLElement, file: File) => fireEvent.change(within(dialog).getByLabelText('증빙 파일 고르기'), { target: { files: [file] } })

test('상세는 연결 품목·승인 금액 비교·증빙 없음·처리 기록을 보여 준다', async () => {
  setup(expense({ history: [{ id: 'h1', action: 'created', actor: { id: 'f', name: '재정 테스터' }, changes: {}, createdAt: '2026-10-09T05:00:00.000Z' }] }))
  const dialog = await screen.findByRole('dialog', { name: '쿠팡 · 10,000원' })
  expect(within(dialog).getByText('승인 9,800원 → 실제 10,000원 · 200원 많음')).toBeTruthy()
  expect(within(dialog).getByText('박스테이프 · 2개 · 기획 테스터')).toBeTruthy()
  expect(within(dialog).getByText('올린 증빙이 없어요.')).toBeTruthy()
  expect(within(dialog).getByText(/^재정 테스터 · .+ · 기록$/)).toBeTruthy()
})

test('증빙을 고르면 서명 주소를 받아 저장소에 바로 올리고 확인해 목록에 보여 준다', async () => {
  const { api, onChanged } = setup()
  api.on('POST', `${detail}/receipts`, () => json({ receiptId: 'r1', upload: { url: 'http://localhost/r2/receipts/o/x1/r1',
    headers: { 'Content-Type': 'image/jpeg' } }, expiresAt: '2026-10-09T06:10:00.000Z' }, 201))
  api.on('PUT', '/r2/receipts/o/x1/r1', () => new Response(null, { status: 200 }))
  api.on('POST', `${detail}/receipts/r1/confirm`, () => json({ expense: expense({ receipts: [receipt()], receiptCount: 1, evidence: 'complete' }) }))
  const dialog = await screen.findByRole('dialog', { name: '쿠팡 · 10,000원' })
  fireEvent.change(within(dialog).getByLabelText('증빙 종류'), { target: { value: 'statement' } })
  choose(dialog, new File(['abc'], '영수증.jpg', { type: 'image/jpeg' }))
  expect(await within(dialog).findByText('증빙 완료')).toBeTruthy()
  expect(within(dialog).getByRole('link', { name: '거래명세서 · 영수증.jpg' }).getAttribute('href')).toBe(`${detail}/receipts/r1/file`)
  expect(within(dialog).getByText('영수증.jpg · 올렸어요')).toBeTruthy()
  expect(api.calls.map(call => `${call.method} ${call.path}`)).toEqual([`GET ${detail}`, `POST ${detail}/receipts`, 'PUT /r2/receipts/o/x1/r1',
    `POST ${detail}/receipts/r1/confirm`])
  expect(api.calls[1]!.body).toEqual({ fileName: '영수증.jpg', contentType: 'image/jpeg', size: 3, kind: 'statement' })
  expect(onChanged).toHaveBeenCalled()
})

test('정해진 형식이 아니면 서버에 보내지 않고, 저장소에 올리지 못하면 확인을 보내지 않고 실패로 표시한다', async () => {
  const { api } = setup()
  api.on('POST', `${detail}/receipts`, () => json({ receiptId: 'r1', upload: { url: 'http://localhost/r2/receipts/o/x1/r1',
    headers: { 'Content-Type': 'image/png' } }, expiresAt: '2026-10-09T06:10:00.000Z' }, 201))
  api.on('PUT', '/r2/receipts/o/x1/r1', () => new Response(null, { status: 403 }))
  const dialog = await screen.findByRole('dialog', { name: '쿠팡 · 10,000원' })
  choose(dialog, new File(['memo'], 'memo.txt', { type: 'text/plain' }))
  expect(await within(dialog).findByText('memo.txt · 사진(JPG·PNG·WEBP·HEIC)이나 PDF만, 10MB까지 올릴 수 있어요.')).toBeTruthy()
  expect(api.calls).toHaveLength(1)
  choose(dialog, new File(['png'], '사진.png', { type: 'image/png' }))
  expect(await within(dialog).findByText('사진.png · 파일을 올리지 못했어요. 다시 시도해 주세요.')).toBeTruthy()
  expect(api.calls.some(call => call.path.endsWith('/confirm'))).toBe(false)
  expect(within(dialog).getByText('올린 증빙이 없어요.')).toBeTruthy()
})

test('증빙을 지우고, 지출을 취소하면 사유를 보내고 바꾸는 버튼을 감춘다', async () => {
  const { api } = setup(expense({ receipts: [receipt({ kind: 'receipt', contentType: 'application/pdf', fileName: '명세.pdf' })], receiptCount: 1, evidence: 'complete' }))
  api.on('POST', `${detail}/receipts/r1/delete`, () => json({ expense: expense() }))
  api.on('POST', `${detail}/void`, () => json({ expense: expense({ version: 2, voided: { by: { id: 'f', name: '재정 테스터' }, at: '2026-10-09T07:00:00.000Z', reason: '중복' } }) }))
  const dialog = await screen.findByRole('dialog', { name: '쿠팡 · 10,000원' })
  expect(within(dialog).getByRole('link', { name: '영수증 · 명세.pdf' })).toBeTruthy()
  fireEvent.click(within(dialog).getByRole('button', { name: '삭제' }))
  expect(await within(dialog).findByText('올린 증빙이 없어요.')).toBeTruthy()
  fireEvent.click(within(dialog).getByRole('button', { name: '지출 취소' }))
  expect(within(dialog).getByText('합계에서 빠지고 연결 품목은 풀려요.')).toBeTruthy()
  const confirm = within(dialog).getByRole('button', { name: '취소하기' })
  expect(confirm.hasAttribute('disabled')).toBe(true)
  fireEvent.change(within(dialog).getByLabelText('취소 사유'), { target: { value: ' 중복 ' } })
  fireEvent.click(confirm)
  expect(await within(dialog).findByText('취소됨 · 재정 테스터 · 중복')).toBeTruthy()
  expect(api.calls.find(call => call.path === `${detail}/void`)?.body).toEqual({ version: 1, reason: ' 중복 ' })
  expect(within(dialog).queryByRole('button', { name: '증빙 추가' })).toBeNull()
  expect(within(dialog).queryByRole('button', { name: '지출 취소' })).toBeNull()
})

test('재정 권한이 없으면 보기만 한다', async () => {
  setup(expense({ receipts: [receipt()], receiptCount: 1, evidence: 'complete' }), false)
  const dialog = await screen.findByRole('dialog', { name: '쿠팡 · 10,000원' })
  expect(within(dialog).getByRole('link', { name: '거래명세서 · 영수증.jpg' })).toBeTruthy()
  for (const name of ['증빙 추가', '삭제', '지출 취소']) expect(within(dialog).queryByRole('button', { name })).toBeNull()
})

test('긴 파일 이름과 사유는 대화상자 안에서 줄을 바꾼다', async () => {
  const name = `${'가'.repeat(150)}.jpg`
  setup(expense({ receipts: [receipt({ fileName: name })], receiptCount: 1, evidence: 'complete' }))
  const dialog = await screen.findByRole('dialog', { name: '쿠팡 · 10,000원' })
  await waitFor(() => expect(within(dialog).getByRole('link', { name: `거래명세서 · ${name}` }).className).toContain('wrap-anywhere'))
})
