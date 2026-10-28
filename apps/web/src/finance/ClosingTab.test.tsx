// @vitest-environment jsdom
import { resetAddress } from '@/test-support/address-reset'
import { afterEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import {
  ACTION_GONE,
  CLOSING_ERRORS,
  CLOSING_HIDDEN,
  CLOSING_LOST,
  PERMISSION_CHANGED,
} from '@/lib/messages'
import { settle } from '@/test-support/settle'
import { closingFixture } from '@/test-support/closing-fixtures'
import { MEMBER_PERMISSIONS } from '@/test-support/council-fixtures'
import { serveFinance, showFinance } from '@/test-support/expense-harness'
import { COUNCIL_ID } from '@/test-support/finance-at'
import { CURRENT_PERIOD, periodSummary, standardPeriods } from '@/test-support/income-fixtures'
import { PERIODS } from '@/test-support/income-harness'
import { deferredResponse, json } from '@/test-support/mock-api'

afterEach(async () => {
  cleanup()
  await resetAddress()
  vi.unstubAllGlobals()
})

const CLOSING = `${PERIODS}/${CURRENT_PERIOD}/closing`
const PUBLISH = `${CLOSING}/publish`
const REOPEN = `${CLOSING}/reopen`

function serve(closing = closingFixture(), periods = standardPeriods()) {
  const api = serveFinance()
  api.on('GET', PERIODS, () => json(periods))
  api.on('GET', CLOSING, () => json({ closing }))
  return api
}
const openTab = () => fireEvent.click(screen.getByRole('tab', { name: '결산' }))
const show = async (permissions?: Parameters<typeof showFinance>[0]) => {
  const handlers = showFinance(permissions)
  openTab()
  return handlers
}
const PUBLISHABLE = closingFixture({ actions: ['closing.publish'] })
const PUBLISHED = closingFixture({
  status: 'published',
  publishedAt: '2026-10-20T05:03:00.000Z',
  actions: ['closing.reopen'],
})

test('두 행사의 같은 이름 지출 항목은 행사 이름으로 구별하고 학생회 항목은 그대로 보인다', async () => {
  const closing = closingFixture()
  const item = closing.expense.items[0]!
  serve({
    ...closing,
    expense: {
      ...closing.expense,
      items: [
        { ...item, id: 'spring', purpose: '식비', eventName: '봄 축제' },
        { ...item, id: 'sports', purpose: '식비', eventName: '체육대회' },
        { ...item, id: 'council', purpose: '학생회 운영비', eventName: null },
      ],
    },
  })
  await show()
  expect(await screen.findByText('봄 축제 · 식비')).toBeTruthy()
  expect(screen.getByText('체육대회 · 식비')).toBeTruthy()
  expect(screen.getByText('학생회 운영비')).toBeTruthy()
  expect(screen.queryByText('식비', { exact: true })).toBeNull()
})

test('결산 탭은 상태 배지, 요약, 수입·지출, 계좌별 금액, 점검을 보이고 점검 줄을 누르면 그 지출의 주소로 열린다', async () => {
  serve()
  await show()
  await screen.findByText('작성 중')
  const text = () => document.body.textContent ?? ''
  expect(text()).toContain('전기 이월금')
  expect(text()).toContain('360,000원')
  expect(text()).toContain('지원금 예산')
  expect(text()).toContain('예산 500,000원 · 차이 -100,000원')
  expect(text()).toContain('예산 200,000원 · 차이 50,000원 · 75%')
  expect(text()).toContain('계좌 미지정')
  expect(text()).toContain('증빙이 없는 지출 2개')
  fireEvent.click(screen.getByRole('button', { name: '인쇄소 · 36,000원' }))
  expect(window.location.pathname).toBe(`/expenses/${COUNCIL_ID}/x1`)
})

test('기본 기간은 끝났고 공개하지 않은 가장 이른 기간이고, 없으면 지금 기간이다', async () => {
  const ended = (id: string, name: string, startsOn: string, endsOn: string) =>
    periodSummary(id, { name, startsOn, endsOn, current: false })
  const periods = {
    periods: [
      periodSummary(CURRENT_PERIOD),
      ended('pb', '2021년', '2021-01-01', '2021-12-31'),
      ended('pa', '2020년', '2020-01-01', '2020-12-31'),
      ended('pp', '2019년', '2019-01-01', '2019-12-31'),
    ].map(period => (period.id === 'pp' ? { ...period, status: 'published' as const } : period)),
  }
  const api = serve(closingFixture(), periods)
  api.on('GET', `${PERIODS}/pa/closing`, () => json({ closing: closingFixture() }))
  await show()
  await screen.findByText('작성 중')
  expect(screen.getByLabelText('회계 기간')).toHaveProperty('value', 'pa')
  expect(api.calls.some(call => call.path === `${PERIODS}/pa/closing`)).toBe(true)
  cleanup()
  // 끝나지 않은 기간만 있으면 지금 기간이다.
  serve()
  await show()
  await screen.findByText('작성 중')
  expect(screen.getByLabelText('회계 기간')).toHaveProperty('value', CURRENT_PERIOD)
})

test('공개 전에 재정부가 아니면 결산서를 읽지 않고 안내만 보인다', async () => {
  const api = serve()
  await show(MEMBER_PERMISSIONS)
  expect(await screen.findByText(CLOSING_HIDDEN)).toBeTruthy()
  expect(screen.queryByText('작성 중')).toBeNull()
  expect(api.calls.some(call => call.path === CLOSING)).toBe(false)
})

test('공개 전 결산 읽기는 읽기 권한 closing.view_draft로 가르고 동작 권한 finance.manage를 빌리지 않는다', async () => {
  serve()
  await show([...MEMBER_PERMISSIONS, 'closing.view_draft'])
  expect(await screen.findByText('작성 중')).toBeTruthy()
  expect(screen.queryByText(CLOSING_HIDDEN)).toBeNull()
  expect(screen.queryByRole('button', { name: '공개' })).toBeNull()
})

test('공개 뒤에는 운영진도 결산서를 보고 공개·다시 열기 버튼은 없다', async () => {
  const periods = standardPeriods()
  periods.periods[0] = { ...periods.periods[0]!, status: 'published' }
  serve(closingFixture({ status: 'published', actions: ['closing.export_public'] }), periods)
  await show(MEMBER_PERMISSIONS)
  await screen.findByText('공개됨')
  expect(screen.queryByRole('button', { name: '공개' })).toBeNull()
  expect(screen.queryByRole('button', { name: '다시 열기' })).toBeNull()
})

test('서버 동작에 공개가 없으면 [공개]가 없다', async () => {
  serve()
  await show()
  await screen.findByText('작성 중')
  expect(screen.queryByRole('button', { name: '공개' })).toBeNull()
})

test('공개는 잠금과 이월금을 알리는 확인을 거치고 한 번만 보내며, 끝나면 공개됨과 다시 열기가 보인다', async () => {
  const api = serve(PUBLISHABLE)
  const pending = deferredResponse()
  api.on('POST', PUBLISH, () => pending.promise)
  await show()
  fireEvent.click(await screen.findByRole('button', { name: '공개' }))
  const dialog = screen.getByRole('dialog')
  expect(dialog.textContent).toContain('이월금')
  expect(dialog.textContent).toContain('잠겨서')
  const confirm = within(dialog).getByRole('button', { name: '공개' })
  fireEvent.click(confirm)
  fireEvent.click(confirm)
  expect(api.calls.filter(call => call.method === 'POST')).toHaveLength(1)
  pending.resolve(json({ closing: PUBLISHED }))
  await screen.findByText('공개됨')
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  expect(screen.getByRole('button', { name: '다시 열기' })).toBeTruthy()
  expect(screen.queryByRole('alert')).toBeNull()
})

test('공개가 거절되면 확인을 닫고 문구를 [공개] 옆에 보이며 새로 읽는다', async () => {
  const api = serve(PUBLISHABLE)
  api.on('POST', PUBLISH, () => json({ error: 'FEE_INCOME_PENDING' }, 409))
  await show()
  fireEvent.click(await screen.findByRole('button', { name: '공개' }))
  fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: '공개' }))
  expect((await screen.findByRole('alert')).textContent).toBe(CLOSING_ERRORS.FEE_INCOME_PENDING)
  expect(screen.queryByRole('dialog')).toBeNull()
  await waitFor(() =>
    expect(api.calls.filter(call => call.path === CLOSING).length).toBeGreaterThan(1),
  )
})

