// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { councilView } from '@/test-support/council-fixtures'
import { ApplicantListHarness } from '@/test-support/ApplicantListHarness'
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
import {
  REGISTRATION_FEE_MAX,
  type AccountItem,
  type EventDetail,
  type FormListAction,
} from '@vada/contracts'
import { hasUnsavedInput } from '@/lib/leave-guard'
import { eventDetail } from '@/test-support/event-fixtures'
import { RegistrationTab } from './RegistrationTab'
import { pickDateTime } from '@/test-support/date-field'

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
  // 학생회 계좌. 기본은 대표·사업·닫은 통장 셋이다.
  accounts?: AccountItem[]
}

function setup(options: Options = {}) {
  const api = mockApi()
  api.on('GET', `/api/organizations/c1/events/${STAFF_EVENT_ID}/applicants`, () =>
    json({
      applicants: [],
      counts: { applicants: 3, attended: 1 },
      truncated: false,
      canView: false,
      canManage: false,
      showAffiliation: false,
      showForm: false,
    }),
  )
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
      accounts: options.accounts ?? [
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

const draftForm = (extra: Parameters<typeof staffForm>[0] = {}) =>
  staffForm({
    paused: true,
    status: 'paused',
    applicantCount: 0,
    attendedCount: 0,
    actions: ['form.update', 'form.activate'],
    ...extra,
  })

const card = (name = '환영회 참가 신청') => screen.getByRole('article', { name })

// 카드 머리 오른쪽 ••• 메뉴를 연다(멈추기).
async function openMore() {
  fireEvent.keyDown(await screen.findByRole('button', { name: '양식 더보기' }), { key: 'Enter' })
  return screen.findByRole('menu')
}

test('초안 카드는 링크 없이 링크 열기까지 N개와 빠진 조건의 [채우기]를 보이고, 행사 일시 [채우기]는 행사 고치기를 연다', async () => {
  const { onEditEvent } = setup({
    forms: [draftForm({ missingConditions: ['event_starts_at'] })],
    event: eventDetail({ startsAt: null }, ['event.update']),
  })
  expect(await screen.findByText('초안')).toBeTruthy()
  expect(card().textContent).toContain('링크 열기까지 1개')
  expect(screen.queryByRole('button', { name: '링크 복사' })).toBeNull()
  expect(screen.queryByRole('img', { name: /신청 링크 QR/ })).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: '행사 시작 일시 채우기' }))
  expect(onEditEvent).toHaveBeenCalledWith('startsAt')
})

test('빠진 조건이 있는 초안의 [신청 양식 활성화]는 보내지 않고 빠진 조건을 알리며 첫 [채우기]로 옮긴다', async () => {
  const { api } = setup({
    forms: [draftForm({ missingConditions: ['closes_at', 'fee_account'] })],
  })
  fireEvent.click(await screen.findByRole('button', { name: '신청 양식 활성화' }))
  const alert = screen.getByRole('alert')
  expect(alert.textContent).toContain('신청 마감 비어 있음')
  expect(alert.textContent).toContain('참가비 받을 계좌 비어 있음')
  expect(document.activeElement).toBe(screen.getByRole('button', { name: '신청 마감 채우기' }))
  expect(posts(api)).toHaveLength(0)
})

test('조건이 다 찬 초안은 링크 열 준비 완료이고, 활성화는 서버 응답 뒤 링크와 포스터용 QR을 보인다', async () => {
  const forms = [draftForm()]
  const { api } = setup({ forms })
  api.on('POST', `${FORM_PATH}/activate`, () => {
    forms[0] = staffForm({ applicantCount: 0 })
    return json({ form: forms[0] })
  })
  const activate = await screen.findByRole('button', { name: '신청 양식 활성화' })
  expect(card().textContent).toContain('링크 열 준비 완료')
  fireEvent.click(activate)
  expect(await screen.findByRole('button', { name: '링크 복사' })).toBeTruthy()
  expect(screen.getByRole('img', { name: /신청 링크 QR/ })).toBeTruthy()
  expect(posts(api).map(call => call.path)).toEqual([`${FORM_PATH}/activate`])
})

test.each([eventDetail({ startsAt: null }), null])(
  '웹의 행사·계좌 값과 관계없이 서버 조건이 차 있으면 활성화를 요청한다: %s',
  async event => {
    const { api } = setup({
      event,
      forms: [draftForm({ feeAccount: null, missingConditions: [] })],
    })
    api.on('POST', `${FORM_PATH}/activate`, () => json({ form: staffForm() }))
    fireEvent.click(await screen.findByRole('button', { name: '신청 양식 활성화' }))
    await waitFor(() =>
      expect(posts(api).map(call => call.path)).toEqual([`${FORM_PATH}/activate`]),
    )
  },
)

test('웹의 값이 차 있어도 서버가 준 부족 조건을 보이고 활성화 요청을 멈춘다', async () => {
  const { api } = setup({ forms: [draftForm({ missingConditions: ['fee_account'] })] })
  expect(await screen.findByRole('button', { name: '참가비 받을 계좌 채우기' })).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: '신청 양식 활성화' }))
  expect(posts(api)).toHaveLength(0)
})

test.each([
  {
    formActions: ['form.update'] as const,
    eventActions: [] as const,
    eventMove: false,
    formMove: true,
  },
  {
    formActions: [] as const,
    eventActions: ['event.update'] as const,
    eventMove: true,
    formMove: false,
  },
])('[채우기]는 그 기록의 수정 동작만 따른다: %s', async options => {
  setup({
    forms: [
      draftForm({
        actions: [...options.formActions],
        missingConditions: ['event_starts_at', 'fee_account'],
      }),
    ],
    event: eventDetail({ startsAt: null }, [...options.eventActions]),
  })
  await screen.findByRole('heading', { name: '환영회 참가 신청' })
  expect(!!screen.queryByRole('button', { name: '행사 시작 일시 채우기' })).toBe(options.eventMove)
  expect(!!screen.queryByRole('button', { name: '참가비 받을 계좌 채우기' })).toBe(options.formMove)
  expect(card().textContent).toContain('비어 있음')
})

