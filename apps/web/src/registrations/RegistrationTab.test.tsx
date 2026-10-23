// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { councilView } from '@/test-support/council-fixtures'
import { deferredResponse, json, mockApi } from '@/test-support/mock-api'
import { settle } from '@/test-support/settle'
import {
  ACCOUNTS_PATH,
  ACCOUNT_ID,
  APPLICANTS_PATH,
  FORM_PATH,
  FORMS_PATH,
  STAFF_EVENT_ID,
  accountItem,
  applicant,
  staffForm,
} from '@/test-support/staff-registration-fixtures'
import { PERMISSION_CHANGED } from '@/lib/messages'
import { REGISTRATION_STAFF_ERRORS, REGISTRATION_STAFF_LOST } from '@/lib/registration-messages'
import type { RegistrationAction } from '@vada/contracts'
import { RegistrationTab } from './RegistrationTab'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

type Options = {
  forms?: ReturnType<typeof staffForm>[]
  // 이 행사에서 지금 사람이 할 수 있는 동작(양식 목록 응답). 양식이 없어도 온다.
  actions?: RegistrationAction[]
}

function setup(options: Options = {}) {
  const api = mockApi()
  const forms = options.forms ?? [staffForm()]
  api.on('GET', FORMS_PATH, () =>
    json({
      forms,
      truncated: false,
      actions: options.actions ?? ['registration.manage', 'registration.view_applicants'],
    }),
  )
  api.on('GET', ACCOUNTS_PATH, () =>
    json({
      accounts: [
        accountItem(),
        accountItem({
          id: '00000000-0000-4000-8000-0000000000a2',
          name: '사업 통장',
          type: 'business',
          bank: '신한은행',
        }),
        accountItem({
          id: '00000000-0000-4000-8000-0000000000a3',
          name: '닫은 통장',
          type: 'business',
          closedOn: '2026-01-01',
        }),
      ],
      truncated: false,
    }),
  )
  const view = councilView('c1', { councilRank: null, memberId: 'm9' })
  const handlers = { onForbidden: vi.fn(), onLost: vi.fn() }
  render(<RegistrationTab view={view} eventId={STAFF_EVENT_ID} {...handlers} />)
  return { api, handlers }
}

const posts = (api: ReturnType<typeof mockApi>) => api.calls.filter(call => call.method === 'POST')

test('양식 카드에 이름(긴 글은 줄바꿈), 기간, 신청 수/정원, 출석 수, 상태가 보인다', async () => {
  setup({ forms: [staffForm({ name: '가'.repeat(60) })] })
  const heading = await screen.findByRole('heading', { name: '가'.repeat(60) })
  expect(heading.className).toContain('wrap-anywhere')
  const card = heading.closest('div')?.parentElement as HTMLElement
  expect(card.textContent).toContain('10월 23일 (금) 18:00까지')
  expect(card.textContent).toContain('신청 3/50명 · 출석 1명')
  expect(card.textContent).toContain('신청 받는 중')
})

test('고치기·멈추기·다시 받기는 actions가 있을 때만, 멈춘 양식은 [다시 받기]가 보인다', async () => {
  setup({
    forms: [
      staffForm({ paused: true, status: 'paused' }),
      staffForm({ id: 'f2', name: '둘째', actions: [] }),
    ],
  })
  await screen.findByRole('heading', { name: '환영회 참가 신청' })
  expect(screen.getAllByRole('button', { name: '고치기' })).toHaveLength(1)
  expect(screen.getAllByRole('button', { name: '다시 받기' })).toHaveLength(1)
  expect(screen.queryByRole('button', { name: '멈추기' })).toBeNull()
})

test('[신청 양식 만들기]는 서버가 준 행사 동작에 관리 권한이 있을 때만 보이고(양식이 없어도), [QR로 출석 확인]도 같다', async () => {
  setup({ forms: [staffForm({ actions: [] })], actions: ['registration.view_applicants'] })
  await screen.findByRole('heading', { name: '환영회 참가 신청' })
  expect(screen.queryByRole('button', { name: '신청 양식 만들기' })).toBeNull()
  expect(screen.queryByRole('button', { name: 'QR로 출석 확인' })).toBeNull()
  cleanup()
  setup({ forms: [], actions: ['registration.manage'] })
  expect(await screen.findByRole('button', { name: '신청 양식 만들기' })).toBeTruthy()
  expect(screen.getByRole('button', { name: 'QR로 출석 확인' })).toBeTruthy()
  expect(screen.getByText('아직 신청 양식이 없어요.')).toBeTruthy()
})

