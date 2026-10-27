// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MEMBER_PERMISSIONS, FINANCE_PERMISSIONS } from '@/test-support/council-fixtures'
import { message, messagePage } from '@/test-support/chat-fixtures'
import { chatBase, ChatHarness, openAllRoom, serveChat } from '@/test-support/chat-harness'
import { asElement } from '@/test-support/elements'
import { expenseDetail } from '@/test-support/expense-fixtures'
import { purchaseDetail, purchaseSummary } from '@/test-support/purchase-fixtures'
import { settle } from '@/test-support/settle'
import { accountItem, accountsResponse, MAIN_ACCOUNT_ID } from '@/test-support/account-fixtures'
import { deferredResponse, json } from '@/test-support/mock-api'
import { PERMISSION_CHANGED } from '@/lib/messages'
import { hasUnsavedInput } from '@/lib/leave-guard'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const EXPENSES = `${chatBase}/expenses`
const ME = '11111111-1111-4111-8111-111111111111'
const JAE = '22222222-2222-4222-8222-222222222222'
const MSG = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const PHOTO_1 = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1'
const PHOTO_2 = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2'
// 한국 시각 2020-03-02 10:30
const SENT = '2020-03-02T01:30:00Z'
const RECEIPT = message(MSG, '인쇄소 영수증이에요\n포스터 20장', { senderId: JAE, sentAt: SENT })
const joined = '2026-10-01T01:00:00Z'
const teamOf = () => ({
  members: [
    { id: ME, name: '김회장', councilRank: null, departments: [], joinedAt: joined },
    { id: JAE, name: '이재정', councilRank: null, departments: [], joinedAt: joined },
  ],
  departments: [],
})
const withPhotos = expenseDetail('e7', {
  evidence: [{ id: 'v1', type: 'receipt', fileId: 'f1' }],
  evidenceCount: 1,
})

function serve(sent = RECEIPT) {
  const api = serveChat()
  api.on('GET', `${chatBase}/rooms/r1/messages`, () => json(messagePage([sent])))
  api.on('GET', `${chatBase}/members`, () => json(teamOf()))
  api.on('GET', `${chatBase}/events`, () => json({ events: [], truncated: false }))
  api.on('GET', `${chatBase}/accounts`, () =>
    json(accountsResponse([accountItem(MAIN_ACCOUNT_ID)])),
  )
  api.on('GET', `${chatBase}/purchase-requests?view=all`, () =>
    json({ requests: [], truncated: false }),
  )
  api.on('GET', `${EXPENSES}/e7`, () => json({ expense: expenseDetail('e7') }))
  return api
}
const menuOf = async (name: string) => {
  fireEvent.keyDown(await screen.findByRole('button', { name: '메시지 동작' }), { key: 'Enter' })
  return screen.findByRole('menuitem', { name })
}
const openForm = async () => {
  await openAllRoom()
  fireEvent.click(await menuOf('지출 적기'))
  const form = await screen.findByRole('form', { name: '지출 적기' })
  fireEvent.change(screen.getByLabelText('결제 수단'), { target: { value: 'card' } })
  return form
}
const posts = (api: ReturnType<typeof serve>) =>
  api.calls.filter(call => call.method === 'POST' && call.path === EXPENSES)
const submit = () => asElement(screen.getByRole('button', { name: '적기' }), HTMLButtonElement)
const fill = (label: string, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } })
const value = (label: string) => {
  const field = screen.getByLabelText(label)
  return field instanceof HTMLInputElement || field instanceof HTMLSelectElement ? field.value : ''
}

test('지출 적기는 finance.manage가 있을 때만 메뉴에 있다', async () => {
  serve()
  const view = render(<ChatHarness memberId={ME} permissions={MEMBER_PERMISSIONS} />)
  await openAllRoom()
  await menuOf('구매 요청 만들기')
  expect(screen.queryByRole('menuitem', { name: '지출 적기' })).toBeNull()
  view.unmount()
  cleanup()

  render(<ChatHarness memberId={ME} permissions={FINANCE_PERMISSIONS} />)
  await openAllRoom()
  await menuOf('지출 적기')
})