test('받는 중 카드는 상태와 큰 신청 수 옆에 링크·QR을 두고, 받는 항목은 한 줄 요약으로 접혀 있다', async () => {
  const questions = [
    {
      id: '00000000-0000-4000-8000-000000000802',
      kind: 'multiple_choice' as const,
      title: '참가 종목',
      required: false,
      choices: [{ id: '00000000-0000-4000-8000-000000000803', label: '축구' }],
    },
  ]
  setup({ forms: [staffForm({ questions, collectsPhone: true })] })
  await screen.findByRole('heading', { name: '환영회 참가 신청' })
  expect(card().textContent).toContain('활성')
  expect(card().textContent).toContain('신청 3 / 50명')
  expect(screen.getByRole('button', { name: '링크 복사' })).toBeTruthy()
  expect(screen.getByRole('button', { name: 'QR 저장' })).toBeTruthy()
  expect(screen.getByRole('button', { name: /QR 크게 보기/ })).toBeTruthy()
  const items = screen.getByRole('button', { name: '이름 · 학번 · 휴대폰 · 질문 1개' })
  expect(items.getAttribute('aria-expanded')).toBe('false')
  expect(screen.queryByText('참가 종목')).toBeNull()
  expect(card().textContent).toContain('신청 있어 질문 잠김')
  expect(screen.queryByRole('button', { name: '신청 양식 활성화' })).toBeNull()
})

test('수정·명단 열람 동작이 없어도 양식별 신청·출석 수와 안내는 읽을 수 있다', async () => {
  setup({
    forms: [
      staffForm({ actions: [], applicantCount: 7, attendedCount: 2, notice: '회비 납부자 우선' }),
    ],
    actions: [],
    event: null,
  })
  await screen.findByRole('heading', { name: '환영회 참가 신청' })
  expect(within(card()).getByText('회비 납부자 우선')).toBeTruthy()
  expect(card().textContent).toContain('신청 7 / 50명')
  expect(card().textContent).toContain('출석 2명')
  expect(screen.queryByRole('button', { name: '신청 양식 활성화' })).toBeNull()
  expect(screen.queryByRole('button', { name: '고치기' })).toBeNull()
})

test('여러 양식은 양식마다 카드를 보이고 미리보기에서 신청하지 않는다', async () => {
  const { api } = setup({ forms: [staffForm(), staffForm({ id: 'f2', name: '둘째 양식' })] })
  await screen.findByRole('heading', { name: '환영회 참가 신청' })
  expect(screen.getByRole('heading', { name: '둘째 양식' })).toBeTruthy()
  fireEvent.click(within(card('둘째 양식')).getByRole('button', { name: '미리보기' }))
  const dialog = screen.getByRole('dialog', { name: '학생 화면 미리보기' })
  expect(dialog.querySelector('[inert]')).toBeTruthy()
  expect(posts(api)).toHaveLength(0)
})

test('서버가 계좌 부족으로 거절하면 그 조건의 [채우기]를 보이고 계좌 칸으로 옮긴다', async () => {
  const { api } = setup({ forms: [draftForm()] })
  api.on('POST', `${FORM_PATH}/activate`, () =>
    json({ error: 'FORM_NOT_READY', missingConditions: ['fee_account'] }, 409),
  )
  fireEvent.click(await screen.findByRole('button', { name: '신청 양식 활성화' }))
  fireEvent.click(await screen.findByRole('button', { name: '참가비 받을 계좌 채우기' }))
  const select = await screen.findByRole('combobox', { name: '참가비 받을 계좌' })
  await waitFor(() => expect(document.activeElement).toBe(select))
})

test('카드에 이름(긴 글은 줄바꿈), 기간, 정원, 상태가 보인다', async () => {
  setup({ forms: [staffForm({ name: '가'.repeat(60) })] })
  const heading = await screen.findByRole('heading', { name: '가'.repeat(60) })
  expect(heading.className).toContain('wrap-anywhere')
  const sheet = card('가'.repeat(60))
  expect(sheet.textContent).toContain('신청 마감10월 23일 (금) 18:00')
  expect(sheet.textContent).not.toContain('18:00까지')
  expect(sheet.textContent).toContain('50명')
  expect(sheet.textContent).toContain('활성')
})

// 라벨과 값이 같은 것을 말한다: 시작이 있으면 '신청 기간'에 기간, 없으면 '신청 마감'에 마감만.
test('신청 시작이 있는 카드는 신청 기간 줄에 시작 ~ 마감을 보인다', async () => {
  setup({ forms: [staffForm({ opensAt: '2026-10-20T09:00' })] })
  await screen.findByRole('heading', { name: '환영회 참가 신청' })
  expect(card().textContent).toContain('신청 기간10월 20일 (화) 09:00 ~ 10월 23일 (금) 18:00')
  expect(card().textContent).not.toContain('신청 마감')
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
  expect(screen.queryByRole('button', { name: '신청 양식 활성화' })).toBeNull()
  expect(screen.queryByRole('button', { name: '양식 더보기' })).toBeNull()
})