test('공개 요청이 연결 실패면 확인이 열린 채 문구를 보이고 다시 누를 수 있다', async () => {
  const api = serve(PUBLISHABLE)
  api.on('POST', PUBLISH, () => json({ error: 'TOO_MANY_REQUESTS' }, 429))
  await show()
  fireEvent.click(await screen.findByRole('button', { name: '공개' }))
  const dialog = screen.getByRole('dialog')
  fireEvent.click(within(dialog).getByRole('button', { name: '공개' }))
  expect((await within(dialog).findByRole('alert')).textContent).toBe(
    CLOSING_ERRORS.TOO_MANY_REQUESTS,
  )
  expect(within(dialog).getByRole('button', { name: '공개' })).toHaveProperty('disabled', false)
})

test('완료하지 않은 행사가 막으면 문구가 버튼 자리에 보이고 행사 줄을 누르면 그 행사의 주소로 열린다', async () => {
  serve(
    closingFixture({
      feePending: {
        blocking: [{ event: { id: 'ev1', name: '가을 MT' }, depositCount: 3, amount: 90000 }],
        nextPeriod: { eventCount: 0, depositCount: 0, amount: 0 },
      },
    }),
  )
  await show()
  expect((await screen.findByText(/완료하지 않은 행사 1개의 참가비/)).textContent).toContain(
    '공개할 수 있어요',
  )
  fireEvent.click(screen.getByRole('button', { name: '가을 MT' }))
  expect(window.location.pathname).toBe(`/events/${COUNCIL_ID}/ev1`)
})

