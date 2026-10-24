// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { Action, Applicant, RegistrationAction } from '@vada/contracts'
import { councilView } from '@/test-support/council-fixtures'
import { deferredResponse, json, mockApi } from '@/test-support/mock-api'
import {
  APPLICANTS_PATH,
  FORMS_PATH,
  REGISTRATION_ID,
  STAFF_EVENT_ID,
  applicant,
  staffForm,
} from '@/test-support/staff-registration-fixtures'
import { PERMISSION_CHANGED } from '@/lib/messages'
import { REGISTRATION_STAFF_ERRORS, REGISTRATION_STAFF_LOST } from '@/lib/registration-messages'
import { RegistrationTab } from './RegistrationTab'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const ROW = `/api/organizations/c1/registrations/${REGISTRATION_ID}`
const ALL: RegistrationAction[] = [
  'registration.manage',
  'registration.view_applicants',
  'deposit.confirm',
]
const PAID = { status: 'confirmed', amount: 5000 } as const
const PENDING = { status: 'refund_pending', amount: 5000 } as const

type Options = {
  actions?: RegistrationAction[]
  permissions?: Action[]
  applicants?: Applicant[]
  truncated?: boolean
}

async function open(options: Options = {}) {
  const api = mockApi()
  api.on('GET', FORMS_PATH, () =>
    json({
      forms: [staffForm({ actions: options.actions ?? ALL })],
      truncated: false,
      actions: options.actions ?? ALL,
    }),
  )
  api.on('GET', APPLICANTS_PATH, () =>
    json({
      applicants: options.applicants ?? [applicant()],
      truncated: options.truncated ?? false,
    }),
  )
  api.on('GET', '/api/organizations/c1/accounts', () => json({ accounts: [], truncated: false }))
  const handlers = { onForbidden: vi.fn(), onLost: vi.fn() }
  const view = councilView('c1', {
    memberId: 'm9',
    permissions: options.permissions ?? ['finance.manage'],
  })
  render(
    <RegistrationTab
      view={view}
      eventId={STAFF_EVENT_ID}
      event={null}
      onEditEvent={vi.fn()}
      {...handlers}
    />,
  )
  fireEvent.click(await screen.findByRole('button', { name: '링크와 신청자' }))
  fireEvent.click(await screen.findByRole('button', { name: '신청자 보기' }))
  const row = (await screen.findByText('김새내')).closest('li') as HTMLElement
  return { api, handlers, row }
}
const button = (scope: HTMLElement, name: string) => within(scope).getByRole('button', { name })
const posts = (api: ReturnType<typeof mockApi>) => api.calls.filter(call => call.method === 'POST')

test('입금 상태 칩과 [입금 확인]은 서버가 준 deposit.confirm이 있을 때만 보인다', async () => {
  const { row } = await open({ actions: ['registration.manage', 'registration.view_applicants'] })
  expect(within(row).getByText('입금 안 함')).toBeTruthy()
  expect(within(row).queryByRole('button', { name: '입금 확인' })).toBeNull()
  cleanup()
  const granted = await open()
  expect(button(granted.row, '입금 확인')).toBeTruthy()
})

test('참가비가 없는 신청에는 입금 칩과 [입금 확인]이 없다', async () => {
  const { row } = await open({ applicants: [applicant({ appliedFee: 0 })] })
  expect(within(row).queryByText('입금 안 함')).toBeNull()
  expect(within(row).queryByRole('button', { name: '입금 확인' })).toBeNull()
})

test('입금 확인은 적용 참가비로 한 번만 보내고, 끝나면 칩이 바뀌고 [확인 취소]가 생긴다', async () => {
  const { api, row } = await open()
  const pending = deferredResponse()
  api.on('POST', `${ROW}/deposit`, () => pending.promise)
  fireEvent.click(button(row, '입금 확인'))
  const dialog = await screen.findByRole('dialog')
  expect(dialog.textContent).toContain('5,000원')
  fireEvent.click(within(dialog).getByRole('button', { name: '입금 확인' }))
  fireEvent.click(within(dialog).getByRole('button', { name: '입금 확인' }))
  expect(posts(api)).toHaveLength(1)
  expect(posts(api)[0]?.body).toEqual({ amount: 5000 })
  pending.resolve(json({ deposit: PAID }, 201))
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  expect(within(row).getByText('입금 확인 5,000원')).toBeTruthy()
  expect(button(row, '확인 취소')).toBeTruthy()
  expect(within(row).queryByRole('button', { name: '입금 확인' })).toBeNull()
})