test('내역은 첫 줄, 결제일은 보낸 날, 먼저 낸 사람은 보낸 사람, 계좌는 대표 계좌로 채워진다. 두 방식 모두 같다', async () => {
  const api = serve()
  render(<ChatHarness memberId={ME} permissions={FINANCE_PERMISSIONS} />)
  await openForm()
  await screen.findByRole('option', { name: '이재정' })
  expect(value('내역')).toBe('인쇄소 영수증이에요')
  expect(value('결제일')).toBe('2020-03-02')
  expect(value('먼저 낸 사람')).toBe(JAE)
  await waitFor(() => expect(value('계좌')).toBe(MAIN_ACCOUNT_ID))
  fireEvent.click(screen.getByRole('button', { name: '요청 없이' }))
  expect(value('내역')).toBe('인쇄소 영수증이에요')
  expect(value('결제일')).toBe('2020-03-02')
  expect(value('먼저 낸 사람')).toBe(JAE)
  fill('사용처', '인쇄소')
  fill('금액(원)', '36000')
  api.on('POST', EXPENSES, () => json({ expense: expenseDetail('e7') }, 201))
  fireEvent.click(submit())
  await screen.findByRole('button', { name: '사진 올리기' })
  expect(posts(api)[0]?.body).toMatchObject({
    description: '인쇄소 영수증이에요',
    paidOn: '2020-03-02',
    paidBy: JAE,
    accountId: MAIN_ACCOUNT_ID,
    sourceMessageId: MSG,
  })
})

test('내 메시지면 먼저 낸 사람은 학생회 돈이고, 떠난 사람의 메시지면 비운다', async () => {
  serve(message(MSG, '영수증', { senderId: ME, sentAt: SENT }))
  const view = render(<ChatHarness memberId={ME} permissions={FINANCE_PERMISSIONS} />)
  await openForm()
  await screen.findByRole('option', { name: '이재정' })
  expect(value('먼저 낸 사람')).toBe('')
  view.unmount()
  cleanup()

  serve(message(MSG, '영수증', { senderId: '99999999-9999-4999-8999-999999999999', sentAt: SENT }))
  render(<ChatHarness memberId={ME} permissions={FINANCE_PERMISSIONS} />)
  await openForm()
  await screen.findByRole('option', { name: '이재정' })
  expect(value('먼저 낸 사람')).toBe('')
})

async function writeDirect(api: ReturnType<typeof serve>) {
  await openForm()
  await screen.findByRole('option', { name: '이재정' })
  fireEvent.click(screen.getByRole('button', { name: '요청 없이' }))
  fill('사용처', '인쇄소')
  fill('금액(원)', '36000')
  return api
}

test('저장하면 상세가 열리고, 메시지 사진이 있으면 공개 안내와 함께 먼저 보이고 사진마다 붙인다', async () => {
  const api = serve(
    message(MSG, '영수증', {
      senderId: JAE,
      sentAt: SENT,
      photos: [{ id: PHOTO_1 }, { id: PHOTO_2 }],
    }),
  )
  api.on('POST', EXPENSES, () => json({ expense: expenseDetail('e7') }, 201))
  const attach = `${EXPENSES}/e7/evidence/from-chat`
  api.on('POST', attach, () => json({ expense: withPhotos }, 201))
  render(<ChatHarness memberId={ME} permissions={FINANCE_PERMISSIONS} />)
  await writeDirect(api)
  fireEvent.click(submit())
  const section = await screen.findByRole('region', { name: '이 메시지의 사진' })
  expect(within(section).getByText('증빙은 모든 운영진이 봐요.')).toBeTruthy()
  fireEvent.click(within(section).getByRole('button', { name: '이 메시지의 사진 2장 붙이기' }))
  await waitFor(() => expect(within(section).getAllByText('붙였어요')).toHaveLength(2))
  const sent = api.calls.filter(call => call.path === attach)
  expect(sent.map(call => call.body)).toEqual([
    { photoId: PHOTO_1, type: 'receipt' },
    { photoId: PHOTO_2, type: 'receipt' },
  ])
  expect(within(section).queryByRole('button', { name: /붙이기/ })).toBeNull()
})

