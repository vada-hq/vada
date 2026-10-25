// @vitest-environment jsdom
import { resetAddress } from '@/test-support/address-reset'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { MEMBER_PERMISSIONS } from '@/test-support/council-fixtures'
import { asElement } from '@/test-support/elements'
import { expenseDetail, expenseSummary } from '@/test-support/expense-fixtures'
import {
  EXPENSES,
  openExpensesTab,
  serveFinance,
  showFinance,
} from '@/test-support/expense-harness'
import { deferredResponse, json } from '@/test-support/mock-api'
import { settle } from '@/test-support/settle'
import { resizeToJpeg } from '@/lib/photo-resize'

vi.mock('@/lib/photo-resize', async importOriginal => ({
  ...(await importOriginal<typeof import('@/lib/photo-resize')>()),
  resizeToJpeg: vi.fn(),
}))

beforeEach(() => {
  vi.stubGlobal(
    'URL',
    Object.assign(URL, { createObjectURL: () => 'blob:x', revokeObjectURL: () => {} }),
  )
  vi.mocked(resizeToJpeg).mockImplementation(file =>
    Promise.resolve(file instanceof File && file.name === 'bad.heic' ? null : new Blob(['j'])),
  )
})
afterEach(async () => {
  cleanup()
  await resetAddress()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

const signed = {
  key: 'k1',
  url: '/0199d1a0-0000-7000-8000-00000000a002/k1',
  headers: { 'Content-Type': 'image/jpeg' },
  expiresAt: '2026-10-21T00:10:00.000Z',
}
const withPhoto = expenseDetail('0199d1a0-0000-7000-8000-00000000b101', {
  evidence: [{ id: 'v1', type: 'receipt', fileId: 'f1' }],
  evidenceCount: 1,
})

function serve(detail = expenseDetail('0199d1a0-0000-7000-8000-00000000b101')) {
  const api = serveFinance()
  api.on('GET', EXPENSES, () =>
    json({ expenses: [expenseSummary('0199d1a0-0000-7000-8000-00000000b101')], truncated: false }),
  )
  api.on('GET', `${EXPENSES}/0199d1a0-0000-7000-8000-00000000b101`, () => json({ expense: detail }))
  api.on('POST', `${EXPENSES}/0199d1a0-0000-7000-8000-00000000b101/uploads`, () => json(signed))
  api.on(
    'PUT',
    '/0199d1a0-0000-7000-8000-00000000a002/k1',
    () => new Response(null, { status: 200 }),
  )
  return api
}
const open = async (permissions?: Parameters<typeof showFinance>[0]) => {
  const handlers = showFinance(permissions)
  openExpensesTab()
  fireEvent.click(
    await screen.findByRole('button', { name: '사용처 0199d1a0-0000-7000-8000-00000000b101' }),
  )
  await screen.findByRole('dialog')
  return handlers
}
const pick = (name = 'a.jpg') =>
  fireEvent.change(screen.getByLabelText('증빙 사진 고르기'), {
    target: { files: [new File(['raw'], name, { type: 'image/jpeg' })] },
  })
const attachButton = () =>
  asElement(screen.getByRole('button', { name: '붙이기' }), HTMLButtonElement)

test('사진을 고르면 줄여 올리고, 미리 보기와 종류(기본 영수증)를 보인 뒤 붙인다', async () => {
  const api = serve()
  api.on('POST', `${EXPENSES}/0199d1a0-0000-7000-8000-00000000b101/evidence`, () =>
    json({ expense: withPhoto }, 201),
  )
  await open()
  pick()
  const card = await screen.findByRole('group', { name: '붙일 사진' })
  await waitFor(() => expect(attachButton().disabled).toBe(false))
  expect(within(card).getByRole('img').getAttribute('src')).toBe('blob:x')
  expect(asElement(within(card).getByLabelText('종류'), HTMLSelectElement).value).toBe('receipt')
  fireEvent.change(within(card).getByLabelText('종류'), { target: { value: 'tax_invoice' } })
  fireEvent.click(attachButton())
  await waitFor(() => expect(screen.queryByRole('group', { name: '붙일 사진' })).toBeNull())
  expect(api.calls.find(call => call.path.endsWith('/evidence'))?.body).toEqual({
    key: 'k1',
    type: 'tax_invoice',
  })
  // 서버 바깥(저장소)으로 올릴 때 우리 쿠키를 보내지 않고 올리기 주소가 준 머리를 쓴다.
  expect(
    api.calls.some(
      call => call.method === 'PUT' && call.path === '/0199d1a0-0000-7000-8000-00000000a002/k1',
    ),
  ).toBe(true)
  const link = screen.getByRole('button', { name: '영수증 1 크게 보기' })
  expect(within(link).getByRole('img').getAttribute('src')).toBe(
    `${EXPENSES}/0199d1a0-0000-7000-8000-00000000b101/files/f1`,
  )
})

test('올리는 동안에는 붙일 수 없고 붙이기를 두 번 눌러도 한 번만 나간다', async () => {
  const api = serve()
  const upload = deferredResponse()
  const attach = deferredResponse()
  api.on('PUT', '/0199d1a0-0000-7000-8000-00000000a002/k1', () => upload.promise)
  api.on('POST', `${EXPENSES}/0199d1a0-0000-7000-8000-00000000b101/evidence`, () => attach.promise)
  await open()
  pick()
  await screen.findByText('올리는 중…')
  expect(attachButton().disabled).toBe(true)
  upload.resolve(new Response(null, { status: 200 }))
  await waitFor(() => expect(attachButton().disabled).toBe(false))
  fireEvent.click(attachButton())
  fireEvent.click(attachButton())
  await settle()
  expect(api.calls.filter(call => call.path.endsWith('/evidence'))).toHaveLength(1)
  expect(attachButton().disabled).toBe(true)
  attach.resolve(json({ expense: withPhoto }, 201))
  await waitFor(() => expect(screen.queryByRole('group', { name: '붙일 사진' })).toBeNull())
})

test('열 수 없는 사진과 저장소 거절은 그 자리에 문구가 뜨고 붙일 수 없다', async () => {
  const api = serve()
  await open()
  pick('bad.heic')
  expect((await screen.findByRole('alert')).textContent).toContain('이 사진을 열 수 없어요')
  expect(screen.queryByRole('button', { name: '붙이기' })).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: '빼기' }))
  api.on(
    'PUT',
    '/0199d1a0-0000-7000-8000-00000000a002/k1',
    () => new Response(null, { status: 403 }),
  )
  pick()
  expect((await screen.findByRole('alert')).textContent).toContain('사진을 올리지 못했어요')
  expect(screen.queryByRole('button', { name: '붙이기' })).toBeNull()
})