test('[다시 받기]는 다시 받기를 보낸다', async () => {
  const forms = [staffForm({ paused: true, status: 'paused' })]
  const { api } = setup({ forms })
  api.on('POST', `${FORM_PATH}/resume`, () => {
    forms[0] = staffForm()
    return json({ form: forms[0] })
  })
  fireEvent.click(await screen.findByRole('button', { name: '다시 받기' }))
  await waitFor(() => expect(posts(api).map(call => call.path)).toEqual([`${FORM_PATH}/resume`]))
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

async function openCreate(api: ReturnType<typeof mockApi>, { closes = true } = {}) {
  fireEvent.click(await screen.findByRole('button', { name: '신청 양식 만들기' }))
  const form = await screen.findByRole('form', { name: '신청 양식 만들기' })
  fireEvent.change(within(form).getByLabelText('양식 이름'), { target: { value: '환영회 신청' } })
  if (closes) await pickDateTime(within(form).getByLabelText('신청 마감'), '2026-10-23T18:00')
  return { api, form }
}
const submit = () => screen.getByRole('button', { name: '만들기' })
const save = () => screen.getByRole('button', { name: '저장' })

test('만들기는 목록 대신 탭 안 화면으로 열리고, 양식 이름은 참가 신청, 마감은 행사 시작, 참가비는 없음, 학번은 받는 것으로 시작하며 [신청 양식 목록]으로 돌아간다', async () => {
  setup({ forms: [], actions: ['form.create'] })
  fireEvent.click(await screen.findByRole('button', { name: '신청 양식 만들기' }))
  const form = await screen.findByRole('form', { name: '신청 양식 만들기' })
  expect(screen.queryByRole('dialog')).toBeNull()
  expect(screen.queryByText('신청 양식 없음')).toBeNull()
  expect(within(form).getByLabelText('양식 이름')).toHaveProperty('value', '참가 신청')
  const closes = within(form).getByLabelText('신청 마감')
  expect(closes).toHaveProperty('value', '2026-10-24')
  expect(within(form).getByRole('combobox', { name: '마감 시각' })).toHaveProperty('value', '14:00')
  // 새 양식은 초안이라 마감 없이도 저장된다(활성화가 마감을 묻는다, DEC-93).
  expect(closes.getAttribute('aria-required')).toBeNull()
  expect(within(form).getByLabelText('없음')).toHaveProperty('checked', true)
  expect(within(form).queryByLabelText('학생회비 납부자 금액 다름')).toBeNull()
  expect(within(form).queryByRole('switch', { name: '이름 받기' })).toBeNull()
  expect(within(form).getByText('늘 받음')).toBeTruthy()
  expect(within(form).getByRole('switch', { name: '학번 받기' }).getAttribute('aria-checked')).toBe(
    'true',
  )
  expect(
    within(form).getByRole('switch', { name: '휴대폰 번호 받기' }).getAttribute('aria-checked'),
  ).toBe('false')
  // 기본값으로 필수 칸이 다 찼다.
  expect(screen.queryByRole('button', { name: /칸 남음/ })).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: '신청 양식 목록' }))
  expect(screen.queryByRole('form', { name: '신청 양식 만들기' })).toBeNull()
  expect(screen.getByText('신청 양식 없음')).toBeTruthy()
})

test('행사 시작이 없으면 마감은 비어 있고 초안이라 남은 필수 칸이 아니다. 필수 N칸 남음을 누르면 첫 빈 필수 칸으로 옮긴다', async () => {
  setup({ forms: [], actions: ['form.create'], event: eventDetail({ startsAt: null }) })
  fireEvent.click(await screen.findByRole('button', { name: '신청 양식 만들기' }))
  const form = await screen.findByRole('form', { name: '신청 양식 만들기' })
  const closes = within(form).getByLabelText('신청 마감')
  expect(closes).toHaveProperty('value', '')
  expect(screen.queryByRole('button', { name: /칸 남음/ })).toBeNull()
  fireEvent.click(within(form).getByLabelText('있음'))
  fireEvent.click(screen.getByRole('button', { name: '필수 1칸 남음' }))
  const fee = within(form).getByLabelText('참가비')
  expect(document.activeElement).toBe(fee)
  fireEvent.change(fee, { target: { value: '5000' } })
  await waitFor(() => expect(screen.queryByRole('button', { name: /칸 남음/ })).toBeNull())
})

test('계좌가 하나뿐이면 대표 계좌가 아니어도 미리 골라 둔다', async () => {
  const { api } = setup({
    forms: [],
    actions: ['form.create'],
    accounts: [accountItem({ type: 'business', name: '행사 통장' })],
  })
  const { form } = await openCreate(api)
  fireEvent.click(within(form).getByLabelText('있음'))
  const select = await within(form).findByRole('combobox', { name: '참가비 받을 계좌' })
  await waitFor(() => expect(select).toHaveProperty('value', ACCOUNT_ID))
})

test('만들기 화면 맨 위 행사 줄은 일시·장소를 보이고, 빈 장소면 행사 고치기를 장소 칸으로 연다', async () => {
  const { onEditEvent } = setup({
    forms: [],
    actions: ['form.create'],
    event: eventDetail({ place: null }, ['event.update']),
  })
  fireEvent.click(await screen.findByRole('button', { name: '신청 양식 만들기' }))
  const form = await screen.findByRole('form', { name: '신청 양식 만들기' })
  const row = within(form).getByRole('button', { name: /장소 미정/ })
  expect(row.textContent).toContain('10월 24일 (토) 14:00')
  fireEvent.click(row)
  expect(onEditEvent).toHaveBeenCalledWith('place')
  const preview = screen.getByRole('region', { name: '미리보기' })
  expect(preview.textContent).toContain('신입생 환영회')
})

test('행사를 읽기 전이면 만들기 화면에 행사 줄과 미리보기가 없다', async () => {
  setup({ forms: [], actions: ['form.create'], event: null })
  fireEvent.click(await screen.findByRole('button', { name: '신청 양식 만들기' }))
  const form = await screen.findByRole('form', { name: '신청 양식 만들기' })
  expect(within(form).queryByText('행사')).toBeNull()
  expect(screen.queryByRole('region', { name: '미리보기' })).toBeNull()
  expect(screen.queryByRole('button', { name: '미리보기' })).toBeNull()
})

test('행사를 읽기 전에 만들어도 이 행사의 양식으로 보낸다', async () => {
  const { api } = setup({ forms: [], actions: ['form.create'], event: null })
  api.on('POST', FORMS_PATH, () => json({ form: staffForm() }, 201))
  await openCreate(api)
  fireEvent.click(submit())
  await waitFor(() => expect(api.calls.some(call => call.method === 'POST')).toBe(true))
  expect(posts(api).map(call => call.path)).toEqual([FORMS_PATH])
})