async function openCreate(api: ReturnType<typeof mockApi>) {
  fireEvent.click(await screen.findByRole('button', { name: '신청 양식 만들기' }))
  const dialog = await screen.findByRole('dialog', { name: '신청 양식 만들기' })
  fireEvent.change(within(dialog).getByLabelText('이름'), { target: { value: '환영회 신청' } })
  fireEvent.change(within(dialog).getByLabelText('신청 마감'), {
    target: { value: '2026-10-23T18:00' },
  })
  return { api, dialog }
}
const submit = (dialog: HTMLElement) => within(dialog).getByRole('button', { name: '만들기' })

test('만들기: 참가비가 있으면 대표 계좌가 채워지고, 보내는 동안 다시 보내지 않으며, 만든 뒤 닫고 다시 읽는다', async () => {
  const { api } = setup({ forms: [], actions: ['registration.manage'] })
  const pending = deferredResponse()
  api.on('POST', FORMS_PATH, () => pending.promise)
  const { dialog } = await openCreate(api)
  // 참가비를 적기 전에는 계좌 칸이 없다
  expect(within(dialog).queryByRole('combobox')).toBeNull()
  fireEvent.change(within(dialog).getByLabelText('납부자 참가비'), { target: { value: '5000' } })
  expect(submit(dialog)).toHaveProperty('disabled', true)
  fireEvent.change(within(dialog).getByLabelText('미납자 참가비'), { target: { value: '10000' } })
  const select = await within(dialog).findByRole('combobox', { name: '참가비 받을 계좌' })
  await waitFor(() => expect(select).toHaveProperty('value', ACCOUNT_ID))
  expect(within(select).queryByText(/닫은 통장/)).toBeNull()
  fireEvent.click(submit(dialog))
  fireEvent.click(submit(dialog))
  expect(posts(api)).toHaveLength(1)
  expect(posts(api)[0]?.body).toEqual({
    name: '환영회 신청',
    opensAt: null,
    closesAt: '2026-10-23T18:00',
    capacity: null,
    notice: null,
    collectsPhone: false,
    payerFee: 5000,
    nonPayerFee: 10000,
    feeAccountId: ACCOUNT_ID,
  })
  expect(submit(dialog)).toHaveProperty('disabled', true)
  pending.resolve(json({ form: staffForm() }, 201))
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  expect(
    api.calls.filter(call => call.path === FORMS_PATH && call.method === 'GET').length,
  ).toBeGreaterThan(1)
})

test('만들기: 참가비가 없으면 계좌를 보내지 않는다. 마감이 비면 버튼이 꺼진다', async () => {
  const { api } = setup({ forms: [], actions: ['registration.manage'] })
  api.on('POST', FORMS_PATH, () => json({ form: staffForm() }, 201))
  const { dialog } = await openCreate(api)
  fireEvent.change(within(dialog).getByLabelText('신청 마감'), { target: { value: '' } })
  expect(submit(dialog)).toHaveProperty('disabled', true)
  // 꺼진 버튼 옆에 무엇이 비었는지 보인다.
  expect(within(dialog).getByText('넣어야 할 칸: 신청 마감')).toBeTruthy()
  fireEvent.change(within(dialog).getByLabelText('신청 마감'), {
    target: { value: '2026-10-23T18:00' },
  })
  expect(within(dialog).queryByText(/넣어야 할 칸/)).toBeNull()
  fireEvent.click(submit(dialog))
  await waitFor(() => expect(posts(api)).toHaveLength(1))
  expect(posts(api)[0]?.body).toMatchObject({
    payerFee: null,
    nonPayerFee: null,
    feeAccountId: null,
  })
})

test('만들기 409는 버튼 옆에 문구를 보이고 열어 둔다', async () => {
  const { api } = setup({ forms: [], actions: ['registration.manage'] })
  api.on('POST', FORMS_PATH, () => json({ error: 'FEE_ACCOUNT_REQUIRED' }, 409))
  const { dialog } = await openCreate(api)
  fireEvent.click(submit(dialog))
  expect(
    await within(dialog).findByText(REGISTRATION_STAFF_ERRORS.FEE_ACCOUNT_REQUIRED!),
  ).toBeTruthy()
  expect(submit(dialog)).toHaveProperty('disabled', false)
})