test('사진이 없는 메시지는 사진 붙이기 칸이 없고 메시지 아래에 지출이 바로 연결된다', async () => {
  const api = serve()
  api.on('POST', EXPENSES, () => json({ expense: expenseDetail('e7') }, 201))
  render(<ChatHarness memberId={ME} permissions={FINANCE_PERMISSIONS} />)
  await writeDirect(api)
  fireEvent.click(submit())
  await screen.findByRole('button', { name: '사진 올리기' })
  expect(screen.queryByRole('region', { name: '이 메시지의 사진' })).toBeNull()
  fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: '닫기' }))
  expect(
    screen.getByRole('button', { name: `지출 · ${expenseDetail('e7').description}` }),
  ).toBeTruthy()
})

const twoPhotos = () =>
  serve(
    message(MSG, '영수증', {
      senderId: JAE,
      sentAt: SENT,
      photos: [{ id: PHOTO_1 }, { id: PHOTO_2 }],
    }),
  )
const photoIdsSent = (api: ReturnType<typeof serve>, path: string) =>
  api.calls
    .filter(call => call.path === path)
    .map(call => (call.body as { photoId: string }).photoId)

test('1번은 붙고 2번이 실패하면 이유가 그 자리에 보이고, 다시 누르면 2번만 보낸다', async () => {
  const api = twoPhotos()
  api.on('POST', EXPENSES, () => json({ expense: expenseDetail('e7') }, 201))
  const attach = `${EXPENSES}/e7/evidence/from-chat`
  let calls = 0
  api.on('POST', attach, () => {
    calls += 1
    return calls === 2
      ? json({ error: 'STORAGE_NOT_CONFIGURED' }, 503)
      : json({ expense: withPhotos }, 201)
  })
  render(<ChatHarness memberId={ME} permissions={FINANCE_PERMISSIONS} />)
  await writeDirect(api)
  fireEvent.click(submit())
  const section = await screen.findByRole('region', { name: '이 메시지의 사진' })
  fireEvent.click(within(section).getByRole('button', { name: '이 메시지의 사진 2장 붙이기' }))
  expect(await within(section).findByText(/지금은 사진을 올릴 수 없어요/)).toBeTruthy()
  expect(within(section).getAllByText('붙였어요')).toHaveLength(1)
  fireEvent.click(within(section).getByRole('button', { name: '이 메시지의 사진 1장 붙이기' }))
  await waitFor(() => expect(within(section).getAllByText('붙였어요')).toHaveLength(2))
  expect(photoIdsSent(api, attach)).toEqual([PHOTO_1, PHOTO_2, PHOTO_2])
})

test('붙이는 중에는 두 번 눌러도 보내지 않는다', async () => {
  const api = twoPhotos()
  api.on('POST', EXPENSES, () => json({ expense: expenseDetail('e7') }, 201))
  const attach = `${EXPENSES}/e7/evidence/from-chat`
  const pending = deferredResponse()
  api.on('POST', attach, () => pending.promise)
  render(<ChatHarness memberId={ME} permissions={FINANCE_PERMISSIONS} />)
  await writeDirect(api)
  fireEvent.click(submit())
  const section = await screen.findByRole('region', { name: '이 메시지의 사진' })
  const button = within(section).getByRole('button', { name: '이 메시지의 사진 2장 붙이기' })
  fireEvent.click(button)
  fireEvent.click(button)
  await waitFor(() => expect(photoIdsSent(api, attach)).toEqual([PHOTO_1]))
  expect(asElement(button, HTMLButtonElement).disabled).toBe(true)
  pending.resolve(json({ expense: withPhotos }, 201))
  await waitFor(() => expect(photoIdsSent(api, attach)).toEqual([PHOTO_1, PHOTO_2]))
})

