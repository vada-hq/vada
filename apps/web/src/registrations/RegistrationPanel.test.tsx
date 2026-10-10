// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { EventSummary, RegistrationResponse } from '@vada/contracts'
import { json, mockApi } from '../test-support/mock-api'
import { event as eventFixture } from '../test-support/workflow-fixtures'
import RegistrationPanel from './RegistrationPanel'
import { entry, registrationForm, registrationResponse } from './registration-fixtures'
import { useRegistration } from './useRegistration'

afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks() })
const base = '/api/organizations/o/events/e/registration'
const timed = (overrides: Partial<EventSummary> = {}): EventSummary =>
  ({ ...eventFixture(), startsAt: '2026-08-20T10:00', endsAt: '2026-08-20T18:00', place: 'ERICA 체육관', ...overrides })
function Harness({ event, onEventChange }: { event: EventSummary; onEventChange: (event: EventSummary) => void }) {
  const state = useRegistration('o', 'e', true)
  return <RegistrationPanel organizationId="o" event={event} state={state} onEventChange={onEventChange} />
}
function setup(body: RegistrationResponse = registrationResponse(), event = timed()) {
  const api = mockApi()
  api.on('GET', base, () => json(body))
  const onEventChange = vi.fn()
  render(<Harness event={event} onEventChange={onEventChange} />)
  return { api, onEventChange }
}
const region = (name: string) => screen.findByRole('region', { name })
const field = (container: HTMLElement, label: string) => within(container).getByLabelText(label) as HTMLInputElement

test('행사 정보: 일시가 없으면 넣으라고 알리고, 고치면 PATCH 본문을 보내고 바뀐 행사를 넘긴다', async () => {
  const { api, onEventChange } = setup({ form: null, registrations: [] }, timed({ startsAt: null, endsAt: null, place: null }))
  const info = await region('행사 정보')
  expect(within(info).getByText('일시를 넣어 주세요.')).toBeTruthy()
  const start = within(await region('참가 신청')).getByRole('button', { name: '참가 신청 받기' })
  expect(start.hasAttribute('disabled')).toBe(true)
  expect(screen.getByText('행사 일시를 먼저 넣어야 신청을 받을 수 있어요.')).toBeTruthy()
  fireEvent.click(within(info).getByRole('button', { name: '행사 정보 수정' }))
  const dialog = await screen.findByRole('dialog', { name: '행사 정보' })
  fireEvent.change(field(dialog, '시작'), { target: { value: '2026-08-20T10:00' } })
  fireEvent.change(field(dialog, '끝(선택)'), { target: { value: '2026-08-20T09:00' } })
  expect(within(dialog).getByRole('button', { name: '저장' }).hasAttribute('disabled')).toBe(true)
  fireEvent.change(field(dialog, '끝(선택)'), { target: { value: '' } })
  fireEvent.change(field(dialog, '장소(선택)'), { target: { value: ' 체육관 ' } })
  const saved = timed({ endsAt: null, place: '체육관', version: 2 })
  api.on('PATCH', '/api/organizations/o/events/e', () => json({ event: saved }))
  fireEvent.click(within(dialog).getByRole('button', { name: '저장' }))
  await waitFor(() => expect(onEventChange).toHaveBeenCalledWith(saved))
  expect(api.calls.at(-1)!.body).toEqual({ version: 1, startsAt: '2026-08-20T10:00', endsAt: null, place: ' 체육관 ' })
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
})