test('만들기: 납부자 금액이 다르면 두 참가비를 받고 학번은 잠겨 받으며, 대표 계좌가 채워지고, 보내는 동안 다시 보내지 않으며, 만든 뒤 생성 완료 화면 없이 카드로 돌아가 초안을 보인다', async () => {
  const forms: ReturnType<typeof staffForm>[] = []
  const { api } = setup({ forms, actions: ['form.create'] })
  const pending = deferredResponse()
  api.on('POST', FORMS_PATH, () => pending.promise)
  const { form } = await openCreate(api)
  // 참가비를 고르기 전에는 계좌 칸이 없다
  expect(within(form).queryByRole('combobox', { name: '참가비 받을 계좌' })).toBeNull()
  fireEvent.click(within(form).getByLabelText('있음'))
  fireEvent.click(within(form).getByLabelText('학생회비 납부자 금액 다름'))
  expect(within(form).queryByRole('switch', { name: '학번 받기' })).toBeNull()
  expect(within(form).getByText('학생회비 납부 확인에 필요')).toBeTruthy()
  fireEvent.change(within(form).getByLabelText('납부자'), { target: { value: '5000' } })
  // 미납자 참가비가 비면 보내지 않고 그 칸 아래에 알린다.
  fireEvent.click(submit())
  const nonPayer = within(form).getByLabelText('미납자')
  expect(within(form).getByText('미납자 참가비를 입력해 주세요')).toBeTruthy()
  expect(nonPayer.getAttribute('aria-invalid')).toBe('true')
  await waitFor(() => expect(document.activeElement).toBe(nonPayer))
  expect(posts(api)).toHaveLength(0)
  fireEvent.change(nonPayer, { target: { value: '10000' } })
  const select = await within(form).findByRole('combobox', { name: '참가비 받을 계좌' })
  await waitFor(() => expect(select).toHaveProperty('value', ACCOUNT_ID))
  expect(within(select).getByText('비어 있음')).toBeTruthy()
  expect(within(select).queryByText(/닫은 통장/)).toBeNull()
  fireEvent.click(submit())
  fireEvent.click(submit())
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
    questions: [],
  })
  expect(submit()).toHaveProperty('disabled', true)
  // 보내는 동안 칸을 고치면 보낸 값과 달라지므로 잠근다.
  expect(within(form).getByLabelText('납부자').matches(':disabled')).toBe(true)
  expect(within(form).getByLabelText('양식 이름').matches(':disabled')).toBe(true)
  forms.push(draftForm({ name: '환영회 신청' }))
  pending.resolve(json({ form: forms[0] }, 201))
  expect(await screen.findByRole('heading', { name: '환영회 신청' })).toBeTruthy()
  expect(screen.queryByRole('form', { name: '신청 양식 만들기' })).toBeNull()
  expect(screen.queryByText('신청 양식 생성 완료')).toBeNull()
  expect(card('환영회 신청').textContent).toContain('초안')
  expect(screen.getByRole('button', { name: '신청 양식 활성화' })).toBeTruthy()
  await waitFor(() =>
    expect(
      api.calls.filter(call => call.path === FORMS_PATH && call.method === 'GET').length,
    ).toBeGreaterThan(1),
  )
})

test('만든 양식은 목록을 다시 읽기 전에도 카드로 보인다', async () => {
  const { api } = setup({ forms: [], actions: ['form.create'] })
  api.on('POST', FORMS_PATH, () => json({ form: draftForm({ name: '환영회 신청' }) }, 201))
  await openCreate(api)
  fireEvent.click(submit())
  expect(await screen.findByRole('heading', { name: '환영회 신청' })).toBeTruthy()
  expect(screen.queryByText('신청 양식 없음')).toBeNull()
})

test('초안은 계좌 없이 참가비를 저장하고 링크는 공개하지 않는다', async () => {
  const { api } = setup({ forms: [], actions: ['form.create'] })
  api.on('POST', FORMS_PATH, () => json({ form: draftForm({ feeAccount: null }) }, 201))
  const { form } = await openCreate(api)
  fireEvent.click(within(form).getByLabelText('있음'))
  fireEvent.change(within(form).getByLabelText('참가비'), { target: { value: '5000' } })
  const select = await within(form).findByRole<HTMLSelectElement>('combobox', {
    name: '참가비 받을 계좌',
  })
  await waitFor(() => expect(select).toHaveProperty('value', ACCOUNT_ID))
  fireEvent.change(select, { target: { value: select.options[0]?.value } })
  fireEvent.click(submit())
  expect(await screen.findByText('초안')).toBeTruthy()
  expect(posts(api)[0]?.body).toMatchObject({
    payerFee: 5000,
    nonPayerFee: 5000,
    feeAccountId: null,
  })
  expect(screen.queryByRole('button', { name: '링크 복사' })).toBeNull()
})

test('만들기: 참가비가 없으면 계좌를 보내지 않는다. 행사 시작이 없어 마감이 비면 마감 없이 초안을 만든다', async () => {
  // 행사 시작이 없으면 마감이 빈 채로 열린다. 초안은 마감 없이 저장되고 카드가 '신청 마감 · 채우기'를 보인다.
  const { api } = setup({
    forms: [],
    actions: ['form.create'],
    event: eventDetail({ startsAt: null }),
  })
  api.on('POST', FORMS_PATH, () => json({ form: staffForm() }, 201))
  const { form } = await openCreate(api, { closes: false })
  expect(within(form).getByLabelText('신청 마감')).toHaveProperty('value', '')
  fireEvent.click(submit())
  expect(within(form).queryByText('신청 마감을 입력해 주세요')).toBeNull()
  await waitFor(() => expect(posts(api)).toHaveLength(1))
  expect(posts(api)[0]?.body).toMatchObject({
    closesAt: null,
    payerFee: null,
    nonPayerFee: null,
    feeAccountId: null,
  })
})

