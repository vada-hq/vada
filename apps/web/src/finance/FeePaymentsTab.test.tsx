// @vitest-environment jsdom
import { resetAddress } from '@/test-support/address-reset'
import { afterEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import type { Action, FeePaymentsResponse } from '@vada/contracts'
import {
  FINANCE_PERMISSIONS,
  LEADER_PERMISSIONS,
  MEMBER_PERMISSIONS,
} from '@/test-support/council-fixtures'
import { asElement } from '@/test-support/elements'
import { BASE, serveFinance, showFinance } from '@/test-support/expense-harness'
import { FEE_PAYMENT_SEARCH_INVALID, PERMISSION_CHANGED } from '@/lib/messages'
import { deferredResponse, json } from '@/test-support/mock-api'

afterEach(async () => {
  cleanup()
  await resetAddress()
  vi.unstubAllGlobals()
})

const FEES = `${BASE}/fee-payments`
const MANAGER: Action[] = FINANCE_PERMISSIONS
const VIEWER: Action[] = LEADER_PERMISSIONS
const PAYMENT_ID = '22222222-2222-4222-8222-222222222222'

const periods: FeePaymentsResponse = {
  periods: [
    { paidFrom: '2026-09-01', paidUntil: '2026-12-31', count: 120 },
    { paidFrom: '2026-03-01', paidUntil: '2026-08-31', count: 95 },
  ],
  matches: [],
}
const found: FeePaymentsResponse = {
  periods: periods.periods,
  matches: [
    { id: PAYMENT_ID, studentId: '20261234', paidFrom: '2026-09-01', paidUntil: '2026-12-31' },
  ],
}

async function open(permissions: Action[] = MANAGER) {
  const api = serveFinance()
  api.on('GET', FEES, () => json(periods))
  const handlers = showFinance(permissions)
  fireEvent.click(screen.getByRole('tab', { name: '납부자 명단' }))
  await screen.findByRole('list', { name: '납부 기간' })
  return { api, handlers }
}
const button = (name: string) => asElement(screen.getByRole('button', { name }), HTMLButtonElement)
const fill = (label: string, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } })

test('탭은 fee_payment.view가 있을 때만 보인다', () => {
  serveFinance()
  showFinance(MEMBER_PERMISSIONS)
  expect(screen.queryByRole('tab', { name: '납부자 명단' })).toBeNull()
  cleanup()
  showFinance(VIEWER)
  expect(screen.getByRole('tab', { name: '납부자 명단' })).toBeTruthy()
})

test('기간마다 수가 보이고, 회장단(보기만)은 올리기가 없다', async () => {
  await open(VIEWER)
  const list = within(screen.getByRole('list', { name: '납부 기간' }))
  expect(list.getByText('2026-09-01 ~ 2026-12-31')).toBeTruthy()
  expect(list.getByText('120명')).toBeTruthy()
  expect(screen.queryByRole('button', { name: '납부자 올리기' })).toBeNull()
})

test('학번을 찾으면 기록이 보이고, 보기만 하는 사람에게는 빼기가 없다', async () => {
  const { api } = await open(VIEWER)
  api.on('GET', `${FEES}?studentId=20261234`, () => json(found))
  expect(button('찾기').disabled).toBe(false)
  fill('찾을 학번', '12가')
  fireEvent.click(button('찾기'))
  expect(screen.getByText(FEE_PAYMENT_SEARCH_INVALID)).toBeTruthy()
  fill('찾을 학번', '20261234')
  expect(screen.queryByText(FEE_PAYMENT_SEARCH_INVALID)).toBeNull()
  fireEvent.click(button('찾기'))
  const matches = await screen.findByRole('list', { name: '찾은 학번' })
  expect(within(matches).getByText('20261234 · 2026-09-01 ~ 2026-12-31')).toBeTruthy()
  expect(screen.queryByRole('button', { name: '빼기' })).toBeNull()
})

test('찾은 학번이 없으면 안내가 보인다', async () => {
  const { api } = await open()
  api.on('GET', `${FEES}?studentId=20260000`, () => json(periods))
  fill('찾을 학번', '20260000')
  fireEvent.click(button('찾기'))
  expect(await screen.findByText('이 학번은 명단에 없어요.')).toBeTruthy()
  fireEvent.click(button('전체 보기'))
  await waitFor(() => expect(screen.queryByText('이 학번은 명단에 없어요.')).toBeNull())
})