test('참가 신청 받기: 기본 마감은 행사 시작이고, 만들면 POST 본문을 보내고 받은 응답을 그린다', async () => {
  const { api } = setup({ form: null, registrations: [] })
  fireEvent.click(within(await region('참가 신청')).getByRole('button', { name: '참가 신청 받기' }))
  const dialog = await screen.findByRole('dialog', { name: '참가 신청 설정' })
  expect(field(dialog, '신청 마감').value).toBe('2026-08-20T10:00')
  expect(field(dialog, '정원(선택)').value).toBe('')
  expect(field(dialog, '휴대폰 번호도 받기').checked).toBe(false)
  fireEvent.change(field(dialog, '정원(선택)'), { target: { value: '200' } })
  fireEvent.change(field(dialog, '안내 문구(선택)'), { target: { value: '문의: 학생회실' } })
  api.on('POST', base, () => json(registrationResponse({ registrations: [] }), 201))
  fireEvent.click(within(dialog).getByRole('button', { name: '만들기' }))
  await waitFor(() => expect(api.calls.at(-1)!.body).toEqual({ opensAt: null, closesAt: '2026-08-20T10:00', capacity: 200, notice: '문의: 학생회실',
    collectPhone: false }))
  expect(await screen.findByText(`${window.location.origin}/apply/ABCD2345`)).toBeTruthy()
})