test('만들기: 정원이 1 이상의 숫자가 아니면 보내지 않고 정원 칸 아래에 알린다', async () => {
  const { api } = setup({ forms: [], actions: ['form.create'] })
  const { form } = await openCreate(api)
  fireEvent.change(within(form).getByLabelText('정원'), { target: { value: '0' } })
  fireEvent.click(submit())
  expect(within(form).getByText('1 이상의 숫자를 입력해 주세요')).toBeTruthy()
  expect(posts(api)).toHaveLength(0)
})

test('만들기 409는 문구를 보이고 열어 둔다', async () => {
  const { api } = setup({ forms: [], actions: ['form.create'] })
  api.on('POST', FORMS_PATH, () => json({ error: 'FEE_ACCOUNT_REQUIRED' }, 409))
  await openCreate(api)
  fireEvent.click(submit())
  expect(await screen.findByText(REGISTRATION_STAFF_ERRORS.FEE_ACCOUNT_REQUIRED!)).toBeTruthy()
  expect(submit()).toHaveProperty('disabled', false)
})

test('만들기 429는 문구를, 403은 학생회를 다시 읽게 하고 만들기 화면을 닫는다', async () => {
  const { api, handlers } = setup({ forms: [], actions: ['form.create'] })
  api.on('POST', FORMS_PATH, () => json({ error: 'TOO_MANY_REQUESTS' }, 429))
  await openCreate(api)
  fireEvent.click(submit())
  expect(await screen.findByText(REGISTRATION_STAFF_ERRORS.TOO_MANY_REQUESTS!)).toBeTruthy()
  api.on('POST', FORMS_PATH, () => json({ error: 'FORBIDDEN' }, 403))
  fireEvent.click(submit())
  await waitFor(() => expect(screen.queryByRole('form', { name: '신청 양식 만들기' })).toBeNull())
  expect(handlers.onForbidden).toHaveBeenCalled()
  expect(await screen.findByText(PERMISSION_CHANGED)).toBeTruthy()
})

test('고치기는 양식 값으로 채운 화면을 열고, 404면 화면을 닫고 이유를 보인다', async () => {
  const { api } = setup({ forms: [staffForm({ applicantCount: 0 })] })
  api.on('POST', FORM_PATH, () => json({ error: 'NOT_FOUND' }, 404))
  fireEvent.click(await screen.findByRole('button', { name: '고치기' }))
  const form = await screen.findByRole('form', { name: '신청 양식 고치기' })
  expect(within(form).getByLabelText('양식 이름')).toHaveProperty('value', '환영회 참가 신청')
  expect(within(form).getByLabelText('신청 마감')).toHaveProperty('value', '2026-10-23')
  expect(within(form).getByRole('combobox', { name: '마감 시각' })).toHaveProperty('value', '18:00')
  expect(within(form).getByLabelText('학생회비 납부자 금액 다름')).toHaveProperty('checked', true)
  fireEvent.click(save())
  await waitFor(() => expect(screen.queryByRole('form', { name: '신청 양식 고치기' })).toBeNull())
  expect(screen.getByText(REGISTRATION_STAFF_LOST)).toBeTruthy()
})

const noFeeForm = () =>
  staffForm({ payerFee: null, nonPayerFee: null, feeAccount: null, applicantCount: 0 })

async function openEditWithFee() {
  fireEvent.click(await screen.findByRole('button', { name: '고치기' }))
  const form = await screen.findByRole('form', { name: '신청 양식 고치기' })
  fireEvent.click(within(form).getByLabelText('있음'))
  fireEvent.change(within(form).getByLabelText('참가비'), { target: { value: '5000' } })
  const select = await within(form).findByRole<HTMLSelectElement>('combobox', {
    name: '참가비 받을 계좌',
  })
  return { form, select }
}

test('고치기: 참가비 없던 양식에 참가비를 넣으면 만들기처럼 하나뿐인 계좌가 골라져 저장된다', async () => {
  const { api } = setup({ forms: [noFeeForm()], accounts: [accountItem()] })
  api.on('POST', FORM_PATH, () => json({ form: staffForm() }))
  const { select } = await openEditWithFee()
  await waitFor(() => expect(select).toHaveProperty('value', ACCOUNT_ID))
  fireEvent.click(save())
  await waitFor(() => expect(posts(api)).toHaveLength(1))
  expect(posts(api)[0]?.body).toMatchObject({
    payerFee: 5000,
    nonPayerFee: 5000,
    feeAccountId: ACCOUNT_ID,
  })
})

test('고치기: 대표 계좌 없이 계좌가 둘이면 고르기 전에는 저장하지 않는다', async () => {
  const { api } = setup({
    forms: [noFeeForm()],
    accounts: [
      accountItem({ type: 'business' }),
      accountItem({ id: '00000000-0000-4000-8000-0000000000a2', type: 'business' }),
    ],
  })
  const { form, select } = await openEditWithFee()
  await within(select).findAllByRole('option', { name: /학생회 통장/ })
  expect(select.value).toBe(select.options[0]?.value)
  fireEvent.click(save())
  expect(within(form).getByText('참가비 받을 계좌를 골라 주세요')).toBeTruthy()
  expect(posts(api)).toHaveLength(0)
})

test('만들기·고치기 화면은 열기만 하면 떠날 때 묻지 않는다', async () => {
  setup({ forms: [noFeeForm()], actions: ['form.create'] })
  fireEvent.click(await screen.findByRole('button', { name: '신청 양식 만들기' }))
  await screen.findByRole('form', { name: '신청 양식 만들기' })
  await settle()
  expect(hasUnsavedInput()).toBe(false)
  fireEvent.click(screen.getByRole('button', { name: '신청 양식 목록' }))
  fireEvent.click(await screen.findByRole('button', { name: '고치기' }))
  await screen.findByRole('form', { name: '신청 양식 고치기' })
  await settle()
  expect(hasUnsavedInput()).toBe(false)
})