test('만들기 429는 문구를, 403은 학생회를 다시 읽게 하고 대화상자를 닫는다', async () => {
  const { api, handlers } = setup({ forms: [], actions: ['registration.manage'] })
  api.on('POST', FORMS_PATH, () => json({ error: 'TOO_MANY_REQUESTS' }, 429))
  const { dialog } = await openCreate(api)
  fireEvent.click(submit(dialog))
  expect(await within(dialog).findByText(REGISTRATION_STAFF_ERRORS.TOO_MANY_REQUESTS!)).toBeTruthy()
  api.on('POST', FORMS_PATH, () => json({ error: 'FORBIDDEN' }, 403))
  fireEvent.click(submit(dialog))
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  expect(handlers.onForbidden).toHaveBeenCalled()
  expect(await screen.findByText(PERMISSION_CHANGED)).toBeTruthy()
})

test('고치기 404는 대화상자를 닫고 이유를 보인다', async () => {
  const { api } = setup()
  api.on('POST', FORM_PATH, () => json({ error: 'NOT_FOUND' }, 404))
  fireEvent.click(await screen.findByRole('button', { name: '고치기' }))
  const dialog = await screen.findByRole('dialog', { name: '신청 양식 고치기' })
  expect(within(dialog).getByLabelText('이름')).toHaveProperty('value', '환영회 참가 신청')
  fireEvent.click(within(dialog).getByRole('button', { name: '저장' }))
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  expect(screen.getByText(REGISTRATION_STAFF_LOST)).toBeTruthy()
})

test('[멈추기]는 보내는 동안 다시 보내지 않고, 409·429는 카드 안에 문구를 보인다', async () => {
  const { api } = setup()
  const pending = deferredResponse()
  api.on('POST', `${FORM_PATH}/pause`, () => pending.promise)
  fireEvent.click(await screen.findByRole('button', { name: '멈추기' }))
  fireEvent.click(screen.getByRole('button', { name: '멈추기' }))
  expect(posts(api)).toHaveLength(1)
  pending.resolve(json({ error: 'TOO_MANY_REQUESTS' }, 429))
  expect(await screen.findByText(REGISTRATION_STAFF_ERRORS.TOO_MANY_REQUESTS!)).toBeTruthy()
})

test('링크와 신청자: 공개 링크 복사와 QR, 지울 날이 보인다', async () => {
  setup({ forms: [staffForm({ actions: [] })] })
  fireEvent.click(await screen.findByRole('button', { name: '링크와 신청자' }))
  expect(screen.getByText(`${window.location.origin}/apply/ABCD2345`)).toBeTruthy()
  expect(screen.getByRole('img', { name: /신청 링크 QR/ })).toBeTruthy()
  expect(screen.getByText('2027년 10월 24일')).toBeTruthy()
  expect(screen.getByRole('button', { name: '링크 복사' })).toBeTruthy()
})

test('열람 권한이 없으면 신청 수만 보이고 신청자 목록을 읽지 않는다', async () => {
  const { api } = setup({ forms: [staffForm({ actions: [] })] })
  fireEvent.click(await screen.findByRole('button', { name: '링크와 신청자' }))
  expect(screen.getByText(/신청은 3명이에요/)).toBeTruthy()
  expect(screen.queryByRole('button', { name: '신청자 보기' })).toBeNull()
  await settle()
  expect(api.calls.some(call => call.path === APPLICANTS_PATH)).toBe(false)
})

async function openApplicants(
  list = [
    applicant(),
    applicant({
      id: 'r2',
      name: '이미납',
      studentId: '20269999',
      payer: false,
      duplicateStudentId: true,
      attended: true,
    }),
  ],
) {
  const view = setup()
  view.api.on('GET', APPLICANTS_PATH, () => json({ applicants: list, truncated: false }))
  fireEvent.click(await screen.findByRole('button', { name: '링크와 신청자' }))
  // 열기 전에는 읽지 않는다(읽을 때마다 열람 기록이 남는다)
  expect(view.api.calls.some(call => call.path === APPLICANTS_PATH)).toBe(false)
  fireEvent.click(screen.getByRole('button', { name: '신청자 보기' }))
  await screen.findByText('김새내')
  return view
}

