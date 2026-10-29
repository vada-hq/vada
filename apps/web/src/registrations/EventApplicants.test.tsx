// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { EventApplicant, EventApplicantsResponse } from '@vada/contracts'
import { applicant, STAFF_EVENT_ID } from '@/test-support/staff-registration-fixtures'
import { deferredResponse, json, mockApi } from '@/test-support/mock-api'
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
  total: 51,
  page: 1,
  canView: true,
  canManage: true,
  showAffiliation: false,
  showForm: false,
  accessToken: 'read-once',
  ...extra,
})
function setup(value = data(), startsAt: string | null = null) {
  const api = mockApi()
  api.on('GET', `${PATH}?page=1`, () => json(value))
  const handlers = { onForbidden: vi.fn(), onLost: vi.fn() }
  render(
    <EventApplicants councilId="c1" eventId={STAFF_EVENT_ID} startsAt={startsAt} {...handlers} />,
  )
  return { api, handlers }
}

test('첫 쪽 이후 열람 토큰으로 다음 쪽과 이름·학번 찾기를 읽는다', async () => {
  const { api } = setup()
  await screen.findByText('김새내')
  api.on('GET', `${PATH}?page=2&accessToken=read-once`, () =>
    json(data({ page: 2, applicants: [row({ name: '다음 사람' })] })),
  )
  fireEvent.click(screen.getByRole('button', { name: '다음 쪽' }))
  await screen.findByText('다음 사람')
  api.on('GET', `${PATH}?page=1&search=2026&accessToken=read-once`, () => json(data({ total: 1 })))
  fireEvent.change(screen.getByLabelText('이름이나 학번으로 찾기'), { target: { value: '2026' } })
  await screen.findByText('김새내')
  expect(api.calls.filter(call => call.method === 'GET')).toHaveLength(3)
})