test('[멈추기]는 ••• 안에 있고 보내는 동안 다시 보내지 않으며, 409·429는 카드 안에 문구를 보인다', async () => {
  const { api } = setup()
  const pending = deferredResponse()
  api.on('POST', `${FORM_PATH}/pause`, () => pending.promise)
  fireEvent.click(within(await openMore()).getByRole('menuitem', { name: '멈추기' }))
  fireEvent.click(within(await openMore()).getByRole('menuitem', { name: '멈추기' }))
  expect(posts(api)).toHaveLength(1)
  pending.resolve(json({ error: 'TOO_MANY_REQUESTS' }, 429))
  expect(await within(card()).findByText(REGISTRATION_STAFF_ERRORS.TOO_MANY_REQUESTS!)).toBeTruthy()
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
  fireEvent.click(within(await openMore()).getByRole('menuitem', { name: '멈추기' }))
  expect(await screen.findByText(REGISTRATION_STAFF_ERRORS.FORM_CLOSED!)).toBeTruthy()
  await waitFor(() => expect(screen.queryByRole('button', { name: '양식 더보기' })).toBeNull())
  expect(screen.queryByRole('button', { name: '신청 양식 활성화' })).toBeNull()
  expect(screen.getByText(REGISTRATION_STAFF_ERRORS.FORM_CLOSED!)).toBeTruthy()
})

test('받는 중 카드는 공개 링크 복사와 QR을 보이고 지우는 날은 싣지 않는다', async () => {
  setup({ forms: [staffForm({ actions: [] })] })
  await screen.findByRole('button', { name: '링크 복사' })
  expect(screen.getByText(`${window.location.host}/apply/ABCD2345`)).toBeTruthy()
  expect(screen.getByRole('img', { name: /신청 링크 QR/ })).toBeTruthy()
  expect(screen.queryByText('2027년 10월 24일')).toBeNull()
})

test('열람 권한이 없으면 신청 수만 보이고 신청자 목록을 읽지 않는다', async () => {
  const { api } = setup({ forms: [staffForm({ actions: [] })] })
  await screen.findByRole('button', { name: '링크 복사' })
  expect(screen.queryByText(/신청은 3명이에요/)).toBeNull()
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
  const api = mockApi()
  api.on('GET', APPLICANTS_PATH, () => json({ applicants: list, truncated: false }))
  const handlers = { onForbidden: vi.fn(), onLost: vi.fn() }
  render(<ApplicantListHarness {...handlers} />)
  await screen.findByText('김새내')
  return { api, handlers }
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
  expect(screen.getByText('신청자 없음')).toBeTruthy()
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
      applicant: applicantChange({ attended: false, cancelled: true, listed: false, actions: [] }),
    }),
  )
  fireEvent.click(within(dialog).getByRole('button', { name: '신청 취소' }))
  await waitFor(() => expect(screen.queryByText('김새내')).toBeNull())
  expect(screen.getByText('이미납')).toBeTruthy()
})

