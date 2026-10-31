// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { EventApplicant, EventApplicantsResponse } from '@vada/contracts'
import { applicant, STAFF_EVENT_ID } from '@/test-support/staff-registration-fixtures'
import { json, mockApi } from '@/test-support/mock-api'
import { navigationWidth } from '@/test-support/navigation-width'
import { EventApplicants } from './EventApplicants'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})
const PATH = `/api/organizations/c1/events/${STAFF_EVENT_ID}/applicants`
const secondId = '00000000-0000-4000-8000-0000000000a2'
const row = (extra: Partial<EventApplicant> = {}): EventApplicant => ({
  ...applicant(),
  formId: 'f1',
  formTitle: '참가 신청',
  affiliation: null,
  answers: [],
  needsAttention: false,
  ...extra,
})
const data = (extra: Partial<EventApplicantsResponse> = {}): EventApplicantsResponse => ({
  applicants: [row()],
  counts: { applicants: 51, attended: 3 },
  truncated: false,
  canView: true,
  canManage: true,
  showAffiliation: false,
  showForm: false,
  ...extra,
})
function setup(value = data(), startsAt: string | null = null) {
  const api = mockApi()
  api.on('GET', PATH, () => json(value))
  const handlers = { onForbidden: vi.fn(), onLost: vi.fn() }
  render(
    <EventApplicants councilId="c1" eventId={STAFF_EVENT_ID} startsAt={startsAt} {...handlers} />,
  )
  return { api, handlers }
}