test('사진 저장소가 없으면(503) 올리기 문구가 뜨고 지출은 그대로 보인다', async () => {
  const api = serve()
  api.on('POST', `${EXPENSES}/0199d1a0-0000-7000-8000-00000000b101/uploads`, () =>
    json({ error: 'STORAGE_NOT_CONFIGURED' }, 503),
  )
  await open()
  pick()
  expect((await screen.findByRole('alert')).textContent).toContain('지금은 사진을 올릴 수 없어요')
  expect(screen.getByText('먼저 낸 사람 박새내')).toBeTruthy()
})

test.each([
  ['EVIDENCE_LIMIT', 409, '20장까지', false],
  ['EXPENSE_CANCELLED', 409, '이미 취소된 지출', false],
  ['UPLOAD_MISMATCH', 400, '올린 사진을 확인하지 못했어요', true],
  ['PHOTO_ALREADY_SENT', 409, '이미 붙인 사진', true],
  ['TOO_MANY_REQUESTS', 429, '너무 빨리', false],
])('붙이기가 %s로 거절되면 문구를 보인다', async (code, status, text, unusable) => {
  const api = serve()
  api.on('POST', `${EXPENSES}/0199d1a0-0000-7000-8000-00000000b101/evidence`, () =>
    json({ error: code }, status),
  )
  await open()
  pick()
  await waitFor(() => expect(attachButton().disabled).toBe(false))
  fireEvent.click(attachButton())
  expect((await screen.findByRole('alert')).textContent).toContain(text)
  // 쓸 수 없는 사진은 빼고 다시 올려야 하고, 그 밖은 같은 사진으로 다시 누를 수 있다.
  if (code === 'EXPENSE_CANCELLED' || code === 'EVIDENCE_LIMIT') return
  // 쓸 수 없는 사진은 [붙이기]가 숨는다.
  await waitFor(() =>
    expect(screen.queryByRole('button', { name: '붙이기' }) === null).toBe(unusable),
  )
})