test('다음 기간 행사에 받은 입금은 점검의 정보 줄로만 보이고 [공개]를 끄지 않는다', async () => {
  serve(
    closingFixture({
      actions: ['closing.publish'],
      feePending: { blocking: [], nextPeriod: { eventCount: 1, depositCount: 2, amount: 60000 } },
    }),
  )
  await show()
  expect(
    (await screen.findByText(/다음 기간 행사에 받은 입금 2건 60,000원/)).textContent,
  ).toBeTruthy()
  expect(screen.queryByText(/완료하지 않은 행사/)).toBeNull()
  expect(screen.getByRole('button', { name: '공개' })).toHaveProperty('disabled', false)
})

test('다시 열기는 늘 켜져 있고 사유가 없으면 칸 아래에 알리며 사유를 보낸다', async () => {
  const api = serve(PUBLISHED, {
    periods: [{ ...standardPeriods().periods[0]!, status: 'published' }],
  })
  api.on('POST', REOPEN, () => json({ closing: PUBLISHABLE }))
  await show()
  fireEvent.click(await screen.findByRole('button', { name: '다시 열기' }))
  const dialog = screen.getByRole('dialog')
  const confirm = within(dialog).getByRole('button', { name: '다시 열기' })
  expect(confirm).toHaveProperty('disabled', false)
  fireEvent.click(confirm)
  expect(within(dialog).getByText('다시 여는 사유를 입력해 주세요')).toBeTruthy()
  fireEvent.change(within(dialog).getByLabelText('다시 여는 사유'), { target: { value: '   ' } })
  fireEvent.click(confirm)
  expect(within(dialog).getByText('다시 여는 사유를 입력해 주세요')).toBeTruthy()
  expect(api.calls.some(call => call.path === REOPEN)).toBe(false)
  fireEvent.change(within(dialog).getByLabelText('다시 여는 사유'), {
    target: { value: '증빙 보완' },
  })
  fireEvent.click(confirm)
  await screen.findByText('작성 중')
  expect(api.calls.find(call => call.path === REOPEN)?.body).toEqual({ reason: '증빙 보완' })
})

test('확인을 연 동안 서버 동작에서 공개가 빠지면 확인을 닫고 알린다', async () => {
  const api = serve(PUBLISHABLE)
  let reads = 0
  api.on('GET', CLOSING, () => {
    reads += 1
    return json({ closing: reads > 1 ? closingFixture() : PUBLISHABLE })
  })
  await show()
  fireEvent.click(await screen.findByRole('button', { name: '공개' }))
  document.dispatchEvent(new Event('visibilitychange'))
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  expect((await screen.findByRole('alert')).textContent).toBe(ACTION_GONE)
})

test('기간이 사라지면(404) 이유를 보인다', async () => {
  const api = serve()
  api.on('GET', CLOSING, () => json({ error: 'NOT_FOUND' }, 404))
  await show()
  expect((await screen.findByRole('alert')).textContent).toBe(CLOSING_LOST)
})

test('권한이 바뀌어 읽기가 403이면 학생회를 다시 읽게 한다', async () => {
  const api = serve()
  api.on('GET', CLOSING, () => json({ error: 'FORBIDDEN' }, 403))
  const handlers = await show()
  await waitFor(() => expect(handlers.onForbidden).toHaveBeenCalled())
  expect(api.calls.some(call => call.path === CLOSING)).toBe(true)
})

test('내보내기 버튼은 서버 동작대로 보인다', async () => {
  serve(closingFixture({ actions: ['closing.export_public'] }))
  await show()
  expect(await screen.findByRole('button', { name: '공개용 엑셀' })).toBeTruthy()
  expect(screen.queryByRole('button', { name: '감사용 엑셀' })).toBeNull()
  expect(screen.queryByRole('button', { name: '증빙 묶음 받기' })).toBeNull()
})