// 명단은 한 번 읽고 거르기·찾기·쪽 넘김은 화면이 한다(DEC-93: 서버에서 쪽을 넘기면 쪽마다 열람 기록이 는다).
const many = (count: number) =>
  Array.from({ length: count }, (_, index) =>
    row({
      id: `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
      name: `참가자${index + 1}`,
      studentId: `2026${String(index + 1).padStart(4, '0')}`,
    }),
  )
const gets = (api: ReturnType<typeof mockApi>) =>
  api.calls.filter(call => call.method === 'GET').length

test('명단은 한 번 읽고 50줄씩 쪽을 넘기며, 쪽 넘김·찾기는 서버를 다시 부르지 않는다', async () => {
  const { api } = setup(data({ applicants: many(51) }))
  await screen.findByText('참가자1')
  expect(screen.queryByText('참가자51')).toBeNull()
  expect(screen.getByText('1 / 2')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: '다음 쪽' }))
  expect(await screen.findByText('참가자51')).toBeTruthy()
  expect(screen.queryByText('참가자1')).toBeNull()
  fireEvent.change(screen.getByLabelText('이름이나 학번으로 찾기'), {
    target: { value: '20260002' },
  })
  expect(await screen.findByText('참가자2')).toBeTruthy()
  expect(screen.queryByText('참가자51')).toBeNull()
  expect(screen.queryByRole('navigation', { name: '참가자 쪽 넘기기' })).toBeNull()
  expect(gets(api)).toBe(1)
  expect(api.calls[0]!.path).toBe(PATH)
})

test('개인정보 열람 권한이 없으면 수만 보이고 표·검색·체크는 없다', async () => {
  setup(data({ applicants: [], canView: false, canManage: false }))
  await screen.findByText('신청 51명')
  expect(screen.getByText('참석 3명')).toBeTruthy()
  expect(screen.queryByRole('table')).toBeNull()
  expect(screen.queryByRole('checkbox', { name: '현재 쪽 모두 선택' })).toBeNull()
  expect(screen.queryByLabelText('이름이나 학번으로 찾기')).toBeNull()
})

test('읽기 권한만 있으면 명단은 보이고 선택과 일괄 띠는 없다', async () => {
  setup(data({ canManage: false }))
  await screen.findByText('김새내')
  expect(screen.queryByRole('checkbox', { name: '김새내 선택' })).toBeNull()
  expect(screen.queryByRole('button', { name: '입금 확인' })).toBeNull()
})

test('일괄 입금 확인은 선택한 줄만 보내고 실패 줄과 이유를 남긴다', async () => {
  const value = data({ applicants: [row(), row({ id: secondId, name: '이실패' })] })
  const { api } = setup(value)
  await screen.findByText('김새내')
  api.on('POST', `${PATH}/deposit`, () =>
    json({
      results: [
        { registrationId: applicant().id, error: null },
        { registrationId: secondId, error: 'DEPOSIT_EXISTS' },
      ],
    }),
  )
  fireEvent.click(screen.getByRole('checkbox', { name: '현재 쪽 모두 선택' }))
  fireEvent.click(screen.getByRole('button', { name: '입금 확인' }))
  await screen.findByText('1명 처리, 1명 실패')
  expect(screen.getByText(/이실패: 이미 입금을 확인한 신청/)).toBeTruthy()
  expect(screen.getByRole('checkbox', { name: '김새내 선택' })).toHaveProperty('checked', false)
  expect(screen.getByRole('checkbox', { name: '이실패 선택' })).toHaveProperty('checked', true)
  expect(api.calls.find(call => call.method === 'POST')?.body).toEqual({
    registrationIds: [applicant().id, secondId],
  })
})

test('⋯에서 기존 입금 확인 금액 창을 연다', async () => {
  setup()
  await screen.findByText('김새내')
  fireEvent.keyDown(screen.getByRole('button', { name: '김새내 동작' }), { key: 'ArrowDown' })
  fireEvent.click(await screen.findByRole('menuitem', { name: '입금 확인' }))
  expect(await screen.findByLabelText('입금 금액(원)')).toHaveProperty('value', '5000')
})

test('일괄 실패 줄이 재조회한 필터에서 빠져도 처리 당시 이름과 이유를 남긴다', async () => {
  const { api } = setup(data({ applicants: [row(), row({ id: secondId, name: '이실패' })] }))
  await screen.findByText('김새내')
  api.on('POST', `${PATH}/deposit`, () =>
    json({
      results: [
        { registrationId: applicant().id, error: null },
        { registrationId: secondId, error: 'DEPOSIT_EXISTS' },
      ],
    }),
  )
  // 쓰기 뒤에는 명단을 다시 읽는다(그사이 줄이 빠졌다).
  api.on('GET', PATH, () => json(data({ applicants: [] })))
  fireEvent.click(screen.getByRole('checkbox', { name: '현재 쪽 모두 선택' }))
  fireEvent.click(screen.getByRole('button', { name: '입금 확인' }))
  await screen.findByText('신청자 없음')
  expect(screen.getByText(/이실패: 이미 입금을 확인한 신청/)).toBeTruthy()
})

test('공백만 있는 검색은 전체 명단을 보이고 검색칸을 유지하며 서버를 부르지 않는다', async () => {
  const { api } = setup()
  await screen.findByText('김새내')
  fireEvent.change(screen.getByLabelText('이름이나 학번으로 찾기'), { target: { value: '  ' } })
  expect(screen.getByText('김새내')).toBeTruthy()
  expect(screen.getByLabelText('이름이나 학번으로 찾기')).toHaveProperty('value', '  ')
  expect(gets(api)).toBe(1)
  api.assertNoUnexpectedRequests()
})

// 답은 명단을 읽는 사람 모두가 본다(관리 권한과 상관없다).
test('한 사람 보기에 질문마다 답이 보이고 관리 권한이 없어도 같다', async () => {
  const answers = [
    { questionId: 'q1', title: '티셔츠 사이즈', values: ['M'] },
    { questionId: 'q2', title: '참가 종목', values: [] },
  ]
  setup(data({ canManage: false, applicants: [row({ answers })] }))
  fireEvent.click(await screen.findByRole('button', { name: '김새내' }))
  const panel = await screen.findByRole('dialog', { name: '김새내' })
  expect(within(panel).getByText('티셔츠 사이즈')).toBeTruthy()
  expect(within(panel).getByText('M')).toBeTruthy()
  expect(within(panel).getByText('참가 종목')).toBeTruthy()
})

// 신청자 관리 화면(문서 속 얇은 표 모양, 10/30 확정)
const thirdId = '00000000-0000-4000-8000-0000000000a3'
const three = () =>
  data({
    applicants: [
      row({ name: '가입금', studentId: '20260010' }),
      row({
        id: secondId,
        name: '나중복',
        studentId: '20260020',
        duplicateStudentId: true,
        needsAttention: true,
        deposit: { status: 'confirmed', amount: 5000 },
        actions: ['deposit.cancel'],
      }),
      row({
        id: thirdId,
        name: '다중복',
        studentId: '20260020',
        duplicateStudentId: true,
        needsAttention: true,
      }),
    ],
  })
const rowOf = async (name: string) => (await screen.findByText(name)).closest('tr') as HTMLElement

test('확인 필요 줄이 맨 위에 모이고 같은 학번 경고에 상대 이름이 붙는다', async () => {
  setup(three())
  await screen.findByText('가입금')
  const names = screen
    .getAllByRole('row')
    .slice(1)
    .map(tr => tr.textContent ?? '')
  expect(names[0]).toContain('나중복')
  expect(names[1]).toContain('다중복')
  expect(names[2]).toContain('가입금')
  expect(within(await rowOf('나중복')).getByText('같은 학번 · 다중복')).toBeTruthy()
  expect(within(await rowOf('다중복')).getByText('같은 학번 · 나중복')).toBeTruthy()
  expect(within(await rowOf('나중복')).getByRole('img', { name: '확인 필요' })).toBeTruthy()
})

test('입금 안 함 줄에 받을 금액(적용 참가비)이 붙고 입금 확인 줄은 받은 금액이다', async () => {
  setup(three())
  const unpaid = await rowOf('가입금')
  expect(within(unpaid).getByText('입금 안 함')).toBeTruthy()
  expect(within(unpaid).getByText('5,000원')).toBeTruthy()
  expect(within(unpaid).getByText('받을 금액')).toBeTruthy()
  const paid = await rowOf('나중복')
  expect(within(paid).getByText('입금 확인')).toBeTruthy()
  expect(within(paid).queryByText('받을 금액')).toBeNull()
})

test('참석 칸은 출석 기록의 결과다: 기록이 없으면 행사 뒤에도 기록 없음, 불참 처리한 줄은 불참', async () => {
  setup(data(), '2020-01-01T10:00')
  const none = await rowOf('김새내')
  expect(within(none).getByText('참석 기록 없음')).toBeTruthy()
  expect(within(none).queryByText('불참')).toBeNull()
  cleanup()
  setup(data({ applicants: [row({ absent: true })] }), '2020-01-01T10:00')
  expect(within(await rowOf('김새내')).getByText('불참')).toBeTruthy()
})

test('머리 수는 받은 명단에서 세고, 수를 누르면 그 상태로 거른다', async () => {
  const { api } = setup(three())
  await screen.findByText('가입금')
  const filters = screen.getByRole('group', { name: '참가자 거르기' })
  expect(within(filters).getByRole('button', { name: '총 3명' }).getAttribute('aria-pressed')).toBe(
    'true',
  )
  // 입금 확인한 나중복은 빼고 센다.
  expect(within(filters).getByRole('button', { name: '입금 안 함 2' })).toBeTruthy()
  fireEvent.click(within(filters).getByRole('button', { name: '확인 필요 2' }))
  await waitFor(() => expect(screen.queryByText('가입금')).toBeNull())
  expect(
    within(filters).getByRole('button', { name: '확인 필요 2' }).getAttribute('aria-pressed'),
  ).toBe('true')
  expect(gets(api)).toBe(1)
})

test('총 N명은 취소하지 않은 신청만 세고 환불 대기는 따로 세며, 줄도 그 수만큼이다', async () => {
  const refund = row({
    id: secondId,
    name: '나환불',
    cancelled: true,
    deposit: { status: 'refund_pending', amount: 5000 },
    needsAttention: true,
  })
  setup(data({ applicants: [row(), refund, row({ id: thirdId, name: '다신청' })] }))
  await screen.findByText('김새내')
  const filters = screen.getByRole('group', { name: '참가자 거르기' })
  expect(within(filters).getByRole('button', { name: '총 2명' })).toBeTruthy()
  expect(screen.queryByText('나환불')).toBeNull()
  fireEvent.click(within(filters).getByRole('button', { name: '환불 대기 1명' }))
  await screen.findByText('나환불')
  expect(screen.queryByText('김새내')).toBeNull()
  // 취소한 신청이 없으면 따로 보일 수도 없다.
  cleanup()
  setup(data({ applicants: [row()] }))
  await screen.findByText('김새내')
  expect(screen.queryByRole('button', { name: /환불 대기/ })).toBeNull()
})

test('고른 줄이 취소돼 명단에서 빠지면 고른 것에서도 빠져 일괄 처리에 실리지 않는다', async () => {
  let rows = [row(), row({ id: secondId, name: '나환불' })]
  const api = mockApi()
  api.on('GET', PATH, () => json(data({ applicants: rows })))
  render(
    <EventApplicants
      councilId="c1"
      eventId={STAFF_EVENT_ID}
      onForbidden={vi.fn()}
      onLost={vi.fn()}
    />,
  )
  await screen.findByText('나환불')
  fireEvent.click(screen.getByRole('checkbox', { name: '나환불 선택' }))
  expect(await screen.findByText('1명 선택')).toBeTruthy()
  rows = [
    row(),
    row({
      id: secondId,
      name: '나환불',
      cancelled: true,
      deposit: { status: 'refund_pending', amount: 5000 },
    }),
  ]
  fireEvent.click(screen.getByRole('button', { name: '새로 읽기' }))
  await waitFor(() => expect(screen.queryByText('나환불')).toBeNull())
  await waitFor(() => expect(screen.queryByText('1명 선택')).toBeNull())
})

test('신청자가 모두 환불 대기면 전체는 비고 환불 대기로 간다', async () => {
  setup(
    data({
      applicants: [
        row({
          name: '나환불',
          cancelled: true,
          deposit: { status: 'refund_pending', amount: 5000 },
        }),
      ],
    }),
  )
  const filters = await screen.findByRole('group', { name: '참가자 거르기' })
  expect(within(filters).getByRole('button', { name: '총 0명' })).toBeTruthy()
  expect(screen.getByText('신청자 없음')).toBeTruthy()
  fireEvent.click(within(filters).getByRole('button', { name: '환불 대기 1명' }))
  expect(await screen.findByText('나환불')).toBeTruthy()
})

test('50명이 넘어도 상태별 수는 명단 전부에서 세고, 확인 필요 줄은 첫 쪽 맨 위로 모인다', async () => {
  const rows = many(60)
  rows[55] = { ...rows[55]!, needsAttention: true, absent: true }
  setup(data({ applicants: rows }))
  await screen.findByText('참가자1')
  const filters = screen.getByRole('group', { name: '참가자 거르기' })
  expect(within(filters).getByRole('button', { name: '총 60명' })).toBeTruthy()
  expect(within(filters).getByRole('button', { name: '입금 안 함 60' })).toBeTruthy()
  expect(within(filters).getByRole('button', { name: '확인 필요 1' })).toBeTruthy()
  expect(within(filters).getByRole('button', { name: '불참 1' })).toBeTruthy()
  expect(screen.getAllByRole('row')[1]!.textContent).toContain('참가자56')
})

test('일괄 띠: 행사 전에는 입금 확인과 참석 처리, 행사 첫날부터 불참 처리가 더해져 그 길로 보낸다', async () => {
  setup(three(), '2099-01-01T10:00')
  await screen.findByText('가입금')
  fireEvent.click(screen.getByRole('checkbox', { name: '가입금 선택' }))
  const before = screen.getByRole('region', { name: '일괄 처리' })
  expect(within(before).getByText('1명 선택')).toBeTruthy()
  expect(within(before).getByRole('button', { name: '입금 확인' })).toBeTruthy()
  expect(within(before).getByRole('button', { name: '참석 처리' })).toBeTruthy()
  expect(within(before).queryByRole('button', { name: '불참 처리' })).toBeNull()
  cleanup()
  const { api } = setup(three(), '2020-01-01T10:00')
  await screen.findByText('가입금')
  api.on('POST', `${PATH}/absence`, () =>
    json({ results: [{ registrationId: applicant().id, error: null }] }),
  )
  fireEvent.click(screen.getByRole('checkbox', { name: '가입금 선택' }))
  const bar = screen.getByRole('region', { name: '일괄 처리' })
  fireEvent.click(within(bar).getByRole('button', { name: '불참 처리' }))
  await screen.findByText('1명 처리, 0명 실패')
  expect(api.calls.find(call => call.method === 'POST')?.body).toEqual({
    registrationIds: [applicant().id],
  })
  expect(within(await rowOf('가입금')).getByText('처리')).toBeTruthy()
})

test('일괄 결과가 그 줄에도 남는다', async () => {
  const value = three()
  const { api } = setup(value)
  await screen.findByText('가입금')
  api.on('POST', `${PATH}/deposit`, () =>
    json({
      results: [
        { registrationId: applicant().id, error: null },
        { registrationId: thirdId, error: 'DEPOSIT_EXISTS' },
      ],
    }),
  )
  fireEvent.click(screen.getByRole('checkbox', { name: '가입금 선택' }))
  fireEvent.click(screen.getByRole('checkbox', { name: '다중복 선택' }))
  fireEvent.click(screen.getByRole('button', { name: '입금 확인' }))
  await screen.findByText('1명 처리, 1명 실패')
  expect(within(await rowOf('가입금')).getByText('처리')).toBeTruthy()
  expect(within(await rowOf('다중복')).getByText(/실패/)).toBeTruthy()
})

test('읽기 권한만 있으면 휴대폰 폭에서도 체크와 일괄 띠가 없고, 관리 권한이면 휴대폰 폭에도 체크가 있다', async () => {
  navigationWidth(390)
  setup(data({ canManage: false }))
  await screen.findByText('김새내')
  expect(screen.queryByRole('table')).toBeNull()
  expect(screen.queryByRole('checkbox')).toBeNull()
  expect(screen.queryByRole('region', { name: '일괄 처리' })).toBeNull()
  cleanup()
  setup(data())
  expect(await screen.findByRole('checkbox', { name: '김새내 선택' })).toBeTruthy()
})

test('이름을 누르면 한 사람 보기에 휴대폰·답이 보인다', async () => {
  const answers = [{ questionId: 'q1', title: '티셔츠 사이즈', values: ['M'] }]
  setup(data({ canManage: false, applicants: [row({ phone: '010-1234-5678', answers })] }))
  fireEvent.click(await screen.findByRole('button', { name: '김새내' }))
  const panel = await screen.findByRole('dialog', { name: '김새내' })
  expect(within(panel).getByText('010-1234-5678')).toBeTruthy()
  expect(within(panel).getByText('티셔츠 사이즈')).toBeTruthy()
  expect(within(panel).getByText('M')).toBeTruthy()
})

test('데스크톱 창이어도 명단 종이가 열을 다 담지 못하면(양식 열이 더해진 1024px) 두 줄 목록이다', async () => {
  navigationWidth(1024)
  vi.stubGlobal(
    'ResizeObserver',
    class {
      constructor(private readonly report: ResizeObserverCallback) {}
      observe() {
        this.report(
          [{ contentRect: { width: 736 } } as ResizeObserverEntry],
          this as unknown as ResizeObserver,
        )
      }
      disconnect() {}
    },
  )
  setup(data({ showForm: true }))
  await screen.findByText('김새내')
  await waitFor(() => expect(screen.queryByRole('table')).toBeNull())
  expect(screen.getByRole('list', { name: '행사 참가자' })).toBeTruthy()
  cleanup()
  setup(data())
  expect(await screen.findByRole('table')).toBeTruthy()
})

test('입금 안 함 수와 거르기는 받을 돈이 있는 신청만이다(무료 신청은 빼고 센다)', async () => {
  const free = row({ id: thirdId, name: '무료생', appliedFee: 0, payer: true })
  const owing = row({ name: '미입금' })
  const paid = row({ id: secondId, name: '입금함', deposit: { status: 'confirmed', amount: 5000 } })
  setup(data({ applicants: [owing, paid, free] }))
  await screen.findByText('무료생')
  const filters = screen.getByRole('group', { name: '참가자 거르기' })
  fireEvent.click(within(filters).getByRole('button', { name: '입금 안 함 1' }))
  await waitFor(() => expect(screen.queryByText('무료생')).toBeNull())
  expect(screen.getByText('미입금')).toBeTruthy()
  expect(within(filters).getByRole('button', { name: '입금 안 함 1' })).toBeTruthy()
})

test('불참한 줄의 ⋯에는 출석과 불참 취소가 있고, 불참 취소는 출석 취소 길로 보낸다', async () => {
  const absent = row({
    absent: true,
    actions: ['registration.check_in', 'registration.cancel_check_in', 'registration.cancel'],
  })
  const { api } = setup(data({ applicants: [absent] }))
  await screen.findByText('김새내')
  api.on('POST', `/api/organizations/c1/registrations/${absent.id}/attendance/cancel`, () =>
    json({
      cancelled: true,
      applicant: {
        id: absent.id,
        attended: false,
        absent: false,
        cancelled: false,
        deposit: absent.deposit,
        listed: true,
        actions: ['registration.check_in', 'registration.mark_absent', 'registration.cancel'],
      },
    }),
  )
  fireEvent.keyDown(screen.getByRole('button', { name: '김새내 동작' }), { key: 'ArrowDown' })
  expect(await screen.findByRole('menuitem', { name: '출석' })).toBeTruthy()
  fireEvent.click(screen.getByRole('menuitem', { name: '불참 취소' }))
  await waitFor(() =>
    expect(api.calls.some(call => call.path.endsWith('/attendance/cancel'))).toBe(true),
  )
})