test('신청 받는 중: 상태·링크·인원·기간·안내·지울 날을 보여 주고, 링크를 복사한다', async () => {
  const writeText = vi.fn(async () => {})
  vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } })
  setup()
  const card = await region('참가 신청')
  for (const text of ['받는 중', '2/200명', '~ 8월 19일 (수) 오후 11:59', '문의: 학생회실', '휴대폰 번호는 받지 않아요.',
    '행사가 끝나고 30일 뒤(2026년 9월 19일) 신청자 정보를 지워요.']) expect(within(card).getByText(text)).toBeTruthy()
  fireEvent.click(within(card).getByRole('button', { name: '링크 복사' }))
  await waitFor(() => expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/apply/ABCD2345`))
  expect(await within(card).findByText('링크를 복사했어요.')).toBeTruthy()
})

test('멈추기·다시 받기: 받기 여부만 바꿔 보내고, 남이 먼저 바꿨으면 알리고 다시 불러온다', async () => {
  const { api } = setup()
  const card = await region('참가 신청')
  api.on('PATCH', base, () => json(registrationResponse({ form: registrationForm({ accepting: false, state: 'paused', version: 2 }) })))
  fireEvent.click(within(card).getByRole('button', { name: '신청 받기 멈추기' }))
  await waitFor(() => expect(within(card).getByText('멈춤')).toBeTruthy())
  expect(api.calls.at(-1)!.body).toEqual({ version: 1, accepting: false, opensAt: null, closesAt: '2026-08-19T23:59', capacity: 200,
    notice: '문의: 학생회실', collectPhone: false })
  api.on('PATCH', base, () => json({ error: 'VERSION_CONFLICT' }, 409))
  const reloads = api.calls.filter(call => call.method === 'GET').length
  fireEvent.click(within(card).getByRole('button', { name: '다시 받기' }))
  expect(await screen.findByText('다른 사람이 먼저 바꿨어요. 새로 불러온 내용을 확인해 주세요.')).toBeTruthy()
  await waitFor(() => expect(api.calls.filter(call => call.method === 'GET').length).toBe(reloads + 1))
})

test('휴대폰 번호 받기를 끄면 이미 받은 번호도 지운다고 알리고, 그 버튼으로 저장한다', async () => {
  const { api } = setup(registrationResponse({ form: registrationForm({ collectPhone: true }),
    registrations: [entry('r1', '김바다', '2022123456', '01012345678'), entry('r2', '이수강', '2023222222', '01087654321')] }))
  fireEvent.click(within(await region('참가 신청')).getByRole('button', { name: '설정 바꾸기' }))
  const dialog = await screen.findByRole('dialog', { name: '참가 신청 설정' })
  expect(field(dialog, '휴대폰 번호도 받기').checked).toBe(true)
  fireEvent.click(field(dialog, '휴대폰 번호도 받기'))
  expect(within(dialog).getByText('끄면 이미 받은 휴대폰 번호 2개도 지워요.')).toBeTruthy()
  api.on('PATCH', base, () => json(registrationResponse()))
  fireEvent.click(within(dialog).getByRole('button', { name: '번호 지우고 저장' }))
  await waitFor(() => expect(api.calls.at(-1)!.body).toMatchObject({ version: 1, accepting: true, collectPhone: false }))
})

test('명단: 순번·이름·학번·휴대폰·신청 시각을 보여 주고, 이름·학번으로 찾으며, 확인 뒤 취소한다', async () => {
  const { api } = setup(registrationResponse({ registrations: [entry('r1', '김바다', '2022123456', '01012345678'), entry('r2', '이수강', '2023222222')] }))
  const list = await region('신청자')
  for (const text of ['김바다', '2022123456', '010-1234-5678', '이수강', '8월 2일 (일) 오후 2:05']) expect(within(list).getAllByText(text).length).toBeGreaterThan(0)
  const search = within(list).getByLabelText('이름이나 학번으로 찾기')
  fireEvent.change(search, { target: { value: '김' } })
  expect(within(list).queryByText('이수강')).toBeNull()
  fireEvent.change(search, { target: { value: '2023' } })
  expect(within(list).queryByText('김바다')).toBeNull()
  fireEvent.change(search, { target: { value: '' } })
  fireEvent.click(within(list).getByRole('button', { name: '김바다 신청 취소' }))
  const dialog = await screen.findByRole('dialog', { name: '신청을 취소할까요?' })
  expect(within(dialog).getByText('김바다(2022123456)의 신청을 취소하면 이 사람의 정보를 바로 지워요.')).toBeTruthy()
  api.on('POST', `${base}/entries/r1/cancel`, () => json(registrationResponse({ form: registrationForm({ count: 1 }),
    registrations: [entry('r2', '이수강', '2023222222')] })))
  fireEvent.click(within(dialog).getByRole('button', { name: '취소하기' }))
  await waitFor(() => expect(within(list).queryByText('김바다')).toBeNull())
  expect(api.calls.at(-1)).toMatchObject({ method: 'POST', body: {} })
})

test('보관 기간이 지나면 지웠다고 알리고, 신청이 없으면 비어 있다고 알린다', async () => {
  setup(registrationResponse({ form: registrationForm({ purged: true, count: 2, state: 'closed' }), registrations: [] }))
  expect(await screen.findByText('보관 기간이 지나 신청자 정보를 지웠어요(신청 2명).')).toBeTruthy()
  cleanup()
  setup(registrationResponse({ form: registrationForm({ count: 0 }), registrations: [] }))
  expect(await screen.findByText('아직 신청한 사람이 없어요.')).toBeTruthy()
})

test('참가 신청이 있을 때 행사 정보를 고치면 참가 신청도 다시 불러와 지울 날을 맞춘다', async () => {
  const { api, onEventChange } = setup()
  const info = await region('행사 정보')
  const gets = () => api.calls.filter(call => call.method === 'GET').length
  const before = gets()
  fireEvent.click(within(info).getByRole('button', { name: '행사 정보 수정' }))
  const dialog = await screen.findByRole('dialog', { name: '행사 정보' })
  api.on('PATCH', '/api/organizations/o/events/e', () => json({ event: timed({ endsAt: '2026-08-21T18:00', version: 2 }) }))
  api.on('GET', base, () => json(registrationResponse({ form: registrationForm({ purgeAfter: '2026-09-20' }) })))
  fireEvent.change(field(dialog, '끝(선택)'), { target: { value: '2026-08-21T18:00' } })
  fireEvent.click(within(dialog).getByRole('button', { name: '저장' }))
  await waitFor(() => expect(onEventChange).toHaveBeenCalled())
  expect(await screen.findByText('행사가 끝나고 30일 뒤(2026년 9월 20일) 신청자 정보를 지워요.')).toBeTruthy()
  expect(gets()).toBe(before + 1)
})