test('붙이는 중에 지출이 취소돼 올리기 칸이 사라져도 거절 문구는 남는다', async () => {
  const api = serve()
  let reads = 0
  api.on('GET', `${EXPENSES}/0199d1a0-0000-7000-8000-00000000b101`, () => {
    reads += 1
    return json({
      expense:
        reads > 1
          ? expenseDetail('0199d1a0-0000-7000-8000-00000000b101', { cancelled: true, actions: [] })
          : expenseDetail('0199d1a0-0000-7000-8000-00000000b101'),
    })
  })
  api.on('POST', `${EXPENSES}/0199d1a0-0000-7000-8000-00000000b101/evidence`, () =>
    json({ error: 'EXPENSE_CANCELLED' }, 409),
  )
  await open()
  pick()
  await waitFor(() => expect(attachButton().disabled).toBe(false))
  fireEvent.click(attachButton())
  await waitFor(() => expect(screen.queryByRole('button', { name: '붙이기' })).toBeNull())
  expect(screen.getByRole('alert').textContent).toContain('이미 취소된 지출')
})

test('사진을 붙이면 지출 목록을 다시 읽는다', async () => {
  const api = serve()
  api.on('POST', `${EXPENSES}/0199d1a0-0000-7000-8000-00000000b101/evidence`, () =>
    json({ expense: withPhoto }, 201),
  )
  await open()
  const before = api.calls.filter(call => call.method === 'GET' && call.path === EXPENSES).length
  pick()
  await waitFor(() => expect(attachButton().disabled).toBe(false))
  fireEvent.click(attachButton())
  await waitFor(() =>
    expect(
      api.calls.filter(call => call.method === 'GET' && call.path === EXPENSES).length,
    ).toBeGreaterThan(before),
  )
})

test('취소된 지출과 재정부가 아닌 사람에게는 올리기 칸이 없고 사진은 모두 본다', async () => {
  serve(
    expenseDetail('0199d1a0-0000-7000-8000-00000000b101', {
      ...withPhoto,
      cancelled: true,
      actions: [],
    }),
  )
  await open()
  expect(screen.queryByRole('button', { name: '사진 올리기' })).toBeNull()
  expect(screen.getByRole('button', { name: '영수증 1 크게 보기' })).toBeTruthy()
  cleanup()
  await resetAddress()
  // 서버는 재정부가 아닌 사람에게 증빙 동작을 주지 않는다.
  serve({ ...withPhoto, actions: [] })
  await open(MEMBER_PERMISSIONS)
  expect(screen.queryByRole('button', { name: '사진 올리기' })).toBeNull()
  expect(screen.getByRole('button', { name: '영수증 1 크게 보기' })).toBeTruthy()
})

test('사진이 20장이면 올리기 칸이 없다', async () => {
  const evidence = Array.from({ length: 20 }, (_, index) => ({
    id: `v${index}`,
    type: 'receipt' as const,
    fileId: `f${index}`,
  }))
  serve(
    expenseDetail('0199d1a0-0000-7000-8000-00000000b101', {
      evidence,
      actions: ['expense.cancel'],
    }),
  )
  await open()
  expect(screen.queryByRole('button', { name: '사진 올리기' })).toBeNull()
})

test('사진을 누르면 크게 보인다', async () => {
  serve(withPhoto)
  await open()
  fireEvent.click(screen.getByRole('button', { name: '영수증 1 크게 보기' }))
  const big = await screen.findByRole('dialog', { name: '영수증 1' })
  expect(within(big).getByRole('img').getAttribute('src')).toBe(
    `${EXPENSES}/0199d1a0-0000-7000-8000-00000000b101/files/f1`,
  )
})

test('올리는 중 권한을 잃으면(403) 닫고 학생회를 다시 읽게 한다', async () => {
  const api = serve()
  api.on('POST', `${EXPENSES}/0199d1a0-0000-7000-8000-00000000b101/uploads`, () =>
    json({ error: 'FORBIDDEN' }, 403),
  )
  const handlers = await open()
  pick()
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  expect(handlers.onForbidden).toHaveBeenCalled()
})
