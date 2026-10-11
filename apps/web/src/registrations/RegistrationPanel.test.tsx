// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { EventSummary, RegistrationResponse } from '@vada/contracts'
import { deferredResponse, json, mockApi } from '../test-support/mock-api'
import { event as eventFixture } from '../test-support/workflow-fixtures'
import RegistrationPanel from './RegistrationPanel'
import { activeRoster, checkedBy, entry, feeAccount, feeEntries, feeForm, feeResponse, paidBy, registrationForm, registrationResponse }
  from './registration-fixtures'
import { useRegistration } from './useRegistration'

afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks() })
const base = '/api/organizations/o/events/e/registration'
const timed = (overrides: Partial<EventSummary> = {}): EventSummary =>
  ({ ...eventFixture(), startsAt: '2026-08-20T10:00', endsAt: '2026-08-20T18:00', place: 'ERICA 체육관', ...overrides })
function Harness({ event, onEventChange, readOnly }: { event: EventSummary; onEventChange: (event: EventSummary) => void; readOnly?: boolean }) {
  const state = useRegistration('o', 'e', true)
  return <RegistrationPanel organizationId="o" event={event} state={state} onEventChange={onEventChange} readOnly={readOnly} />
}
function setup(body: RegistrationResponse = registrationResponse(), event = timed(), readOnly = false) {
  const api = mockApi()
  api.on('GET', base, () => json(body))
  const onEventChange = vi.fn()
  render(<Harness event={event} onEventChange={onEventChange} readOnly={readOnly} />)
  return { api, onEventChange }
}
const region = (name: string) => screen.findByRole('region', { name })
const field = (container: HTMLElement, label: string) => within(container).getByLabelText(label) as HTMLInputElement

test('행사 정보: 일시가 없으면 넣으라고 알리고, 고치면 PATCH 본문을 보내고 바뀐 행사를 넘긴다', async () => {
  const { api, onEventChange } = setup(registrationResponse({ form: null, registrations: [] }), timed({ startsAt: null, endsAt: null, place: null }))
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
  const { api } = setup(registrationResponse({ form: null, registrations: [] }))
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
    collectPhone: false, fee: 0, memberFee: null }))
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
    notice: '문의: 학생회실', collectPhone: false, fee: 0, memberFee: null })
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
  // 참가비가 없는 참가 신청이면 거르기와 참가비 칩이 없다.
  expect(within(list).queryByRole('button', { name: /입금 전/ })).toBeNull()
  expect(within(list).queryByText('참가비 없음')).toBeNull()
  fireEvent.click(within(list).getByRole('button', { name: '김바다 관리' }))
  fireEvent.click(within(await screen.findByRole('dialog', { name: '김바다' })).getByRole('button', { name: '신청 취소' }))
  const dialog = await screen.findByRole('dialog', { name: '신청을 취소할까요?' })
  expect(within(dialog).getByText('김바다(2022123456)의 신청을 취소하면 이 사람의 정보를 바로 지워요.')).toBeTruthy()
  api.on('POST', `${base}/entries/r1/cancel`, () => json(registrationResponse({ form: registrationForm({ count: 1 }),
    registrations: [entry('r2', '이수강', '2023222222')] })))
  fireEvent.click(within(dialog).getByRole('button', { name: '취소하기' }))
  await waitFor(() => expect(within(list).queryByText('김바다')).toBeNull())
  expect(api.calls.at(-1)).toMatchObject({ method: 'POST', body: {} })
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
})