test.each(['EXPENSE_CANCELLED', 'EVIDENCE_LIMIT'])(
  '붙이는 중 %s로 거절되면 멈추고, 붙이는 칸이 사라져도 이유가 남는다',
  async code => {
    const api = twoPhotos()
    api.on('POST', EXPENSES, () => json({ expense: expenseDetail('e7') }, 201))
    const attach = `${EXPENSES}/e7/evidence/from-chat`
    api.on('POST', attach, () => json({ error: code }, 409))
    render(<ChatHarness memberId={ME} permissions={FINANCE_PERMISSIONS} />)
    await writeDirect(api)
    fireEvent.click(submit())
    const section = await screen.findByRole('region', { name: '이 메시지의 사진' })
    api.on('GET', `${EXPENSES}/e7`, () =>
      json({
        expense: expenseDetail('e7', {
          cancelled: code === 'EXPENSE_CANCELLED',
          actions: [],
          evidence: Array.from({ length: code === 'EVIDENCE_LIMIT' ? 20 : 0 }, (_, index) => ({
            id: `v${index}`,
            type: 'receipt' as const,
            fileId: `f${index}`,
          })),
        }),
      }),
    )
    fireEvent.click(within(section).getByRole('button', { name: '이 메시지의 사진 2장 붙이기' }))
    await waitFor(() =>
      expect(screen.queryByRole('region', { name: '이 메시지의 사진' })).toBeNull(),
    )
    expect(
      await screen.findByText(code === 'EXPENSE_CANCELLED' ? /이미 취소된 지출/ : /20장까지/),
    ).toBeTruthy()
    expect(photoIdsSent(api, attach)).toEqual([PHOTO_1])
  },
)

test('대화 사진 붙이기의 파일 오류는 사진용 문구다', async () => {
  const api = serve(
    message(MSG, '영수증', { senderId: JAE, sentAt: SENT, photos: [{ id: PHOTO_1 }] }),
  )
  api.on('POST', EXPENSES, () => json({ expense: expenseDetail('e7') }, 201))
  api.on('POST', `${EXPENSES}/e7/evidence/from-chat`, () => json({ error: 'UPLOAD_MISMATCH' }, 400))
  render(<ChatHarness memberId={ME} permissions={FINANCE_PERMISSIONS} />)
  await writeDirect(api)
  fireEvent.click(submit())
  const section = await screen.findByRole('region', { name: '이 메시지의 사진' })
  fireEvent.click(within(section).getByRole('button', { name: '이 메시지의 사진 1장 붙이기' }))
  expect(await within(section).findByText(/증빙으로 붙일 수 없는 파일이에요/)).toBeTruthy()
  expect(within(section).queryByText(/빼고 다시 올려/)).toBeNull()
})

test('보내는 동안 두 번 누를 수 없다', async () => {
  const api = serve()
  const pending = deferredResponse()
  api.on('POST', EXPENSES, () => pending.promise)
  render(<ChatHarness memberId={ME} permissions={FINANCE_PERMISSIONS} />)
  await writeDirect(api)
  fireEvent.click(submit())
  fireEvent.click(submit())
  fireEvent.submit(screen.getByRole('form', { name: '지출 적기' }))
  await waitFor(() => expect(posts(api)).toHaveLength(1))
  pending.resolve(json({ error: 'MESSAGE_INVALID' }, 409))
  expect(await screen.findByText(/이 메시지를 근거로 할 수 없어요/)).toBeTruthy()
  expect(screen.queryByText(/이 사진은 붙일 수 없어요/)).toBeNull()
  expect(screen.getByRole('dialog')).toBeTruthy()
})

test('403이면 닫고 이유를 보인다', async () => {
  const api = serve()
  api.on('POST', EXPENSES, () => json({ error: 'FORBIDDEN' }, 403))
  render(<ChatHarness memberId={ME} permissions={FINANCE_PERMISSIONS} />)
  await writeDirect(api)
  fireEvent.click(submit())
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  expect(screen.getByText(PERMISSION_CHANGED)).toBeTruthy()
})

test('404면 닫고 이유를 보인다', async () => {
  const api = serve()
  api.on('POST', EXPENSES, () => json({ error: 'NOT_FOUND' }, 404))
  render(<ChatHarness memberId={ME} permissions={FINANCE_PERMISSIONS} />)
  await writeDirect(api)
  fireEvent.click(submit())
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  expect(screen.getByText(/볼 수 없어요/)).toBeTruthy()
})