test('기본 기간은 처음 한 번만 정한다: 공개해서 목록이 바뀌어도 보던 기간에 남는다', async () => {
  const ended = (id: string, name: string, startsOn: string, endsOn: string) =>
    periodSummary(id, { name, startsOn, endsOn, current: false })
  let published = false
  const api = serveFinance()
  api.on('GET', PERIODS, () =>
    json({
      periods: [
        periodSummary(CURRENT_PERIOD),
        ended('pb', '2021년', '2021-01-01', '2021-12-31'),
        {
          ...ended('pa', '2020년', '2020-01-01', '2020-12-31'),
          ...(published ? { status: 'published' as const } : {}),
        },
      ],
    }),
  )
  api.on('GET', `${PERIODS}/pa/closing`, () => json({ closing: closingFixture() }))
  api.on('GET', `${PERIODS}/pb/closing`, () => json({ closing: closingFixture() }))
  showFinance()
  openTab()
  await screen.findByText('작성 중')
  expect(screen.getByLabelText('회계 기간')).toHaveProperty('value', 'pa')
  const before = api.calls.filter(call => call.path === PERIODS).length
  published = true
  document.dispatchEvent(new Event('visibilitychange'))
  await waitFor(() =>
    expect(api.calls.filter(call => call.path === PERIODS).length).toBeGreaterThan(before),
  )
  await settle()
  expect(screen.getByLabelText('회계 기간')).toHaveProperty('value', 'pa')
})

test.each([
  [403, 'FORBIDDEN', PERMISSION_CHANGED],
  [404, 'NOT_FOUND', CLOSING_LOST],
])('공개가 %i로 거절되면 확인을 닫고 문구를 보인다', async (status, error, message) => {
  const api = serve(PUBLISHABLE)
  api.on('POST', PUBLISH, () => json({ error }, status))
  const handlers = await show()
  fireEvent.click(await screen.findByRole('button', { name: '공개' }))
  fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: '공개' }))
  expect((await screen.findByRole('alert')).textContent).toBe(message)
  expect(screen.queryByRole('dialog')).toBeNull()
  expect(handlers.onForbidden).toHaveBeenCalledTimes(status === 403 ? 1 : 0)
})

test.each([
  [403, 'FORBIDDEN', PERMISSION_CHANGED],
  [404, 'NOT_FOUND', CLOSING_LOST],
])('다시 열기가 %i로 거절되면 확인을 닫고 문구를 보인다', async (status, error, message) => {
  const api = serve(PUBLISHED, {
    periods: [{ ...standardPeriods().periods[0]!, status: 'published' }],
  })
  api.on('POST', REOPEN, () => json({ error }, status))
  const handlers = await show()
  fireEvent.click(await screen.findByRole('button', { name: '다시 열기' }))
  const dialog = screen.getByRole('dialog')
  fireEvent.change(within(dialog).getByLabelText('다시 여는 사유'), { target: { value: '보완' } })
  fireEvent.click(within(dialog).getByRole('button', { name: '다시 열기' }))
  expect((await screen.findByRole('alert')).textContent).toBe(message)
  expect(screen.queryByRole('dialog')).toBeNull()
  expect(handlers.onForbidden).toHaveBeenCalledTimes(status === 403 ? 1 : 0)
})

test('거절 문구는 다시 읽은 값이 온 뒤 다음 읽기 때 지워진다', async () => {
  const api = serve(PUBLISHABLE)
  api.on('POST', PUBLISH, () => json({ error: 'CLOSING_PUBLISHED' }, 409))
  await show()
  fireEvent.click(await screen.findByRole('button', { name: '공개' }))
  fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: '공개' }))
  await screen.findByRole('alert')
  await waitFor(() =>
    expect(api.calls.filter(call => call.path === CLOSING).length).toBeGreaterThan(1),
  )
  document.dispatchEvent(new Event('visibilitychange'))
  await waitFor(() => expect(screen.queryByRole('alert')).toBeNull())
})

test('점검의 요청 줄을 누르면 그 요청의 주소로 열린다', async () => {
  serve(
    closingFixture({
      checks: [
        {
          kind: 'no_reason',
          count: 1,
          targets: [{ type: 'request', id: 'r1', title: '포스터 요청' }],
        },
      ],
    }),
  )
  await show()
  fireEvent.click(await screen.findByRole('button', { name: '포스터 요청' }))
  expect(window.location.pathname).toBe(`/purchases/${COUNCIL_ID}/r1`)
})