test('신청자 목록을 읽다 403이면 학생회를 다시 읽게 하고 이유를 보인다', async () => {
  const api = mockApi()
  api.on('GET', APPLICANTS_PATH, () => json({ error: 'FORBIDDEN' }, 403))
  const handlers = { onForbidden: vi.fn(), onLost: vi.fn() }
  render(<ApplicantListHarness {...handlers} />)
  await waitFor(() => expect(handlers.onForbidden).toHaveBeenCalled())
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

test('양식의 거절 문구는 다시 읽은 양식이 그 버튼을 되살리면 지운다', async () => {
  const forms = [staffForm()]
  const { api } = setup({ forms })
  api.on('POST', `${FORM_PATH}/pause`, () => {
    forms[0] = staffForm({
      status: 'closed',
      actions: ['form.update', 'form.check_in', 'form.view_applicants'],
    })
    return json({ error: 'FORM_CLOSED' }, 409)
  })
  fireEvent.click(within(await openMore()).getByRole('menuitem', { name: '멈추기' }))
  expect(await screen.findByText(REGISTRATION_STAFF_ERRORS.FORM_CLOSED!)).toBeTruthy()
  await waitFor(() => expect(screen.queryByRole('button', { name: '양식 더보기' })).toBeNull())
  // 마감 시각을 고쳐서 [멈추기]가 되살아난 양식을 15초 읽기가 가져온다.
  forms[0] = staffForm()
  document.dispatchEvent(new Event('visibilitychange'))
  expect(await screen.findByRole('button', { name: '양식 더보기' })).toBeTruthy()
  expect(screen.queryByText(REGISTRATION_STAFF_ERRORS.FORM_CLOSED!)).toBeNull()
})

test('신청자 줄의 거절 문구는 다시 읽은 줄에 새 동작이 나타나면 지운다', async () => {
  const { api } = await openApplicants()
  const base = '/api/organizations/c1/registrations/00000000-0000-4000-8000-0000000000a1'
  api.on('POST', `${base}/attendance`, () => json({ error: 'EVENT_COMPLETED' }, 409))
  const row = screen.getByText('김새내').closest('li') as HTMLElement
  fireEvent.click(within(row).getByRole('button', { name: '출석' }))
  expect(await screen.findByText(REGISTRATION_STAFF_ERRORS.EVENT_COMPLETED!)).toBeTruthy()
  api.on('GET', APPLICANTS_PATH, () =>
    json({
      applicants: [applicant({ attended: true, actions: ['registration.cancel_check_in'] })],
      truncated: false,
    }),
  )
  fireEvent.click(screen.getByRole('button', { name: '새로 읽기', hidden: true }))
  await waitFor(() =>
    expect(screen.queryByText(REGISTRATION_STAFF_ERRORS.EVENT_COMPLETED!)).toBeNull(),
  )
})

test('입금 줄의 거절 문구도 다시 읽은 줄에 새 동작이 나타나면 지운다', async () => {
  const { api } = await openApplicants()
  const base = '/api/organizations/c1/registrations/00000000-0000-4000-8000-0000000000a1'
  api.on('POST', `${base}/deposit`, () => json({ error: 'DEPOSIT_EXISTS' }, 409))
  const row = screen.getByText('김새내').closest('li') as HTMLElement
  fireEvent.click(within(row).getByRole('button', { name: '입금 확인' }))
  const dialog = await screen.findByRole('dialog')
  fireEvent.click(within(dialog).getByRole('button', { name: '입금 확인' }))
  expect(await within(dialog).findByText(REGISTRATION_STAFF_ERRORS.DEPOSIT_EXISTS!)).toBeTruthy()
  api.on('GET', APPLICANTS_PATH, () =>
    json({
      applicants: [
        applicant({ deposit: { status: 'confirmed', amount: 5000 }, actions: ['deposit.cancel'] }),
      ],
      truncated: false,
    }),
  )
  fireEvent.click(screen.getByRole('button', { name: '새로 읽기', hidden: true }))
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  expect(screen.queryByText(REGISTRATION_STAFF_ERRORS.DEPOSIT_EXISTS!)).toBeNull()
})

// 질문(기능 025 조각 21): 받는 항목 아래에 질문을 더하고 저장할 때 목록 전체를 보낸다.
test('[질문 추가]로 종류를 골라 더하고, 비운 질문은 칸 아래 오류이며, ••• 안 필수를 켜고 저장하면 질문 목록을 보낸다', async () => {
  const { api } = setup({ forms: [], actions: ['form.create'] })
  api.on('POST', FORMS_PATH, () => json({ form: staffForm() }, 201))
  const { form } = await openCreate(api)
  fireEvent.click(within(form).getByRole('button', { name: '질문 추가' }))
  fireEvent.click(within(form).getByRole('button', { name: '하나 고르기' }))
  fireEvent.click(submit())
  expect(await within(form).findByText('질문을 입력해 주세요')).toBeTruthy()
  expect(api.calls.filter(call => call.method === 'POST')).toHaveLength(0)
  fireEvent.change(within(form).getByLabelText('1번 질문'), { target: { value: '사이즈' } })
  fireEvent.keyDown(within(form).getByRole('button', { name: '1번 질문 설정' }), { key: 'Enter' })
  fireEvent.click(await screen.findByRole('menuitem', { name: '필수 켜기' }))
  fireEvent.click(submit())
  await waitFor(() => expect(api.calls.filter(call => call.method === 'POST')).toHaveLength(1))
  const body = api.calls.find(call => call.method === 'POST')!.body as { questions: unknown }
  expect(body.questions).toEqual([
    {
      kind: 'single_choice',
      title: '사이즈',
      required: true,
      choices: [{ label: '선택 1' }, { label: '선택 2' }],
    },
  ])
})

test('신청이 있는 양식은 질문이 잠겨 고칠 수 없고 더하기·설정이 없다', async () => {
  const questions = [
    {
      id: '00000000-0000-4000-8000-000000000801',
      kind: 'short_text' as const,
      title: '이니셜',
      required: true,
      choices: [],
    },
  ]
  setup({ forms: [staffForm({ applicantCount: 3, questions })] })
  fireEvent.click(await screen.findByRole('button', { name: '고치기' }))
  const form = await screen.findByRole('form', { name: '신청 양식 고치기' })
  expect(within(form).getByText('신청이 있어 질문을 바꾸거나 더할 수 없어요')).toBeTruthy()
  expect(within(form).getByLabelText('1번 질문')).toHaveProperty('readOnly', true)
  expect(within(form).queryByRole('button', { name: '질문 추가' })).toBeNull()
  expect(within(form).queryByRole('button', { name: '1번 질문 설정' })).toBeNull()
})

// 질문이 0개여도 [질문 추가]가 말없이 사라지지 않는다(대표 지적 10/30: 기능이 빠진 것으로 보임). 서버는 409로 막는다.
test('신청이 있는 양식은 질문이 없어도 [질문 추가] 자리에 잠긴 까닭이 보이고, 카드에도 잠김이 보인다', async () => {
  setup({ forms: [staffForm({ applicantCount: 1, questions: [] })] })
  await screen.findByRole('heading', { name: '환영회 참가 신청' })
  expect(card().textContent).toContain('신청 있어 질문 잠김')
  fireEvent.click(screen.getByRole('button', { name: '고치기' }))
  const form = await screen.findByRole('form', { name: '신청 양식 고치기' })
  expect(within(form).getByText('신청이 있어 질문을 더할 수 없어요')).toBeTruthy()
  expect(within(form).queryByRole('button', { name: '질문 추가' })).toBeNull()
})

test('카드의 받는 항목을 펼치면 질문이 종류·필수와 함께 차례대로 보인다(고치기 권한이 없어도)', async () => {
  const questions = [
    {
      id: '00000000-0000-4000-8000-000000000802',
      kind: 'multiple_choice' as const,
      title: '참가 종목',
      required: false,
      choices: [{ id: '00000000-0000-4000-8000-000000000803', label: '축구' }],
    },
  ]
  setup({ forms: [staffForm({ questions, actions: [] })], actions: [] })
  fireEvent.click(await screen.findByRole('button', { name: '이름 · 학번 · 질문 1개' }))
  expect(screen.getByText('참가 종목')).toBeTruthy()
  expect(screen.getByText('여럿 고르기 · 선택')).toBeTruthy()
})

test('한 칸 참가비가 계약 상한을 넘으면 보내지 않고 그 칸 아래에 알리며 그 칸으로 옮긴다', async () => {
  const { api } = setup({ forms: [], actions: ['form.create'] })
  const { form } = await openCreate(api)
  fireEvent.click(within(form).getByLabelText('있음'))
  const fee = within(form).getByLabelText('참가비')
  fireEvent.change(fee, { target: { value: String(REGISTRATION_FEE_MAX + 1) } })
  fireEvent.click(submit())
  expect(within(form).getByText('더 작은 값을 입력해 주세요')).toBeTruthy()
  expect(fee.getAttribute('aria-invalid')).toBe('true')
  await waitFor(() => expect(document.activeElement).toBe(fee))
  expect(api.calls.some(call => call.method === 'POST')).toBe(false)
})

test('다른 사람이 양식을 먼저 고치면 쓰던 입력을 남기고 안내와 새 값을 보이며, 다시 저장은 새 판으로 간다', async () => {
  const { api } = setup({ forms: [staffForm({ versionNo: 3, applicantCount: 0 })] })
  const fresh = staffForm({
    versionNo: 4,
    applicantCount: 0,
    capacity: 80,
    notice: '앞사람 안내',
  })
  api.on('POST', FORM_PATH, () => {
    api.on('GET', FORM_PATH, () => json({ form: fresh }))
    return json({ error: 'VERSION_CONFLICT' }, 409)
  })
  fireEvent.click(await screen.findByRole('button', { name: '고치기' }))
  const form = await screen.findByRole('form', { name: '신청 양식 고치기' })
  fireEvent.change(within(form).getByLabelText('양식 이름'), { target: { value: '내 이름' } })
  fireEvent.click(save())
  expect(await within(form).findByText(REGISTRATION_STAFF_ERRORS.VERSION_CONFLICT!)).toBeTruthy()
  expect(await within(form).findByText('새로 불러온 신청 양식')).toBeTruthy()
  expect(within(form).getByText('앞사람 안내')).toBeTruthy()
  expect(within(form).getByText('80명')).toBeTruthy()
  expect(within(form).getByLabelText('양식 이름')).toHaveProperty('value', '내 이름')
  api.on('POST', FORM_PATH, () => json({ form: fresh }))
  fireEvent.click(save())
  await waitFor(() => expect(screen.queryByRole('form', { name: '신청 양식 고치기' })).toBeNull())
  expect(posts(api)[0]?.body).toMatchObject({ name: '내 이름', baseVersionNo: 3 })
  expect(posts(api)[1]?.body).toMatchObject({ name: '내 이름', baseVersionNo: 4 })
})

test('새 값을 읽지 못해도 입력이 남고, 판이 그대로라 다시 저장하면 다시 막힌다', async () => {
  const { api } = setup({ forms: [staffForm({ versionNo: 3, applicantCount: 0 })] })
  api.on('POST', FORM_PATH, () => json({ error: 'VERSION_CONFLICT' }, 409))
  api.on('GET', FORM_PATH, () => json({ error: 'TOO_MANY_REQUESTS' }, 429))
  fireEvent.click(await screen.findByRole('button', { name: '고치기' }))
  const form = await screen.findByRole('form', { name: '신청 양식 고치기' })
  fireEvent.change(within(form).getByLabelText('양식 이름'), { target: { value: '내 이름' } })
  fireEvent.click(save())
  expect(await within(form).findByText(REGISTRATION_STAFF_ERRORS.VERSION_CONFLICT!)).toBeTruthy()
  expect(within(form).getByLabelText('양식 이름')).toHaveProperty('value', '내 이름')
  expect(within(form).queryByText('새로 불러온 신청 양식')).toBeNull()
  fireEvent.click(save())
  await waitFor(() => expect(posts(api)).toHaveLength(2))
  expect(posts(api)[1]?.body).toMatchObject({ baseVersionNo: 3 })
})

test('신청이 있으면 참가비 칸이 잠겨 까닭을 보이고 저장은 서버의 참가비를 그대로 보낸다', async () => {
  const { api } = setup({ forms: [staffForm({ payerFee: 5000, nonPayerFee: 10000 })] })
  api.on('POST', FORM_PATH, () => json({ form: staffForm() }))
  fireEvent.click(await screen.findByRole('button', { name: '고치기' }))
  const form = await screen.findByRole('form', { name: '신청 양식 고치기' })
  expect(within(form).getByText('신청이 있어 참가비를 바꿀 수 없어요')).toBeTruthy()
  expect(within(form).queryByLabelText('납부자')).toBeNull()
  expect(within(form).queryByLabelText('있음')).toBeNull()
  expect(within(form).queryByLabelText('학생회비 납부자 금액 다름')).toBeNull()
  fireEvent.click(save())
  await waitFor(() => expect(posts(api)).toHaveLength(1))
  expect(posts(api)[0]?.body).toMatchObject({ payerFee: 5000, nonPayerFee: 10000 })
})

test('취소한 신청만 남으면(신청 수 0) 참가비 칸이 잠기지 않는다', async () => {
  setup({ forms: [staffForm({ applicantCount: 0 })] })
  fireEvent.click(await screen.findByRole('button', { name: '고치기' }))
  const form = await screen.findByRole('form', { name: '신청 양식 고치기' })
  expect(within(form).queryByText('신청이 있어 참가비를 바꿀 수 없어요')).toBeNull()
  expect(within(form).getByLabelText('납부자')).toHaveProperty('value', '5000')
})

test('연 뒤에 신청이 들어와 서버가 참가비를 막으면 까닭을 보이고 입력을 남긴다', async () => {
  const { api } = setup({ forms: [staffForm({ applicantCount: 0 })] })
  api.on('POST', FORM_PATH, () => json({ error: 'FORM_FEE_LOCKED' }, 409))
  fireEvent.click(await screen.findByRole('button', { name: '고치기' }))
  const form = await screen.findByRole('form', { name: '신청 양식 고치기' })
  fireEvent.change(within(form).getByLabelText('납부자'), { target: { value: '7000' } })
  fireEvent.click(save())
  expect(await within(form).findByText(REGISTRATION_STAFF_ERRORS.FORM_FEE_LOCKED!)).toBeTruthy()
  expect(within(form).getByLabelText('납부자')).toHaveProperty('value', '7000')
})