test('입금 확인이 409면 그 창 안에 문구가 보이고 창은 열려 있다', async () => {
  const { api, row } = await open()
  api.on('POST', `${ROW}/deposit`, () => json({ error: 'DEPOSIT_EXISTS' }, 409))
  fireEvent.click(button(row, '입금 확인'))
  const dialog = await screen.findByRole('dialog')
  fireEvent.click(within(dialog).getByRole('button', { name: '입금 확인' }))
  expect(await within(dialog).findByText(REGISTRATION_STAFF_ERRORS.DEPOSIT_EXISTS!)).toBeTruthy()
  api.on('POST', `${ROW}/deposit`, () => json({ error: 'EVENT_COMPLETED' }, 409))
  fireEvent.click(within(dialog).getByRole('button', { name: '입금 확인' }))
  expect(await within(dialog).findByText(REGISTRATION_STAFF_ERRORS.EVENT_COMPLETED!)).toBeTruthy()
})

test('확인 취소는 사유 없이 누르면 보내지 않고 사유 칸 아래에 알리며, 사유를 적으면 보낸다', async () => {
  const { api, row } = await open({ applicants: [applicant({ deposit: PAID })] })
  api.on('POST', `${ROW}/deposit/cancel`, () => json({ deposit: { status: 'none', amount: null } }))
  fireEvent.click(button(row, '확인 취소'))
  const dialog = await screen.findByRole('dialog')
  // 환불 대기가 아니면 결과 안내가 없다.
  expect(dialog.textContent).not.toContain('되돌릴 수 없어요')
  const submit = within(dialog).getByRole('button', { name: '확인 취소' })
  const reason = within(dialog).getByLabelText('취소 사유')
  fireEvent.click(submit)
  expect(within(dialog).getByText('취소 사유를 입력해 주세요')).toBeTruthy()
  expect(reason.getAttribute('aria-invalid')).toBe('true')
  await waitFor(() => expect(document.activeElement).toBe(reason))
  expect(posts(api)).toHaveLength(0)
  fireEvent.change(reason, { target: { value: '잘못 눌렀어요' } })
  fireEvent.click(submit)
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  expect(posts(api)[0]?.body).toEqual({ reason: '잘못 눌렀어요' })
  expect(within(row).getByText('입금 안 함')).toBeTruthy()
})

test('환불 대기 줄에는 [환불함]이 재정부(finance.manage)에게만 보이고, 입금액보다 큰 금액은 보내지 않으며, 환불하면 줄이 빠진다', async () => {
  const pendingRow = applicant({ cancelled: true, deposit: PENDING })
  const none = await open({ applicants: [pendingRow], permissions: [] })
  expect(within(none.row).queryByRole('button', { name: '환불함' })).toBeNull()
  expect(button(none.row, '확인 취소')).toBeTruthy()
  expect(within(none.row).queryByRole('button', { name: '출석' })).toBeNull()
  expect(within(none.row).queryByRole('button', { name: '신청 취소' })).toBeNull()
  cleanup()
  const { api, row } = await open({ applicants: [pendingRow] })
  api.on('POST', `${ROW}/refund`, () => json({ deposit: { status: 'refunded', amount: 5000 } }))
  fireEvent.click(button(row, '환불함'))
  const dialog = await screen.findByRole('dialog')
  expect(dialog.textContent).toContain('이름과 휴대폰 번호가 지워지고 되돌릴 수 없어요.')
  expect(within(dialog).getByText('입금액 5,000원')).toBeTruthy()
  const amount = within(dialog).getByLabelText('환불한 금액(원)')
  expect(amount).toHaveProperty('value', '5000')
  fireEvent.change(amount, { target: { value: '6000' } })
  fireEvent.click(within(dialog).getByRole('button', { name: '환불함' }))
  expect(within(dialog).getByText('1원부터 5,000원 사이로 입력해 주세요')).toBeTruthy()
  expect(amount.getAttribute('aria-invalid')).toBe('true')
  expect(posts(api)).toHaveLength(0)
  fireEvent.change(amount, { target: { value: '3000' } })
  fireEvent.click(within(dialog).getByRole('button', { name: '환불함' }))
  await waitFor(() => expect(screen.queryByText('김새내')).toBeNull())
  expect(posts(api)[0]?.body).toEqual({ amount: 3000 })
  expect(screen.getByText('환불을 표시했어요.')).toBeTruthy()
})

