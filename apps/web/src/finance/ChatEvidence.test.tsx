// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import type { ChatPhotoListResponse } from '@vada/contracts'
import { MEMBER_PERMISSIONS } from '@/test-support/council-fixtures'
import { asElement } from '@/test-support/elements'
import { expenseDetail, expenseSummary } from '@/test-support/expense-fixtures'
import {
  BASE,
  EXPENSES,
  openExpensesTab,
  serveFinance,
  showFinance,
} from '@/test-support/expense-harness'
import { deferredResponse, json } from '@/test-support/mock-api'
import { settle } from '@/test-support/settle'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

const PHOTOS = `${BASE}/chat/photos`
const P1 = '22222222-2222-4222-8222-222222222221'
const P2 = '22222222-2222-4222-8222-222222222222'
const SENT = '2026-10-20T03:00:00.000Z'
const choice = (id: string, extra: Partial<ChatPhotoListResponse['photos'][number]> = {}) => ({
  id,
  messageId: `m-${id}`,
  room: { id: 'r1', type: 'all_members' as const, name: null },
  senderId: 's1',
  senderName: '박새내',
  sentAt: SENT,
  ...extra,
})
const withPhoto = expenseDetail('e1', {
  evidence: [{ id: 'v1', type: 'receipt', fileId: 'f1' }],
  evidenceCount: 1,
})

function serve(
  list: ChatPhotoListResponse = { photos: [choice(P1), choice(P2)], truncated: false },
) {
  const api = serveFinance()
  api.on('GET', EXPENSES, () => json({ expenses: [expenseSummary('e1')], truncated: false }))
  api.on('GET', `${EXPENSES}/e1`, () => json({ expense: expenseDetail('e1') }))
  api.on('GET', PHOTOS, () => json(list))
  return api
}
const open = async (permissions?: Parameters<typeof showFinance>[0]) => {
  const handlers = showFinance(permissions)
  openExpensesTab()
  fireEvent.click(await screen.findByRole('button', { name: '사용처 e1' }))
  await screen.findByRole('dialog')
  return handlers
}
const openList = async () => {
  const handlers = await open()
  fireEvent.click(await screen.findByRole('button', { name: '대화에서 고르기' }))
  return handlers
}
const attachButton = () =>
  asElement(screen.getByRole('button', { name: '붙이기' }), HTMLButtonElement)
const chooseFirst = async () => {
  const list = await screen.findByRole('list', { name: '대화 사진 목록' })
  fireEvent.click(within(list).getAllByRole('button')[0]!)
  return screen.findByRole('group', { name: '붙일 대화 사진' })
}

test('목록은 작은 사진과 방 이름·보낸 사람을 보이고, 고르면 미리 보기와 종류와 안내를 보인다', async () => {
  const api = serve({
    photos: [choice(P1), choice(P2, { room: { id: 'r2', type: 'department', name: '기획부' } })],
    truncated: false,
  })
  api.on('POST', `${EXPENSES}/e1/evidence/from-chat`, () => json({ expense: withPhoto }, 201))
  await openList()
  const list = await screen.findByRole('list', { name: '대화 사진 목록' })
  expect(within(list).getByText('운영진 전체방')).toBeTruthy()
  expect(within(list).getByText('기획부')).toBeTruthy()
  expect(within(list).getAllByText('박새내')).toHaveLength(2)
  expect(list.querySelector('img')?.getAttribute('src')).toBe(`${BASE}/files/${P1}`)
  const card = await chooseFirst()
  expect(within(card).getByRole('img').getAttribute('src')).toBe(`${BASE}/files/${P1}`)
  expect(asElement(within(card).getByLabelText('종류'), HTMLSelectElement).value).toBe('receipt')
  expect(within(card).getByText('증빙은 모든 운영진이 봐요.')).toBeTruthy()
  fireEvent.change(within(card).getByLabelText('종류'), { target: { value: 'tax_invoice' } })
  fireEvent.click(attachButton())
  await waitFor(() => expect(screen.queryByRole('group', { name: '붙일 대화 사진' })).toBeNull())
  expect(api.calls.find(call => call.path.endsWith('/from-chat'))?.body).toEqual({
    photoId: P1,
    type: 'tax_invoice',
  })
  expect(screen.getByRole('button', { name: '영수증 1 크게 보기' })).toBeTruthy()
})

