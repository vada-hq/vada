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
  applicantChange,
  staffForm,
} from '@/test-support/staff-registration-fixtures'
import { PERMISSION_CHANGED } from '@/lib/messages'
import {
  REGISTRATION_ACTION_GONE,
  REGISTRATION_STAFF_ERRORS,
  REGISTRATION_STAFF_LOST,
} from '@/lib/registration-messages'
import type { EventDetail, FormListAction } from '@vada/contracts'
import { eventDetail } from '@/test-support/event-fixtures'
import { RegistrationTab } from './RegistrationTab'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

type Options = {
  forms?: ReturnType<typeof staffForm>[]
  // 이 행사에서 지금 사람이 할 수 있는 동작(양식 목록 응답). 양식이 없어도 온다.
  actions?: FormListAction[]
  // 행사 상세. 읽기 전이면 null이다.
  event?: EventDetail | null
}

function setup(options: Options = {}) {
  const api = mockApi()
  const forms = options.forms ?? [staffForm()]
  api.on('GET', FORMS_PATH, () =>
    json({
      forms,
      truncated: false,
      actions: options.actions ?? ['form.create'],
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
  const onEditEvent = vi.fn()
  render(
    <RegistrationTab
      view={view}
      eventId={STAFF_EVENT_ID}
      event={options.event === undefined ? eventDetail() : options.event}
      onEditEvent={onEditEvent}
      {...handlers}
    />,
  )
  return { api, handlers, onEditEvent }
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
  setup({ forms: [staffForm({ actions: [] })], actions: [] })
  await screen.findByRole('heading', { name: '환영회 참가 신청' })
  expect(screen.queryByRole('button', { name: '신청 양식 만들기' })).toBeNull()
  expect(screen.queryByRole('button', { name: 'QR로 출석 확인' })).toBeNull()
  cleanup()
  setup({ forms: [], actions: ['form.create'] })
  expect(await screen.findByRole('button', { name: '신청 양식 만들기' })).toBeTruthy()
  expect(screen.getByText('신청 양식 없음')).toBeTruthy()
  // QR 출석은 목록이 아니라 양식의 form.check_in으로 가른다.
  expect(screen.queryByRole('button', { name: 'QR로 출석 확인' })).toBeNull()
  cleanup()
  setup({ forms: [staffForm({ actions: ['form.check_in'] })], actions: [] })
  expect(await screen.findByRole('button', { name: 'QR로 출석 확인' })).toBeTruthy()
  expect(screen.queryByRole('button', { name: '신청 양식 만들기' })).toBeNull()
})

async function openCreate(api: ReturnType<typeof mockApi>) {
  fireEvent.click(await screen.findByRole('button', { name: '신청 양식 만들기' }))
  const form = await screen.findByRole('form', { name: '신청 양식 만들기' })
  fireEvent.change(within(form).getByLabelText('양식 이름'), { target: { value: '환영회 신청' } })
  fireEvent.change(within(form).getByLabelText('신청 마감'), {
    target: { value: '2026-10-23T18:00' },
  })
  return { api, form }
}
const submit = (form: HTMLElement) => within(form).getByRole('button', { name: '만들기' })

test('만들기는 목록 대신 탭 안 화면으로 열리고, 양식 이름은 참가 신청, 참가비는 없음, 학번은 받는 것으로 시작하며 [신청 양식 목록]으로 돌아간다', async () => {
  setup({ forms: [], actions: ['form.create'] })
  fireEvent.click(await screen.findByRole('button', { name: '신청 양식 만들기' }))
  const form = await screen.findByRole('form', { name: '신청 양식 만들기' })
  expect(screen.queryByRole('dialog')).toBeNull()
  expect(screen.queryByText('신청 양식 없음')).toBeNull()
  expect(within(form).getByLabelText('양식 이름')).toHaveProperty('value', '참가 신청')
  expect(within(form).getByLabelText('신청 마감').getAttribute('aria-required')).toBe('true')
  expect(within(form).getByLabelText('없음')).toHaveProperty('checked', true)
  expect(within(form).queryByLabelText('학생회비 납부자 별도 금액')).toBeNull()
  expect(within(form).getByRole('checkbox', { name: '이름' })).toHaveProperty('disabled', true)
  expect(within(form).getByRole('checkbox', { name: '학번' })).toHaveProperty('checked', true)
  expect(within(form).getByRole('checkbox', { name: '휴대폰 번호' })).toHaveProperty(
    'checked',
    false,
  )
  fireEvent.click(screen.getByRole('button', { name: '신청 양식 목록' }))
  expect(screen.queryByRole('form', { name: '신청 양식 만들기' })).toBeNull()
  expect(screen.getByText('신청 양식 없음')).toBeTruthy()
})

test('만들기 화면에 행사 정보와 미리보기가 있고, 빈 장소의 [입력]은 행사 고치기를 그 칸으로 연다', async () => {
  const { onEditEvent } = setup({
    forms: [],
    actions: ['form.create'],
    event: eventDetail({ place: null }, ['event.update']),
  })
  fireEvent.click(await screen.findByRole('button', { name: '신청 양식 만들기' }))
  const form = await screen.findByRole('form', { name: '신청 양식 만들기' })
  expect(within(form).getByText('행사 정보')).toBeTruthy()
  expect(within(form).getByText('미정')).toBeTruthy()
  fireEvent.click(within(form).getByRole('button', { name: '입력' }))
  expect(onEditEvent).toHaveBeenCalledWith('place')
  const preview = within(form).getByRole('region', { name: '미리보기' })
  expect(preview.textContent).toContain('신입생 환영회')
})

test('행사를 읽기 전이면 만들기 화면에 행사 정보와 미리보기가 없다', async () => {
  setup({ forms: [], actions: ['form.create'], event: null })
  fireEvent.click(await screen.findByRole('button', { name: '신청 양식 만들기' }))
  const form = await screen.findByRole('form', { name: '신청 양식 만들기' })
  expect(within(form).queryByText('행사 정보')).toBeNull()
  expect(within(form).queryByRole('region', { name: '미리보기' })).toBeNull()
})

test('행사를 읽기 전에 만들어도 이 행사의 양식으로 보낸다', async () => {
  const { api } = setup({ forms: [], actions: ['form.create'], event: null })
  api.on('POST', FORMS_PATH, () => json({ form: staffForm() }, 201))
  const { form } = await openCreate(api)
  fireEvent.click(submit(form))
  await waitFor(() => expect(api.calls.some(call => call.method === 'POST')).toBe(true))
  expect(posts(api).map(call => call.path)).toEqual([FORMS_PATH])
})

test('만들기: 납부자 별도 금액이면 두 참가비를 받고 학번은 잠겨 받으며, 대표 계좌가 채워지고, 보내는 동안 다시 보내지 않으며, 만든 뒤 링크와 QR을 보이고 다시 읽는다', async () => {
  const { api } = setup({ forms: [], actions: ['form.create'] })
  const pending = deferredResponse()
  api.on('POST', FORMS_PATH, () => pending.promise)
  const { form } = await openCreate(api)
  // 참가비를 적기 전에는 계좌 칸이 없다
  expect(within(form).queryByRole('combobox')).toBeNull()
  fireEvent.click(within(form).getByLabelText('있음'))
  fireEvent.click(within(form).getByLabelText('학생회비 납부자 별도 금액'))
  expect(within(form).getByRole('checkbox', { name: '학번' })).toHaveProperty('disabled', true)
  expect(within(form).getByRole('checkbox', { name: '학번' })).toHaveProperty('checked', true)
  fireEvent.change(within(form).getByLabelText('납부자 참가비(원)'), {
    target: { value: '5000' },
  })
  // 미납자 참가비가 비면 보내지 않고 그 칸 아래에 알린다.
  fireEvent.click(submit(form))
  const nonPayer = within(form).getByLabelText('미납자 참가비(원)')
  expect(within(form).getByText('미납자 참가비를 입력해 주세요')).toBeTruthy()
  expect(nonPayer.getAttribute('aria-invalid')).toBe('true')
  await waitFor(() => expect(document.activeElement).toBe(nonPayer))
  expect(posts(api)).toHaveLength(0)
  fireEvent.change(nonPayer, { target: { value: '10000' } })
  const select = await within(form).findByRole('combobox', { name: '참가비 받을 계좌' })
  await waitFor(() => expect(select).toHaveProperty('value', ACCOUNT_ID))
  expect(within(select).getByText('계좌 선택')).toBeTruthy()
  expect(within(select).queryByText(/닫은 통장/)).toBeNull()
  fireEvent.click(submit(form))
  fireEvent.click(submit(form))
  expect(posts(api)).toHaveLength(1)
  expect(posts(api)[0]?.body).toEqual({
    name: '환영회 신청',
    opensAt: null,
    closesAt: '2026-10-23T18:00',
    capacity: null,
    notice: null,
    collectsPhone: false,
    collectsStudentId: true,
    payerFee: 5000,
    nonPayerFee: 10000,
    feeAccountId: ACCOUNT_ID,
  })
  expect(submit(form)).toHaveProperty('disabled', true)
  pending.resolve(json({ form: staffForm() }, 201))
  expect(await screen.findByRole('heading', { name: '신청 양식 생성 완료' })).toBeTruthy()
  expect(screen.queryByRole('form', { name: '신청 양식 만들기' })).toBeNull()
  expect(screen.getByText('환영회 참가 신청')).toBeTruthy()
  expect(screen.getByText(`${window.location.origin}/apply/ABCD2345`)).toBeTruthy()
  expect(screen.getByRole('button', { name: '링크 복사' })).toBeTruthy()
  expect(screen.getByRole('img', { name: /신청 링크 QR/ })).toBeTruthy()
  expect(
    api.calls.filter(call => call.path === FORMS_PATH && call.method === 'GET').length,
  ).toBeGreaterThan(1)
  fireEvent.click(screen.getByRole('button', { name: '목록으로' }))
  expect(await screen.findByRole('button', { name: '신청 양식 만들기' })).toBeTruthy()
  expect(screen.queryByRole('heading', { name: '신청 양식 생성 완료' })).toBeNull()
})

test('만들기: 참가비가 있는데 계좌를 고르지 않으면 보내지 않고 계좌 칸 아래에 알린다', async () => {
  const { api } = setup({ forms: [], actions: ['form.create'] })
  const { form } = await openCreate(api)
  fireEvent.click(within(form).getByLabelText('있음'))
  fireEvent.change(within(form).getByLabelText('참가비(원)'), { target: { value: '5000' } })
  const select = await within(form).findByRole<HTMLSelectElement>('combobox', {
    name: '참가비 받을 계좌',
  })
  await waitFor(() => expect(select).toHaveProperty('value', ACCOUNT_ID))
  fireEvent.change(select, { target: { value: select.options[0]?.value } })
  fireEvent.click(submit(form))
  expect(within(form).getByText('참가비 받을 계좌를 골라 주세요')).toBeTruthy()
  expect(select.getAttribute('aria-invalid')).toBe('true')
  expect(posts(api)).toHaveLength(0)
})

test('만들기: 참가비가 없으면 계좌를 보내지 않는다. 마감이 비면 눌러도 보내지 않고 마감 칸 아래에 알리며 그 칸으로 옮긴다', async () => {
  const { api } = setup({ forms: [], actions: ['form.create'] })
  api.on('POST', FORMS_PATH, () => json({ form: staffForm() }, 201))
  const { form } = await openCreate(api)
  const closes = within(form).getByLabelText('신청 마감')
  fireEvent.change(closes, { target: { value: '' } })
  expect(submit(form)).toHaveProperty('disabled', false)
  fireEvent.click(submit(form))
  expect(within(form).getByText('신청 마감을 입력해 주세요')).toBeTruthy()
  expect(closes.getAttribute('aria-invalid')).toBe('true')
  await waitFor(() => expect(document.activeElement).toBe(closes))
  expect(posts(api)).toHaveLength(0)
  fireEvent.change(closes, { target: { value: '2026-10-23T18:00' } })
  expect(within(form).queryByText('신청 마감을 입력해 주세요')).toBeNull()
  fireEvent.click(submit(form))
  await waitFor(() => expect(posts(api)).toHaveLength(1))
  expect(posts(api)[0]?.body).toMatchObject({
    payerFee: null,
    nonPayerFee: null,
    feeAccountId: null,
  })
})

test('만들기: 정원이 1 이상의 숫자가 아니면 보내지 않고 정원 칸 아래에 알린다', async () => {
  const { api } = setup({ forms: [], actions: ['form.create'] })
  const { form } = await openCreate(api)
  fireEvent.change(within(form).getByLabelText('정원'), { target: { value: '0' } })
  fireEvent.click(submit(form))
  expect(within(form).getByText('1 이상의 숫자를 입력해 주세요')).toBeTruthy()
  expect(posts(api)).toHaveLength(0)
})

test('만들기 409는 버튼 옆에 문구를 보이고 열어 둔다', async () => {
  const { api } = setup({ forms: [], actions: ['form.create'] })
  api.on('POST', FORMS_PATH, () => json({ error: 'FEE_ACCOUNT_REQUIRED' }, 409))
  const { form } = await openCreate(api)
  fireEvent.click(submit(form))
  expect(
    await within(form).findByText(REGISTRATION_STAFF_ERRORS.FEE_ACCOUNT_REQUIRED!),
  ).toBeTruthy()
  expect(submit(form)).toHaveProperty('disabled', false)
})

test('만들기 429는 문구를, 403은 학생회를 다시 읽게 하고 만들기 화면을 닫는다', async () => {
  const { api, handlers } = setup({ forms: [], actions: ['form.create'] })
  api.on('POST', FORMS_PATH, () => json({ error: 'TOO_MANY_REQUESTS' }, 429))
  const { form } = await openCreate(api)
  fireEvent.click(submit(form))
  expect(await within(form).findByText(REGISTRATION_STAFF_ERRORS.TOO_MANY_REQUESTS!)).toBeTruthy()
  api.on('POST', FORMS_PATH, () => json({ error: 'FORBIDDEN' }, 403))
  fireEvent.click(submit(form))
  await waitFor(() => expect(screen.queryByRole('form', { name: '신청 양식 만들기' })).toBeNull())
  expect(handlers.onForbidden).toHaveBeenCalled()
  expect(await screen.findByText(PERMISSION_CHANGED)).toBeTruthy()
})

test('고치기는 양식 값으로 채운 화면을 열고, 404면 화면을 닫고 이유를 보인다', async () => {
  const { api } = setup()
  api.on('POST', FORM_PATH, () => json({ error: 'NOT_FOUND' }, 404))
  fireEvent.click(await screen.findByRole('button', { name: '고치기' }))
  const form = await screen.findByRole('form', { name: '신청 양식 고치기' })
  expect(within(form).getByLabelText('양식 이름')).toHaveProperty('value', '환영회 참가 신청')
  expect(within(form).getByLabelText('학생회비 납부자 별도 금액')).toHaveProperty('checked', true)
  fireEvent.click(within(form).getByRole('button', { name: '저장' }))
  await waitFor(() => expect(screen.queryByRole('form', { name: '신청 양식 고치기' })).toBeNull())
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

test('마감 지난 양식은 [멈추기]가 없다. 누르던 사이 마감되면 409 문구를 보이고 다시 읽어 버튼이 사라진다', async () => {
  const forms = [staffForm()]
  const { api } = setup({ forms })
  api.on('POST', `${FORM_PATH}/pause`, () => {
    forms[0] = staffForm({
      status: 'closed',
      actions: ['form.update', 'form.check_in', 'form.view_applicants'],
    })
    return json({ error: 'FORM_CLOSED' }, 409)
  })
  fireEvent.click(await screen.findByRole('button', { name: '멈추기' }))
  expect(await screen.findByText(REGISTRATION_STAFF_ERRORS.FORM_CLOSED!)).toBeTruthy()
  await waitFor(() => expect(screen.queryByRole('button', { name: '멈추기' })).toBeNull())
  expect(screen.queryByRole('button', { name: '다시 받기' })).toBeNull()
  expect(screen.getByText(REGISTRATION_STAFF_ERRORS.FORM_CLOSED!)).toBeTruthy()
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
    json({
      registrationId: 'x',
      applicant: applicantChange(),
      name: '김새내',
      studentId: '20260001',
      already: false,
    }),
  )
  await within(row).findByRole('button', { name: '출석 취소' })
  expect(within(row).getByText('출석')).toBeTruthy()
  // 출석한 신청에는 [신청 취소]가 없다(N10).
  expect(within(row).queryByRole('button', { name: '신청 취소' })).toBeNull()
  api.on('POST', `${base}/attendance/cancel`, () =>
    json({
      cancelled: true,
      applicant: applicantChange({
        attended: false,
        actions: ['registration.check_in', 'registration.cancel', 'deposit.confirm'],
      }),
    }),
  )
  fireEvent.click(within(row).getByRole('button', { name: '출석 취소' }))
  await within(row).findByRole('button', { name: '출석' })
  expect(within(row).getByRole('button', { name: '신청 취소' })).toBeTruthy()
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
  api.on('POST', `${base}/cancel`, () =>
    json({
      cancelled: true,
      applicant: applicantChange({ attended: false, cancelled: true, actions: [] }),
    }),
  )
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

test('완료한 행사처럼 줄의 actions가 비면 명단은 보이고 버튼은 없다', async () => {
  await openApplicants([applicant({ actions: [] })])
  const row = screen.getByText('김새내').closest('li') as HTMLElement
  expect(within(row).getByText('입금 안 함')).toBeTruthy()
  expect(within(row).queryAllByRole('button')).toHaveLength(0)
})

test('신청 취소 확인 창이 열린 동안 다시 읽은 줄에서 그 동작이 사라지면 닫고 이유를 보인다', async () => {
  const { api } = await openApplicants()
  const row = screen.getByText('김새내').closest('li') as HTMLElement
  fireEvent.click(within(row).getByRole('button', { name: '신청 취소' }))
  await screen.findByRole('dialog')
  api.on('GET', APPLICANTS_PATH, () =>
    json({
      applicants: [applicant({ attended: true, actions: ['registration.cancel_check_in'] })],
      truncated: false,
    }),
  )
  fireEvent.click(screen.getByRole('button', { name: '새로 읽기', hidden: true }))
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  expect(screen.getByText(REGISTRATION_ACTION_GONE)).toBeTruthy()
  expect(within(row).queryByRole('button', { name: '신청 취소' })).toBeNull()
})

test('입금 확인 창이 열린 동안 다시 읽은 줄에서 그 동작이 사라지면 닫고 이유를 보인다', async () => {
  const { api } = await openApplicants()
  const row = screen.getByText('김새내').closest('li') as HTMLElement
  fireEvent.click(within(row).getByRole('button', { name: '입금 확인' }))
  await screen.findByRole('dialog')
  api.on('GET', APPLICANTS_PATH, () =>
    json({ applicants: [applicant({ actions: [] })], truncated: false }),
  )
  fireEvent.click(screen.getByRole('button', { name: '새로 읽기', hidden: true }))
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  expect(screen.getByText(REGISTRATION_ACTION_GONE)).toBeTruthy()
})