test('신청자 목록: 이름·학번, 납부자 칩, 같은 학번, 출석이 보이고 이름이나 학번으로 찾는다', async () => {
  await openApplicants()
  const first = screen.getByText('김새내').closest('li') as HTMLElement
  expect(first.textContent).toContain('학번 20260001')
  expect(first.textContent).toContain('납부자')
  const second = screen.getByText('이미납').closest('li') as HTMLElement
  expect(second.textContent).toContain('미납자')
  expect(second.textContent).toContain('같은 학번')
  expect(within(second).getByText('출석')).toBeTruthy()
  fireEvent.change(screen.getByLabelText('이름이나 학번으로 찾기'), { target: { value: '9999' } })
  expect(screen.queryByText('김새내')).toBeNull()
  expect(screen.getByText('이미납')).toBeTruthy()
  fireEvent.change(screen.getByLabelText('이름이나 학번으로 찾기'), { target: { value: '없는' } })
  expect(screen.getByText('찾는 신청자가 없어요.')).toBeTruthy()
})

test('이름으로 [출석]을 누르면 출석이 되고 [출석 취소]로 되돌린다. 보내는 동안 다시 보내지 않는다', async () => {
  const { api } = await openApplicants()
  const base = '/api/organizations/c1/registrations/00000000-0000-4000-8000-0000000000a1'
  const pending = deferredResponse()
  api.on('POST', `${base}/attendance`, () => pending.promise)
  const row = screen.getByText('김새내').closest('li') as HTMLElement
  fireEvent.click(within(row).getByRole('button', { name: '출석' }))
  fireEvent.click(within(row).getByRole('button', { name: '출석' }))
  expect(posts(api)).toHaveLength(1)
  pending.resolve(
    json({ registrationId: 'x', name: '김새내', studentId: '20260001', already: false }),
  )
  await within(row).findByRole('button', { name: '출석 취소' })
  expect(within(row).getByText('출석')).toBeTruthy()
  api.on('POST', `${base}/attendance/cancel`, () => json({ cancelled: true }))
  fireEvent.click(within(row).getByRole('button', { name: '출석 취소' }))
  await within(row).findByRole('button', { name: '출석' })
  // 출석을 바꿔도 목록을 다시 읽지 않는다(열람 기록이 늘지 않는다)
  expect(api.calls.filter(call => call.path === APPLICANTS_PATH)).toHaveLength(1)
})

test('신청 취소는 확인을 거치고, 취소하면 목록에서 빠진다. 출석한 신청은 409 문구를 보인다', async () => {
  const { api } = await openApplicants()
  const base = '/api/organizations/c1/registrations/00000000-0000-4000-8000-0000000000a1'
  api.on('POST', `${base}/cancel`, () => json({ error: 'CHECKED_IN' }, 409))
  const row = screen.getByText('김새내').closest('li') as HTMLElement
  fireEvent.click(within(row).getByRole('button', { name: '신청 취소' }))
  const dialog = await screen.findByRole('dialog')
  expect(dialog.textContent).toContain('되돌릴 수 없어요')
  fireEvent.click(within(dialog).getByRole('button', { name: '신청 취소' }))
  expect(await within(dialog).findByText(REGISTRATION_STAFF_ERRORS.CHECKED_IN!)).toBeTruthy()
  api.on('POST', `${base}/cancel`, () => json({ cancelled: true }))
  fireEvent.click(within(dialog).getByRole('button', { name: '신청 취소' }))
  await waitFor(() => expect(screen.queryByText('김새내')).toBeNull())
  expect(screen.getByText('이미납')).toBeTruthy()
})

test('신청자 목록을 읽다 403이면 학생회를 다시 읽게 하고 이유를 보인다', async () => {
  const view = setup()
  view.api.on('GET', APPLICANTS_PATH, () => json({ error: 'FORBIDDEN' }, 403))
  fireEvent.click(await screen.findByRole('button', { name: '링크와 신청자' }))
  fireEvent.click(screen.getByRole('button', { name: '신청자 보기' }))
  await waitFor(() => expect(view.handlers.onForbidden).toHaveBeenCalled())
  expect(await screen.findByText(PERMISSION_CHANGED)).toBeTruthy()
})