test('찾는 동안과 찾기가 실패해도 찾기 줄이 남고 전체 보기로 돌아간다', async () => {
  const { api } = await open()
  const pending = deferredResponse()
  api.on('GET', `${FEES}?studentId=20260000`, () => pending.promise)
  fill('찾을 학번', '20260000')
  fireEvent.click(button('찾기'))
  expect(await screen.findByText('납부자 명단 불러오는 중…')).toBeTruthy()
  expect(asElement(screen.getByLabelText('찾을 학번'), HTMLInputElement).value).toBe('20260000')
  pending.resolve(json({ error: 'TOO_MANY_REQUESTS' }, 429))
  expect(await screen.findByText(/불러오지 못했어요/)).toBeTruthy()
  expect(asElement(screen.getByLabelText('찾을 학번'), HTMLInputElement).value).toBe('20260000')
  fireEvent.click(button('전체 보기'))
  expect(await screen.findByRole('list', { name: '납부 기간' })).toBeTruthy()
})

test('연결이 끊겨 찾기가 실패해도 전체 보기가 남는다', async () => {
  const { api } = await open()
  api.on('GET', `${FEES}?studentId=20260000`, () => {
    throw new Error('offline')
  })
  fill('찾을 학번', '20260000')
  fireEvent.click(button('찾기'))
  expect(await screen.findByText(/불러오지 못했어요/)).toBeTruthy()
  expect(screen.getByLabelText('찾을 학번')).toBeTruthy()
  expect(button('전체 보기')).toBeTruthy()
})

test('학번이 맞지 않으면 누를 때 칸 아래에 이유가 보이고 찾지 않는다', async () => {
  const { api } = await open()
  const reads = api.calls.length
  fill('찾을 학번', '1'.repeat(40))
  expect(screen.queryByText(FEE_PAYMENT_SEARCH_INVALID)).toBeNull()
  fireEvent.click(button('찾기'))
  expect(screen.getByText(FEE_PAYMENT_SEARCH_INVALID)).toBeTruthy()
  await waitFor(() => expect(document.activeElement).toBe(screen.getByLabelText('찾을 학번')))
  expect(api.calls).toHaveLength(reads)
  fill('찾을 학번', '')
  expect(screen.getByText('학번을 입력해 주세요')).toBeTruthy()
})

async function openRemove() {
  const { api, handlers } = await open()
  api.on('GET', `${FEES}?studentId=20261234`, () => json(found))
  fill('찾을 학번', '20261234')
  fireEvent.click(button('찾기'))
  await screen.findByRole('list', { name: '찾은 학번' })
  fireEvent.click(button('빼기'))
  const dialog = await screen.findByRole('dialog')
  return { api, handlers, dialog }
}

test('빼기는 확인을 거치고 두 번 눌러도 한 번만 간다', async () => {
  const { api, dialog } = await openRemove()
  const pending = deferredResponse()
  api.on('POST', `${FEES}/${PAYMENT_ID}/remove`, () => pending.promise)
  const remove = within(dialog).getByRole('button', { name: '빼기' })
  fireEvent.click(remove)
  fireEvent.click(remove)
  expect(api.calls.filter(call => call.method === 'POST')).toHaveLength(1)
  api.on('GET', `${FEES}?studentId=20261234`, () => json(periods))
  pending.resolve(json({ ok: true }))
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  expect(api.calls.find(call => call.method === 'POST')?.body).toEqual({})
})

test('빼기가 403이면 대화상자를 닫고 권한 문구를 보이며 학생회를 다시 읽게 한다', async () => {
  const { api, handlers, dialog } = await openRemove()
  api.on('POST', `${FEES}/${PAYMENT_ID}/remove`, () => json({ error: 'FORBIDDEN' }, 403))
  fireEvent.click(within(dialog).getByRole('button', { name: '빼기' }))
  expect(await screen.findByText(PERMISSION_CHANGED)).toBeTruthy()
  expect(screen.queryByRole('dialog')).toBeNull()
  expect(handlers.onForbidden).toHaveBeenCalled()
})

test('빼기가 404면 대화상자를 닫고 이미 비워졌다고 알린다', async () => {
  const { api, dialog } = await openRemove()
  api.on('POST', `${FEES}/${PAYMENT_ID}/remove`, () => json({ error: 'NOT_FOUND' }, 404))
  fireEvent.click(within(dialog).getByRole('button', { name: '빼기' }))
  expect(await screen.findByText(/이미 비워졌어요/)).toBeTruthy()
  expect(screen.queryByRole('dialog')).toBeNull()
})

