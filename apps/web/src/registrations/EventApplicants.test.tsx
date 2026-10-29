// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { EventApplicant, EventApplicantsResponse } from '@vada/contracts'
import { applicant, STAFF_EVENT_ID } from '@/test-support/staff-registration-fixtures'
import { deferredResponse, json, mockApi } from '@/test-support/mock-api'
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
function setup(value = data()) {
  const api = mockApi()
  api.on('GET', `${PATH}?page=1`, () => json(value))
  const handlers = { onForbidden: vi.fn(), onLost: vi.fn() }
  render(<EventApplicants councilId="c1" eventId={STAFF_EVENT_ID} {...handlers} />)
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
  expect(screen.queryByRole('button', { name: '납부 확인' })).toBeNull()
})

test('일괄 납부는 선택한 줄만 보내고 실패 줄과 이유를 남긴다', async () => {
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
  fireEvent.click(screen.getByRole('button', { name: '납부 확인' }))
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
  fireEvent.click(screen.getByRole('button', { name: '납부 확인' }))
  await screen.findByText('행사 참가자 없음')
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