test('다른 운영진이 먼저 적어 중복이면 양식을 보존하고 제출 옆에 이유를 보인다', async () => {
  const api = serve()
  api.on('POST', EXPENSES, () => json({ error: 'SOURCE_MESSAGE_USED' }, 409))
  render(<ChatHarness memberId={ME} permissions={FINANCE_PERMISSIONS} />)
  await writeDirect(api)
  fireEvent.click(submit())
  expect(
    await screen.findByText(
      '이 메시지로 만든 지출이 이미 있어요. 대화에서 기존 지출을 확인해 주세요.',
    ),
  ).toBeTruthy()
  expect(value('사용처')).toBe('인쇄소')
})

const LINKED = '0199d1a0-0000-7000-8000-00000000a001'
const OTHER = '0199d1a0-0000-7000-8000-00000000a002'
const linkedTo = (...ids: string[]) =>
  message(MSG, '간식 샀어요', {
    senderId: JAE,
    sentAt: SENT,
    made: ids.map(id => ({ kind: 'purchase_request' as const, id, title: id, blocking: true })),
  })
function serveRequests(sent: ReturnType<typeof message>, payableIds: string[]) {
  const api = serve(sent)
  api.on('GET', `${chatBase}/purchase-requests?view=all`, () =>
    json({
      requests: [LINKED, OTHER].map(id =>
        purchaseSummary(id, {
          title: id === LINKED ? '간식행사 즉석식품 구입' : '다른 요청',
          status: 'approved',
          payable: payableIds.includes(id),
        }),
      ),
      truncated: false,
    }),
  )
  for (const id of [LINKED, OTHER])
    api.on('GET', `${chatBase}/purchase-requests/${id}`, () =>
      json({ request: purchaseDetail(id, { body: `${id} 본문` }) }),
    )
  return api
}

test('메시지에 결제할 수 있는 요청 하나가 연결돼 있으면 그 요청을 골라 두고, 사람이 바꾸거나 풀 수 있다', async () => {
  serveRequests(linkedTo(LINKED), [LINKED, OTHER])
  render(<ChatHarness memberId={ME} permissions={FINANCE_PERMISSIONS} />)
  await openForm()
  await waitFor(() => expect(value('결제할 요청')).toBe(LINKED))
  // 사람이 고른 것과 같다: 내역은 요청 제목, 사유는 요청 본문이다.
  expect(value('내역')).toBe('간식행사 즉석식품 구입')
  await waitFor(() =>
    expect(asElement(screen.getByLabelText('사유'), HTMLTextAreaElement).value).toBe(
      `${LINKED} 본문`,
    ),
  )
  fill('결제할 요청', OTHER)
  expect(value('결제할 요청')).toBe(OTHER)
  fill('결제할 요청', '')
  await settle()
  expect(value('결제할 요청')).toBe('')
})

test.each([
  ['연결된 요청이 없으면', [] as string[], [LINKED, OTHER]],
  ['연결된 요청이 둘이면', [LINKED, OTHER], [LINKED, OTHER]],
  ['연결된 요청을 결제할 수 없으면', [LINKED], [OTHER]],
])('%s 요청을 고르지 않는다', async (_, linked, payableIds) => {
  serveRequests(linkedTo(...linked), payableIds)
  render(<ChatHarness memberId={ME} permissions={FINANCE_PERMISSIONS} />)
  await openForm()
  await screen.findByRole('option', { name: '다른 요청' })
  await settle()
  expect(value('결제할 요청')).toBe('')
  expect(value('내역')).toBe('간식 샀어요')
})

test('저절로 골라 채운 것만 있으면 떠날 때 묻지 않고, 사람이 고치면 묻는다', async () => {
  serveRequests(linkedTo(LINKED), [LINKED, OTHER])
  render(<ChatHarness memberId={ME} permissions={FINANCE_PERMISSIONS} />)
  await openAllRoom()
  fireEvent.click(await menuOf('지출 적기'))
  await screen.findByRole('form', { name: '지출 적기' })
  await waitFor(() =>
    expect(asElement(screen.getByLabelText('사유'), HTMLTextAreaElement).value).toBe(
      `${LINKED} 본문`,
    ),
  )
  await settle()
  expect(hasUnsavedInput()).toBe(false)
  fill('사용처', '편의점')
  expect(hasUnsavedInput()).toBe(true)
})