test('붙이기를 두 번 눌러도 한 번만 나가고 붙이는 동안 닫을 수 없다', async () => {
  const api = serve()
  const attach = deferredResponse()
  api.on('POST', `${EXPENSES}/e1/evidence/from-chat`, () => attach.promise)
  await openList()
  await chooseFirst()
  fireEvent.click(attachButton())
  fireEvent.click(attachButton())
  await settle()
  expect(api.calls.filter(call => call.path.endsWith('/from-chat'))).toHaveLength(1)
  expect(attachButton().disabled).toBe(true)
  expect(
    asElement(
      within(screen.getByRole('group', { name: '대화에서 사진 고르기' })).getByRole('button', {
        name: '닫기',
      }),
      HTMLButtonElement,
    ).disabled,
  ).toBe(true)
  attach.resolve(json({ expense: withPhoto }, 201))
  await waitFor(() => expect(screen.queryByRole('group', { name: '붙일 대화 사진' })).toBeNull())
})

test('비었으면 한 줄, 잘렸으면 알림이 뜬다', async () => {
  serve({ photos: [], truncated: false })
  await openList()
  expect((await screen.findByText(/고를 수 있는 사진이 아직 없어요/)).textContent).toBeTruthy()
  cleanup()
  serve({ photos: [choice(P1)], truncated: true })
  await openList()
  expect((await screen.findByText(/최근 사진 1장만 보여요/)).textContent).toBeTruthy()
})

test.each([
  ['MESSAGE_INVALID', 409, '볼 수 없는 대화의 사진'],
  ['EVIDENCE_LIMIT', 409, '20장까지'],
  ['STORAGE_NOT_CONFIGURED', 503, '지금은 사진을 올릴 수 없어요'],
  ['UPLOAD_MISMATCH', 400, '증빙으로 붙일 수 없는 파일이에요. 다른 사진을 골라'],
])('붙이기가 %s로 거절되면 그 자리에 문구가 뜬다', async (code, status, text) => {
  const api = serve()
  api.on('POST', `${EXPENSES}/e1/evidence/from-chat`, () => json({ error: code }, status))
  await openList()
  await chooseFirst()
  fireEvent.click(attachButton())
  expect((await screen.findByRole('alert')).textContent).toContain(text)
})

test('볼 수 없게 된 사진(MESSAGE_INVALID)이면 목록을 다시 읽는다', async () => {
  const api = serve()
  api.on('POST', `${EXPENSES}/e1/evidence/from-chat`, () => json({ error: 'MESSAGE_INVALID' }, 409))
  await openList()
  await chooseFirst()
  const before = api.calls.filter(call => call.path === PHOTOS).length
  fireEvent.click(attachButton())
  await screen.findByRole('alert')
  await waitFor(() =>
    expect(api.calls.filter(call => call.path === PHOTOS).length).toBeGreaterThan(before),
  )
})

test('한도에 닿아 올리기 칸이 사라져도 거절 문구는 남고 지출을 다시 읽는다', async () => {
  const api = serve()
  let reads = 0
  api.on('GET', `${EXPENSES}/e1`, () => {
    reads += 1
    const evidence = Array.from({ length: 20 }, (_, index) => ({
      id: `v${index}`,
      type: 'receipt' as const,
      fileId: `f${index}`,
    }))
    return json({ expense: reads > 1 ? expenseDetail('e1', { evidence }) : expenseDetail('e1') })
  })
  api.on('POST', `${EXPENSES}/e1/evidence/from-chat`, () => json({ error: 'EVIDENCE_LIMIT' }, 409))
  await openList()
  await chooseFirst()
  fireEvent.click(attachButton())
  await waitFor(() => expect(screen.queryByRole('button', { name: '붙이기' })).toBeNull())
  expect(screen.getByRole('alert').textContent).toContain('20장까지')
})

test('붙이는 중 권한을 잃으면(403) 닫고 학생회를 다시 읽게 한다', async () => {
  const api = serve()
  api.on('POST', `${EXPENSES}/e1/evidence/from-chat`, () => json({ error: 'FORBIDDEN' }, 403))
  const handlers = await openList()
  await chooseFirst()
  fireEvent.click(attachButton())
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  expect(handlers.onForbidden).toHaveBeenCalled()
})

test('목록을 읽다 권한을 잃으면(403) 닫고, 읽기 실패는 다시 시도를 보인다', async () => {
  const api = serve()
  api.on('GET', PHOTOS, () => json({ error: 'FORBIDDEN' }, 403))
  const handlers = await openList()
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  expect(handlers.onForbidden).toHaveBeenCalled()
  cleanup()
  const failing = serve()
  failing.on('GET', PHOTOS, () => json({ error: 'X' }, 500))
  await openList()
  expect(await screen.findByRole('button', { name: '다시 시도' })).toBeTruthy()
})

test('재정부가 아니면 [대화에서 고르기]가 없다', async () => {
  serve()
  await open(MEMBER_PERMISSIONS)
  expect(screen.queryByRole('button', { name: '대화에서 고르기' })).toBeNull()
})