async function openUpload() {
  const result = await open()
  fireEvent.click(button('납부자 올리기'))
  await screen.findByRole('form', { name: '납부자 명단 올리기' })
  return result
}
function fillUpload(students = '20261234\n20265678') {
  fill('납부 시작일', '2026-09-01')
  fill('납부 끝일', '2026-12-31')
  fill('학번', students)
}

test('올리기: 빈 칸이나 시작일보다 앞선 끝일은 보내지 않고 칸 아래에 알리며, 두 번 눌러도 한 번만 가고 완료 창에 추가 수와 이미 있는 수를 보인다', async () => {
  const { api } = await openUpload()
  const pending = deferredResponse()
  api.on('POST', FEES, () => pending.promise)
  // 학번 칸에는 구분하는 법만 짧게 알린다.
  expect(screen.getByText('줄바꿈이나 쉼표로 구분')).toBeTruthy()
  expect(button('올리기').disabled).toBe(false)
  fill('납부 시작일', '')
  fill('납부 끝일', '')
  fireEvent.click(button('올리기'))
  expect(screen.getByText('납부 시작일을 입력해 주세요')).toBeTruthy()
  expect(screen.getByText('납부 끝일을 입력해 주세요')).toBeTruthy()
  expect(screen.getByText('학번을 입력해 주세요')).toBeTruthy()
  fill('납부 시작일', '2026-12-31')
  fill('납부 끝일', '2026-09-01')
  fill('학번', '20261234')
  fireEvent.click(button('올리기'))
  expect(screen.getByText('시작일과 같거나 뒤의 날짜를 입력해 주세요')).toBeTruthy()
  expect(screen.getByLabelText('납부 끝일').getAttribute('aria-invalid')).toBe('true')
  expect(api.calls.filter(call => call.method === 'POST')).toHaveLength(0)
  fillUpload()
  expect(screen.queryByText('시작일과 같거나 뒤의 날짜를 입력해 주세요')).toBeNull()
  fireEvent.click(button('올리기'))
  fireEvent.click(button('올리기'))
  await waitFor(() => expect(button('올리기').disabled).toBe(true))
  expect(api.calls.filter(call => call.method === 'POST')).toHaveLength(1)
  pending.resolve(json({ added: 1, skipped: 1 }))
  const done = await screen.findByRole('dialog', { name: '명단 올리기 완료' })
  expect(within(done).getByText('추가 1개 · 이미 있음 1개')).toBeTruthy()
  expect(api.calls.find(call => call.method === 'POST')?.body).toEqual({
    paidFrom: '2026-09-01',
    paidUntil: '2026-12-31',
    students: '20261234\n20265678',
  })
  fireEvent.click(
    screen
      .getAllByRole('button', { name: '닫기' })
      .find(item => item.textContent === '닫기') as Element,
  )
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
})

test('올리기 400이 줄 번호를 주면 그 줄을 알리고 입력이 남는다', async () => {
  const { api } = await openUpload()
  api.on('POST', FEES, () => json({ error: 'INVALID_INPUT', lines: [2, 5] }, 400))
  fillUpload('20261234\nabc')
  fireEvent.click(button('올리기'))
  expect((await screen.findByRole('alert')).textContent).toMatch(/2, 5번째 줄/)
  expect(asElement(screen.getByLabelText('학번'), HTMLTextAreaElement).value).toBe('20261234\nabc')
  expect(button('올리기').disabled).toBe(false)
})

test.each([
  [400, 'INVALID_INPUT', /올릴 수 없는 내용/],
  [413, 'BODY_TOO_LARGE', /나누어서 올려/],
  [429, 'TOO_MANY_REQUESTS', /너무 빨리/],
])('올리기 %i는 문구가 보이고 입력이 남는다', async (status, code, text) => {
  const { api } = await openUpload()
  api.on('POST', FEES, () => json({ error: code }, status))
  fillUpload()
  fireEvent.click(button('올리기'))
  expect((await screen.findByRole('alert')).textContent).toMatch(text)
  expect(button('올리기').disabled).toBe(false)
})

test('올리기가 403이면 대화상자를 닫고 권한 문구를 보인다', async () => {
  const { api, handlers } = await openUpload()
  api.on('POST', FEES, () => json({ error: 'FORBIDDEN' }, 403))
  fillUpload()
  fireEvent.click(button('올리기'))
  expect(await screen.findByText(PERMISSION_CHANGED)).toBeTruthy()
  expect(screen.queryByRole('dialog')).toBeNull()
  expect(handlers.onForbidden).toHaveBeenCalled()
})