test('요청 목록을 읽기 전에 쓴 사용처와 내역은 연결된 요청을 골라 둬도 그대로다', async () => {
  const api = serveRequests(linkedTo(LINKED), [LINKED, OTHER])
  const list = deferredResponse()
  api.on('GET', `${chatBase}/purchase-requests?view=all`, () => list.promise)
  render(<ChatHarness memberId={ME} permissions={FINANCE_PERMISSIONS} />)
  await openForm()
  fill('사용처', '쿠팡')
  fill('내역', '간식 구입')
  list.resolve(
    json({
      requests: [purchaseSummary(LINKED, { title: '간식행사 즉석식품 구입', payable: true })],
      truncated: false,
    }),
  )
  await waitFor(() => expect(value('결제할 요청')).toBe(LINKED))
  await settle()
  expect(value('사용처')).toBe('쿠팡')
  expect(value('내역')).toBe('간식 구입')
  expect(hasUnsavedInput()).toBe(true)
})

test('골라 둔 요청을 풀고 방식을 오가도 다시 골라 두지 않는다', async () => {
  serveRequests(linkedTo(LINKED), [LINKED, OTHER])
  render(<ChatHarness memberId={ME} permissions={FINANCE_PERMISSIONS} />)
  await openForm()
  await waitFor(() => expect(value('결제할 요청')).toBe(LINKED))
  fill('결제할 요청', '')
  fireEvent.click(screen.getByRole('button', { name: '요청 없이' }))
  fill('사용처', '편의점')
  fireEvent.click(screen.getByRole('button', { name: '요청한 품목 결제' }))
  await screen.findByRole('option', { name: '다른 요청' })
  await settle()
  expect(value('결제할 요청')).toBe('')
  expect(value('사용처')).toBe('편의점')
  expect(hasUnsavedInput()).toBe(true)
})

test('요청 목록을 읽기 전에 방식을 바꿨으면 돌아와도 요청을 골라 두지 않는다', async () => {
  const api = serveRequests(linkedTo(LINKED), [LINKED, OTHER])
  const list = deferredResponse()
  const listed = () =>
    json({
      requests: [purchaseSummary(LINKED, { title: '간식행사 즉석식품 구입', payable: true })],
      truncated: false,
    })
  let first = true
  api.on('GET', `${chatBase}/purchase-requests?view=all`, () => {
    if (!first) return listed()
    first = false
    return list.promise
  })
  render(<ChatHarness memberId={ME} permissions={FINANCE_PERMISSIONS} />)
  await openForm()
  fireEvent.click(screen.getByRole('button', { name: '요청 없이' }))
  list.resolve(listed())
  await settle()
  fireEvent.click(screen.getByRole('button', { name: '요청한 품목 결제' }))
  await screen.findByRole('option', { name: '간식행사 즉석식품 구입' })
  await settle()
  expect(value('결제할 요청')).toBe('')
})

test('골라 둔 요청의 품목을 골랐다 풀고 사용처를 비우면 떠날 때 묻지 않는다', async () => {
  const api = serveRequests(linkedTo(LINKED), [LINKED, OTHER])
  const item = { ...purchaseDetail().items[0]!, amount: 1000, status: 'approved' as const }
  api.on('GET', `${chatBase}/purchase-requests/${LINKED}`, () =>
    json({
      request: purchaseDetail(LINKED, { body: '본문', items: [{ ...item, payable: true }] }),
    }),
  )
  render(<ChatHarness memberId={ME} permissions={FINANCE_PERMISSIONS} />)
  // 결제 수단을 고르면 사람이 쓴 것이라, 폼만 연다.
  await openAllRoom()
  fireEvent.click(await menuOf('지출 적기'))
  const checkbox = await screen.findByRole('checkbox', { name: /A2 포스터/ })
  await settle()
  expect(hasUnsavedInput()).toBe(false)
  fireEvent.click(checkbox)
  expect(value('사용처')).toBe('example.com')
  fireEvent.click(checkbox)
  fill('사용처', '')
  expect(hasUnsavedInput()).toBe(false)
})