test('개인정보 열람 권한이 없으면 수만 보이고 표·검색·체크는 없다', async () => {
  setup(data({ applicants: [], canView: false, canManage: false, total: 0, accessToken: null }))
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
  api.on('GET', `${PATH}?page=1&accessToken=read-once`, () => json(value))
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

test('늦은 응답은 다음 검색 결과를 덮지 않는다', async () => {
  const { api } = setup()
  await screen.findByText('김새내')
  const pending = deferredResponse()
  api.on(
    'GET',
    `${PATH}?page=1&search=${encodeURIComponent('늦음')}&accessToken=read-once`,
    () => pending.promise,
  )
  api.on('GET', `${PATH}?page=1&search=${encodeURIComponent('최신')}&accessToken=read-once`, () =>
    json(data({ applicants: [row({ name: '최신 결과' })] })),
  )
  fireEvent.change(screen.getByLabelText('이름이나 학번으로 찾기'), { target: { value: '늦음' } })
  fireEvent.change(screen.getByLabelText('이름이나 학번으로 찾기'), { target: { value: '최신' } })
  await screen.findByText('최신 결과')
  pending.resolve(json(data({ applicants: [row({ name: '늦은 결과' })] })))
  await waitFor(() => expect(screen.queryByText('늦은 결과')).toBeNull())
})

test('다음 쪽의 열람 토큰이 만료되면 첫 쪽에서 새 열람을 시작한다', async () => {
  const { api } = setup()
  await screen.findByText('김새내')
  api.on('GET', `${PATH}?page=2&accessToken=read-once`, () => json({ error: 'INVALID_INPUT' }, 400))
  api.on('GET', `${PATH}?page=1`, () =>
    json(data({ applicants: [row({ name: '새 열람' })], accessToken: 'new-read' })),
  )
  fireEvent.click(screen.getByRole('button', { name: '다음 쪽' }))
  await screen.findByText('새 열람')
  expect(api.calls.map(call => call.path)).toEqual([
    `${PATH}?page=1`,
    `${PATH}?page=2&accessToken=read-once`,
    `${PATH}?page=1`,
  ])
})

test('일괄 실패 줄이 재조회한 필터에서 빠져도 처리 당시 이름과 이유를 남긴다', async () => {
  const { api } = setup(
    data({ applicants: [row(), row({ id: secondId, name: '이실패' })], total: 2 }),
  )
  await screen.findByText('김새내')
  api.on('POST', `${PATH}/deposit`, () =>
    json({
      results: [
        { registrationId: applicant().id, error: null },
        { registrationId: secondId, error: 'DEPOSIT_EXISTS' },
      ],
    }),
  )
  api.on('GET', `${PATH}?page=1&accessToken=read-once`, () =>
    json(data({ applicants: [], total: 0 })),
  )
  fireEvent.click(screen.getByRole('checkbox', { name: '현재 쪽 모두 선택' }))
  fireEvent.click(screen.getByRole('button', { name: '입금 확인' }))
  await screen.findByText('신청자 없음')
  expect(screen.getByText(/이실패: 이미 입금을 확인한 신청/)).toBeTruthy()
})

test('공백만 있는 검색은 전체 명단을 읽고 검색칸을 유지한다', async () => {
  const { api } = setup()
  await screen.findByText('김새내')
  api.on('GET', `${PATH}?page=1&accessToken=read-once`, () => json(data()))
  fireEvent.change(screen.getByLabelText('이름이나 학번으로 찾기'), { target: { value: '  ' } })
  await waitFor(() => expect(api.calls).toHaveLength(2))
  expect(api.calls[1]!.path).toBe(`${PATH}?page=1&accessToken=read-once`)
  expect(screen.getByLabelText('이름이나 학번으로 찾기')).toHaveProperty('value', '  ')
  api.assertNoUnexpectedRequests()
})

test('상한을 넘긴 검색은 보내지 않고 칸에서 고쳐 다시 찾을 수 있다', async () => {
  const { api } = setup()
  await screen.findByText('김새내')
  const search = screen.getByLabelText('이름이나 학번으로 찾기')
  fireEvent.change(search, { target: { value: '😀'.repeat(51) } })
  expect(search.getAttribute('aria-invalid')).toBe('true')
  expect(api.calls).toHaveLength(1)
  expect(screen.getByRole('table')).toBeTruthy()
  api.on('GET', `${PATH}?page=1&search=2026&accessToken=read-once`, () =>
    json(data({ applicants: [row({ name: '고친 검색 결과' })] })),
  )
  fireEvent.change(search, { target: { value: '2026' } })
  await screen.findByText('고친 검색 결과')
  expect(search.getAttribute('aria-invalid')).not.toBe('true')
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
    total: 3,
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

test('행사 전에는 출석 기록 없는 줄의 참석 칸이 비고, 행사가 시작되면 불참이다', async () => {
  setup(data({ total: 1 }), '2099-01-01T10:00')
  const before = await rowOf('김새내')
  expect(within(before).getByText('참석 기록 없음')).toBeTruthy()
  expect(within(before).queryByText('불참')).toBeNull()
  cleanup()
  setup(data({ total: 1 }), '2020-01-01T10:00')
  expect(within(await rowOf('김새내')).getByText('불참')).toBeTruthy()
})

test('머리 수는 받은 명단에서 세고, 수를 누르면 그 상태로 거른다', async () => {
  const { api } = setup(three())
  await screen.findByText('가입금')
  const filters = screen.getByRole('group', { name: '참가자 거르기' })
  expect(within(filters).getByRole('button', { name: '총 3명' }).getAttribute('aria-pressed')).toBe(
    'true',
  )
  expect(within(filters).getByRole('button', { name: '입금 안 함 2' })).toBeTruthy()
  api.on('GET', `${PATH}?page=1&needsAttention=true&accessToken=read-once`, () =>
    json(data({ total: 2, applicants: three().applicants.slice(1) })),
  )
  fireEvent.click(within(filters).getByRole('button', { name: '확인 필요 2' }))
  await waitFor(() => expect(screen.queryByText('가입금')).toBeNull())
  expect(
    within(filters).getByRole('button', { name: '확인 필요 2' }).getAttribute('aria-pressed'),
  ).toBe('true')
})

test('여러 쪽이면 모르는 상태별 수는 적지 않는다', async () => {
  setup(data({ total: 120 }))
  await screen.findByText('김새내')
  const filters = screen.getByRole('group', { name: '참가자 거르기' })
  expect(within(filters).getByRole('button', { name: '총 120명' })).toBeTruthy()
  expect(within(filters).getByRole('button', { name: '입금 안 함' })).toBeTruthy()
  expect(within(filters).getByRole('button', { name: '확인 필요' })).toBeTruthy()
})

test('일괄 띠는 입금 확인과 참석 처리만 있고 불참 처리는 없다', async () => {
  setup(three())
  await screen.findByText('가입금')
  fireEvent.click(screen.getByRole('checkbox', { name: '가입금 선택' }))
  const bar = screen.getByRole('region', { name: '일괄 처리' })
  expect(within(bar).getByText('1명 선택')).toBeTruthy()
  expect(within(bar).getByRole('button', { name: '입금 확인' })).toBeTruthy()
  expect(within(bar).getByRole('button', { name: '참석 처리' })).toBeTruthy()
  expect(within(bar).queryByRole('button', { name: '불참 처리' })).toBeNull()
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
  api.on('GET', `${PATH}?page=1&accessToken=read-once`, () => json(value))
  fireEvent.click(screen.getByRole('checkbox', { name: '가입금 선택' }))
  fireEvent.click(screen.getByRole('checkbox', { name: '다중복 선택' }))
  fireEvent.click(screen.getByRole('button', { name: '입금 확인' }))
  await screen.findByText('1명 처리, 1명 실패')
  expect(within(await rowOf('가입금')).getByText('처리')).toBeTruthy()
  expect(within(await rowOf('다중복')).getByText(/실패/)).toBeTruthy()
})

test('읽기 권한만 있으면 휴대폰 폭에서도 체크와 일괄 띠가 없고, 관리 권한이면 휴대폰 폭에도 체크가 있다', async () => {
  navigationWidth(390)
  setup(data({ canManage: false, total: 1 }))
  await screen.findByText('김새내')
  expect(screen.queryByRole('table')).toBeNull()
  expect(screen.queryByRole('checkbox')).toBeNull()
  expect(screen.queryByRole('region', { name: '일괄 처리' })).toBeNull()
  cleanup()
  setup(data({ total: 1 }))
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
  setup(data({ total: 1, showForm: true }))
  await screen.findByText('김새내')
  await waitFor(() => expect(screen.queryByRole('table')).toBeNull())
  expect(screen.getByRole('list', { name: '행사 참가자' })).toBeTruthy()
  cleanup()
  setup(data({ total: 1 }))
  expect(await screen.findByRole('table')).toBeTruthy()
})