test('보관 기간이 지나면 지웠다고 알리고, 신청이 없으면 비어 있다고 알린다', async () => {
  setup(registrationResponse({ form: registrationForm({ purged: true, count: 2, state: 'closed', checkedIn: 1 }), registrations: [] }))
  expect(await screen.findByText('보관 기간이 지나 신청자 정보를 지웠어요(신청 2명 · 참석 1명).')).toBeTruthy()
  expect(screen.queryByRole('button', { name: 'QR로 참석 확인' })).toBeNull()
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

test('참가 신청 카드: 참가비·계좌·받은 참가비를 보이고, 납부자 참가비인데 명단이 없으면 경고하며, 무료면 없음이다', async () => {
  setup(feeResponse())
  const card = await region('참가 신청')
  for (const text of ['7,000원 · 학생회비 납부자 0원', '카카오뱅크 3333-01-1234567 (학생회)', '받은 참가비 7,000원 · 1명']) {
    expect(within(card).getByText(text)).toBeTruthy()
  }
  expect(within(card).queryByText(/학생회비 명단이 없어/)).toBeNull()
  cleanup()
  setup(feeResponse({ roster: null }))
  expect(await screen.findByText('학생회비 명단이 없어 지금 신청하는 사람은 모두 미납자 참가비가 돼요. 재정 담당자에게 명단을 올려 달라고 해 주세요.'))
    .toBeTruthy()
  cleanup()
  setup()
  expect(within(await region('참가 신청')).getByText('없음')).toBeTruthy()
})

test('신청 받기 멈추기는 누르는 동안 꺼진다', async () => {
  const { api } = setup()
  const card = await region('참가 신청')
  const pending = deferredResponse()
  api.on('PATCH', base, () => pending.promise)
  const button = within(card).getByRole('button', { name: '신청 받기 멈추기' })
  fireEvent.click(button)
  await waitFor(() => expect(button.hasAttribute('disabled')).toBe(true))
  pending.resolve(json(registrationResponse({ form: registrationForm({ accepting: false, state: 'paused', version: 2 }) })))
  await waitFor(() => expect(within(card).getByRole('button', { name: '다시 받기' }).hasAttribute('disabled')).toBe(false))
})

test('설정 대화상자: 참가비를 넣고, 계좌나 명단이 없거나 금액이 맞지 않으면 이유를 적고 저장을 끈다', async () => {
  setup(registrationResponse({ account: null, roster: null }))
  fireEvent.click(within(await region('참가 신청')).getByRole('button', { name: '설정 바꾸기' }))
  let dialog = await screen.findByRole('dialog', { name: '참가 신청 설정' })
  expect(field(dialog, '참가비(원)').value).toBe('0')
  expect(within(dialog).getByText('0이면 무료예요.')).toBeTruthy()
  fireEvent.change(field(dialog, '참가비(원)'), { target: { value: '5,000' } })
  expect(within(dialog).getByText("학생회 계좌가 없어 참가비를 받을 수 없어요. 재정 담당자에게 '참가비 설정'에서 계좌를 넣어 달라고 해 주세요.")).toBeTruthy()
  expect(within(dialog).getByRole('button', { name: '저장' }).hasAttribute('disabled')).toBe(true)
  cleanup()
  setup(registrationResponse({ account: feeAccount, roster: null }))
  fireEvent.click(within(await region('참가 신청')).getByRole('button', { name: '설정 바꾸기' }))
  dialog = await screen.findByRole('dialog', { name: '참가 신청 설정' })
  fireEvent.change(field(dialog, '참가비(원)'), { target: { value: '5000' } })
  expect(within(dialog).getByText('카카오뱅크 3333-01-1234567 (학생회)')).toBeTruthy()
  expect(within(dialog).getByRole('button', { name: '저장' }).hasAttribute('disabled')).toBe(false)
  fireEvent.click(field(dialog, '학생회비 납부자는 다른 금액'))
  expect(within(dialog).getByText('쓸 수 있는 학생회비 명단이 없어요. 재정 담당자에게 명단을 올려 달라고 해 주세요.')).toBeTruthy()
  expect(within(dialog).getByRole('button', { name: '저장' }).hasAttribute('disabled')).toBe(true)
})

test('설정 대화상자: 납부자 참가비는 참가비보다 적어야 저장하고, 보낸 본문에 두 금액이 있으며, 입금 확인이 있으면 금액을 잠근다', async () => {
  const { api } = setup(registrationResponse({ account: feeAccount, roster: activeRoster }))
  fireEvent.click(within(await region('참가 신청')).getByRole('button', { name: '설정 바꾸기' }))
  const dialog = await screen.findByRole('dialog', { name: '참가 신청 설정' })
  fireEvent.change(field(dialog, '참가비(원)'), { target: { value: '5000' } })
  fireEvent.click(field(dialog, '학생회비 납부자는 다른 금액'))
  fireEvent.change(field(dialog, '납부자 참가비(원)'), { target: { value: '5000' } })
  expect(within(dialog).getByText('납부자 참가비는 참가비보다 적어야 해요.')).toBeTruthy()
  const save = within(dialog).getByRole('button', { name: '저장' })
  expect(save.hasAttribute('disabled')).toBe(true)
  fireEvent.change(field(dialog, '납부자 참가비(원)'), { target: { value: '0' } })
  expect(save.hasAttribute('disabled')).toBe(false)
  api.on('PATCH', base, () => json({ error: 'EVENT_SETTLED' }, 409))
  fireEvent.click(save)
  expect(await within(dialog).findByText('정산이 끝난 행사라 참가비와 입금을 바꿀 수 없어요.')).toBeTruthy()
  expect(api.calls.filter(call => call.method === 'PATCH').at(-1)!.body).toMatchObject({ version: 1, fee: 5000, memberFee: 0 })
  cleanup()
  setup(feeResponse())
  fireEvent.click(within(await region('참가 신청')).getByRole('button', { name: '설정 바꾸기' }))
  const locked = await screen.findByRole('dialog', { name: '참가 신청 설정' })
  expect(field(locked, '참가비(원)').disabled).toBe(true)
  expect(field(locked, '납부자 참가비(원)').disabled).toBe(true)
  expect(within(locked).getByText('입금을 확인한 신청이 있어 참가비를 바꿀 수 없어요.')).toBeTruthy()
})

test('신청자 명단: 참가비 칩과 거르기를 보이고, 줄의 입금 확인은 바로 확인하며 실패하면 알린다', async () => {
  const { api } = setup(feeResponse())
  const list = await region('신청자')
  for (const text of ['참가비 없음', '7,000원 · 입금 확인', '7,000원 · 입금 전', '학생회비 납부']) expect(within(list).getByText(text)).toBeTruthy()
  fireEvent.click(within(list).getByRole('button', { name: '입금 전 1' }))
  expect(within(list).queryByText('김바다')).toBeNull()
  expect(within(list).getByText('박참여')).toBeTruthy()
  fireEvent.click(within(list).getByRole('button', { name: '입금 확인 1' }))
  expect(within(list).queryByText('박참여')).toBeNull()
  expect(within(list).getByText('이수강')).toBeTruthy()
  fireEvent.click(within(list).getByRole('button', { name: '전체 3' }))
  api.on('POST', `${base}/entries/r3/payment`, () => json(feeResponse({ form: feeForm({ payments: { count: 2, total: 14000 } }),
    registrations: feeEntries({ r3: { paid: { ...paidBy, at: '2026-08-04T09:00' } } }) })))
  fireEvent.click(within(list).getByRole('button', { name: '박참여 입금 확인' }))
  await waitFor(() => expect(api.calls.at(-1)).toMatchObject({ method: 'POST', path: `${base}/entries/r3/payment`, body: {} }))
  await waitFor(() => expect(within(list).getAllByText('7,000원 · 입금 확인')).toHaveLength(2))
  expect(within(await region('참가 신청')).getByText('받은 참가비 14,000원 · 2명')).toBeTruthy()
  // 다른 운영진이 먼저 확인했으면 알리고 다시 불러온다.
  cleanup()
  const second = setup(feeResponse())
  second.api.on('POST', `${base}/entries/r3/payment`, () => json({ error: 'PAYMENT_CONFIRMED' }, 409))
  const fresh = await region('신청자')
  fireEvent.click(within(fresh).getByRole('button', { name: '박참여 입금 확인' }))
  expect(await within(fresh).findByText('입금을 확인한 신청이라 바꿀 수 없어요. 먼저 입금 확인을 취소해 주세요.')).toBeTruthy()
  await waitFor(() => expect(second.api.calls.filter(call => call.method === 'GET')).toHaveLength(2))
})

test('관리 대화상자: 입금자명과 입금 상태를 보이고, 확인 취소·참가비 바꾸기·신청 취소를 한다', async () => {
  const { api } = setup(feeResponse())
  fireEvent.click(within(await region('신청자')).getByRole('button', { name: '이수강 관리' }))
  const dialog = await screen.findByRole('dialog', { name: '이수강' })
  expect(within(dialog).getByText('이수강2222')).toBeTruthy()
  expect(within(dialog).getByText('입금 확인 · 8월 3일 (월) 오전 10:00 · 기획')).toBeTruthy()
  expect(within(dialog).getByRole('button', { name: '납부자 참가비로 바꾸기' }).hasAttribute('disabled')).toBe(true)
  api.on('POST', `${base}/entries/r2/payment/cancel`, () => json(feeResponse({ form: feeForm({ payments: { count: 0, total: 0 } }),
    registrations: feeEntries({ r2: { paid: null } }) })))
  fireEvent.click(within(dialog).getByRole('button', { name: '입금 확인 취소' }))
  expect(await within(dialog).findByRole('button', { name: '입금 확인' })).toBeTruthy()
  expect(within(dialog).getByText('입금 전')).toBeTruthy()
  api.on('POST', `${base}/entries/r2/dues`, () => json(feeResponse({ form: feeForm({ payments: { count: 0, total: 0 } }),
    registrations: feeEntries({ r2: { paid: null, duesMember: true, fee: 0 } }) })))
  fireEvent.click(within(dialog).getByRole('button', { name: '납부자 참가비로 바꾸기' }))
  expect(await within(dialog).findByRole('button', { name: '미납자 참가비로 바꾸기' })).toBeTruthy()
  expect(api.calls.at(-1)).toMatchObject({ method: 'POST', path: `${base}/entries/r2/dues`, body: { duesMember: true } })
  cleanup()
  const second = setup(feeResponse())
  fireEvent.click(within(await region('신청자')).getByRole('button', { name: '이수강 관리' }))
  fireEvent.click(within(await screen.findByRole('dialog', { name: '이수강' })).getByRole('button', { name: '신청 취소' }))
  const confirm = await screen.findByRole('dialog', { name: '신청을 취소할까요?' })
  expect(within(confirm).getByText(/받은 참가비 7,000원은 그대로 남아요\. 돌려줬다면 먼저 입금 확인을 취소해 주세요\./)).toBeTruthy()
  second.api.on('POST', `${base}/entries/r2/cancel`, () => json(feeResponse({ registrations: feeEntries().filter(item => item.id !== 'r2') })))
  fireEvent.click(within(confirm).getByRole('button', { name: '취소하기' }))
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  expect(within(await region('신청자')).queryByText('이수강')).toBeNull()
})

test('정산한 행사: 명단에 입금 확인 버튼이 없고 이유를 적으며, 관리는 그대로 연다', async () => {
  setup(feeResponse({ settled: true }))
  const list = await region('신청자')
  expect(within(list).getByText('정산이 끝난 행사라 입금과 참가비를 바꿀 수 없어요.')).toBeTruthy()
  expect(within(list).queryByRole('button', { name: '박참여 입금 확인' })).toBeNull()
  expect(within(list).getByText('7,000원 · 입금 전')).toBeTruthy()
  expect(within(list).getByRole('button', { name: '박참여 관리' })).toBeTruthy()
})

test('정산한 행사: 관리 대화상자에 입금·참가비 버튼이 없고 이유를 적으며, 신청 취소는 남는다', async () => {
  setup(feeResponse({ settled: true }))
  fireEvent.click(within(await region('신청자')).getByRole('button', { name: '이수강 관리' }))
  const paid = await screen.findByRole('dialog', { name: '이수강' })
  expect(within(paid).getByText('정산이 끝난 행사라 입금과 참가비를 바꿀 수 없어요.')).toBeTruthy()
  for (const name of ['입금 확인 취소', '납부자 참가비로 바꾸기']) expect(within(paid).queryByRole('button', { name })).toBeNull()
  expect(within(paid).getByText('입금 확인 · 8월 3일 (월) 오전 10:00 · 기획')).toBeTruthy()
  expect(within(paid).getByRole('button', { name: '신청 취소' })).toBeTruthy()
  // 아래 닫기 버튼과 머리의 닫기(X)가 있다.
  fireEvent.click(within(paid).getAllByRole('button', { name: '닫기' })[0]!)
  fireEvent.click(within(await region('신청자')).getByRole('button', { name: '박참여 관리' }))
  const unpaid = await screen.findByRole('dialog', { name: '박참여' })
  expect(within(unpaid).getByText('입금 전')).toBeTruthy()
  for (const name of ['입금 확인', '납부자 참가비로 바꾸기']) expect(within(unpaid).queryByRole('button', { name })).toBeNull()
})

test('정산한 행사: 설정 대화상자의 금액 칸을 끄고 이유를 적는다', async () => {
  setup(feeResponse({ settled: true, form: feeForm({ payments: { count: 0, total: 0 } }) }))
  fireEvent.click(within(await region('참가 신청')).getByRole('button', { name: '설정 바꾸기' }))
  const dialog = await screen.findByRole('dialog', { name: '참가 신청 설정' })
  expect(field(dialog, '참가비(원)').disabled).toBe(true)
  expect(field(dialog, '학생회비 납부자는 다른 금액').disabled).toBe(true)
  expect(field(dialog, '납부자 참가비(원)').disabled).toBe(true)
  expect(within(dialog).getByText('정산이 끝난 행사라 참가비를 바꿀 수 없어요.')).toBeTruthy()
  expect(within(dialog).queryByText('입금을 확인한 신청이 있어 참가비를 바꿀 수 없어요.')).toBeNull()
})

test('정산한 행사: 입금을 확인한 신청을 취소할 때는 정산을 다시 열어야 확인을 취소할 수 있다고 알린다', async () => {
  setup(feeResponse({ settled: true }))
  fireEvent.click(within(await region('신청자')).getByRole('button', { name: '이수강 관리' }))
  fireEvent.click(within(await screen.findByRole('dialog', { name: '이수강' })).getByRole('button', { name: '신청 취소' }))
  const confirm = await screen.findByRole('dialog', { name: '신청을 취소할까요?' })
  expect(within(confirm).getByText(
    /받은 참가비 7,000원은 그대로 남아요\. 돌려줬다면 재정 담당자에게 정산을 다시 열어 달라고 한 뒤 입금 확인을 먼저 취소해 주세요\./)).toBeTruthy()
  expect(within(confirm).queryByText(/돌려줬다면 먼저 입금 확인을 취소해 주세요/)).toBeNull()
})

// 김바다는 참석했고 이수강은 참석 전이다.
const attended = (both = false) => registrationResponse({ form: registrationForm({ checkedIn: both ? 2 : 1 }),
  registrations: [entry('r1', '김바다', '2022123456', null, { checkedIn: checkedBy }), entry('r2', '이수강', '2023222222', null,
    { checkedIn: both ? checkedBy : null })] })

test('참석: 참가 신청 카드에 참석 수를 보이고, 줄의 참석은 바로 확인하며, 참석한 줄은 칩만 보인다', async () => {
  const { api } = setup(attended())
  const card = await region('참가 신청')
  expect(within(card).getByText('참석')).toBeTruthy()
  expect(within(card).getByText('1명')).toBeTruthy()
  const list = await region('신청자')
  // 참석 전인 줄의 [참석] 버튼과 글자가 같아 칩만 고른다.
  const chips = () => within(list).queryAllByText('참석', { selector: '[data-slot="badge"]' })
  expect(chips()).toHaveLength(1)
  expect(within(list).queryByRole('button', { name: '김바다 참석 확인' })).toBeNull()
  api.on('POST', `${base}/entries/r2/check-in`, () => json(attended(true)))
  fireEvent.click(within(list).getByRole('button', { name: '이수강 참석 확인' }))
  await waitFor(() => expect(api.calls.at(-1)).toMatchObject({ method: 'POST', path: `${base}/entries/r2/check-in`, body: {} }))
  await waitFor(() => expect(chips()).toHaveLength(2))
  expect(within(await region('참가 신청')).getByText('2명')).toBeTruthy()
})

test('참석 거르기: 참가비가 없어도 참석·참석 전으로 거른다', async () => {
  setup(attended())
  const list = await region('신청자')
  expect(within(list).queryByRole('button', { name: /입금 전/ })).toBeNull()
  fireEvent.click(within(list).getByRole('button', { name: '참석 1' }))
  expect(within(list).queryByText('이수강')).toBeNull()
  expect(within(list).getByText('김바다')).toBeTruthy()
  fireEvent.click(within(list).getByRole('button', { name: '참석 전 1' }))
  expect(within(list).queryByText('김바다')).toBeNull()
  expect(within(list).getByText('이수강')).toBeTruthy()
  fireEvent.click(within(list).getByRole('button', { name: '전체 2' }))
  expect(within(list).getByText('김바다')).toBeTruthy()
})

test('관리 대화상자: 참석을 확인하고 취소하며, 참석한 신청은 신청 취소를 끄고 이유를 적는다', async () => {
  const { api } = setup(attended())
  fireEvent.click(within(await region('신청자')).getByRole('button', { name: '이수강 관리' }))
  const dialog = await screen.findByRole('dialog', { name: '이수강' })
  expect(within(dialog).getByText('참석 전')).toBeTruthy()
  expect(within(dialog).getByRole('button', { name: '신청 취소' }).hasAttribute('disabled')).toBe(false)
  api.on('POST', `${base}/entries/r2/check-in`, () => json(attended(true)))
  fireEvent.click(within(dialog).getByRole('button', { name: '참석 확인' }))
  expect((await within(dialog).findByText('참석 확인 · 8월 20일 (목) 오전 10:02 · 기획')).className).toContain('wrap-anywhere')
  expect(within(dialog).getByRole('button', { name: '신청 취소' }).hasAttribute('disabled')).toBe(true)
  expect(within(dialog).getByText('참석을 확인한 신청은 먼저 참석 확인을 취소해 주세요.')).toBeTruthy()
  api.on('POST', `${base}/entries/r2/check-in/cancel`, () => json(attended()))
  fireEvent.click(within(dialog).getByRole('button', { name: '참석 확인 취소' }))
  expect(await within(dialog).findByText('참석 전')).toBeTruthy()
  expect(api.calls.at(-1)).toMatchObject({ method: 'POST', path: `${base}/entries/r2/check-in/cancel`, body: {} })
  expect(within(dialog).getByRole('button', { name: '신청 취소' }).hasAttribute('disabled')).toBe(false)
})

test('참석 확인이 엇갈리면 알리고 다시 불러온다', async () => {
  const { api } = setup(attended())
  api.on('POST', `${base}/entries/r2/check-in`, () => json({ error: 'CHECKED_IN' }, 409))
  const list = await region('신청자')
  fireEvent.click(within(list).getByRole('button', { name: '이수강 참석 확인' }))
  expect(await within(list).findByText('이미 참석을 확인한 신청이에요. 새로 불러왔어요.')).toBeTruthy()
  await waitFor(() => expect(api.calls.filter(call => call.method === 'GET')).toHaveLength(2))
})

test('완료한 행사의 참가자 탭은 보기만 한다: 행사 정보·설정·신청자 단추가 없고 링크 복사는 된다', async () => {
  setup(registrationResponse(), timed({ completedAt: '2026-10-12T01:00:00.000Z' }), true)
  const registration = await region('참가 신청')
  expect(within(registration).getByRole('button', { name: '링크 복사' })).toBeTruthy()
  for (const name of ['설정 바꾸기', '신청 받기 멈추기', '다시 받기']) expect(within(registration).queryByRole('button', { name })).toBeNull()
  expect(within(await region('행사 정보')).queryByRole('button', { name: '행사 정보 수정' })).toBeNull()
  const registrants = await region('신청자')
  expect(within(registrants).getByText('김바다')).toBeTruthy()
  for (const name of ['QR로 참석 확인', '김바다 참석 확인', '김바다 관리', '김바다 입금 확인']) {
    expect(within(registrants).queryByRole('button', { name })).toBeNull()
  }
})

test('완료한 행사에 신청서가 없으면 만들 단추 없이 안내만 보인다', async () => {
  setup(registrationResponse({ form: null, registrations: [] }), timed({ completedAt: '2026-10-12T01:00:00.000Z' }), true)
  const registration = await region('참가 신청')
  expect(within(registration).queryByRole('button', { name: '참가 신청 받기' })).toBeNull()
})

test('완료한 행사에 일시가 없으면 넣으라고 하지 않고 미정이라고만 보인다', async () => {
  setup(registrationResponse({ form: null, registrations: [] }), timed({ startsAt: null, endsAt: null, place: null, completedAt: '2026-10-12T01:00:00.000Z' }), true)
  const info = await region('행사 정보')
  expect(within(info).getByText('일시 미정')).toBeTruthy()
  expect(within(info).queryByText('일시를 넣어 주세요.')).toBeNull()
})