test('입금한 신청을 취소하면 줄이 환불 대기로 바뀌고 학번만 지워진다고 알린다', async () => {
  const { api, row } = await open({ applicants: [applicant({ deposit: PAID })] })
  api.on('POST', `${ROW}/cancel`, () => json({ cancelled: true }))
  fireEvent.click(button(row, '신청 취소'))
  const dialog = await screen.findByRole('dialog')
  expect(dialog.textContent).toContain('학번이 바로 지워지고')
  expect(dialog.textContent).toContain('환불 대기')
  fireEvent.click(within(dialog).getByRole('button', { name: '신청 취소' }))
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  expect(within(row).getByText('환불 대기 5,000원')).toBeTruthy()
  expect(within(row).getByText('취소함')).toBeTruthy()
  expect(within(row).queryByRole('button', { name: '출석' })).toBeNull()
  expect(button(row, '환불함')).toBeTruthy()
})

test('거르기: 입금 안 함과 환불 대기', async () => {
  await open({
    applicants: [
      applicant(),
      applicant({ id: 'p', name: '입금함', deposit: PAID }),
      applicant({ id: 'r', name: '환불기다림', cancelled: true, deposit: PENDING }),
    ],
  })
  fireEvent.click(screen.getByRole('button', { name: '입금 안 함' }))
  expect(screen.getByText('김새내')).toBeTruthy()
  expect(screen.queryByText('입금함')).toBeNull()
  expect(screen.queryByText('환불기다림')).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: '환불 대기' }))
  expect(screen.getByText('환불기다림')).toBeTruthy()
  expect(screen.queryByText('김새내')).toBeNull()
})

type Step = { error: string; status: number; open: string; dialog: string; lost: string }
const LOSSES: Step[] = [
  {
    error: 'NOT_FOUND',
    status: 404,
    open: '입금 확인',
    dialog: '입금 확인',
    lost: REGISTRATION_STAFF_LOST,
  },
  {
    error: 'FORBIDDEN',
    status: 403,
    open: '입금 확인',
    dialog: '입금 확인',
    lost: PERMISSION_CHANGED,
  },
]

test.each(LOSSES)('입금 확인이 $status면 창을 닫고 이유를 부모에게 알린다', async step => {
  const { api, handlers, row } = await open()
  api.on('POST', `${ROW}/deposit`, () => json({ error: step.error }, step.status))
  fireEvent.click(button(row, step.open))
  const dialog = await screen.findByRole('dialog')
  fireEvent.click(within(dialog).getByRole('button', { name: step.dialog }))
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  expect(await screen.findByText(step.lost)).toBeTruthy()
  // 신청이 없어졌으면(404) 줄도 뺀다.
  expect(screen.queryByText('김새내') === null).toBe(step.status === 404)
  expect(handlers.onForbidden).toHaveBeenCalledTimes(step.status === 403 ? 1 : 0)
})

test.each(LOSSES)('환불함이 $status면 창을 닫는다', async step => {
  const { api, row } = await open({
    applicants: [applicant({ cancelled: true, deposit: PENDING })],
  })
  api.on('POST', `${ROW}/refund`, () => json({ error: step.error }, step.status))
  fireEvent.click(button(row, '환불함'))
  const dialog = await screen.findByRole('dialog')
  fireEvent.click(within(dialog).getByRole('button', { name: '환불함' }))
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  expect(await screen.findByText(step.lost)).toBeTruthy()
})

test('확인 취소가 409(환불한 입금)면 창 안에 문구가 보인다', async () => {
  const { api, row } = await open({ applicants: [applicant({ deposit: PAID })] })
  api.on('POST', `${ROW}/deposit/cancel`, () => json({ error: 'DEPOSIT_CLOSED' }, 409))
  fireEvent.click(button(row, '확인 취소'))
  const dialog = await screen.findByRole('dialog')
  fireEvent.change(within(dialog).getByLabelText('취소 사유'), { target: { value: '사유' } })
  fireEvent.click(within(dialog).getByRole('button', { name: '확인 취소' }))
  expect(await within(dialog).findByText(REGISTRATION_STAFF_ERRORS.DEPOSIT_CLOSED!)).toBeTruthy()
})

test('신청이 많아 잘렸으면 거른 뒤에도 일부 안에서만 찾았다고 알린다', async () => {
  await open({ truncated: true })
  expect(screen.getByText('신청이 많아 앞의 일부만 보여요.')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: '환불 대기' }))
  expect(screen.getByText(/앞의 일부 안에서만 찾았어요/)).toBeTruthy()
  expect(screen.getByText('찾는 신청자가 없어요.')).toBeTruthy()
})
