// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { MyRegistration } from '@vada/contracts'
import { json, mockApi } from '../test-support/mock-api'
import MyRegistrationPage from './MyRegistrationPage'

afterEach(() => {
  cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks()
  localStorage.clear()
})
const token = 'Ab3_-xYz0123456789abcd'
const lookupPath = '/api/public/registrations/lookup'
const cancelPath = '/api/public/registrations/cancel'
const mine = (overrides: Partial<MyRegistration> = {}): MyRegistration => ({ code: 'ABCD2345', organizationName: '소프트웨어융합대학 학생회',
  event: { name: '2026 체육대회', startsAt: '2026-08-20T10:00', endsAt: '2026-08-20T18:00', place: 'ERICA 체육관' }, name: '김바다',
  studentId: '2022123456', phone: '01012345678', createdAt: '2026-08-02T14:05', closesAt: '2026-08-19T23:59', cancelled: false, cancellable: true,
  payment: null, checkInCode: '0123456789abcdef'.repeat(4), checkedInAt: null, ...overrides })
const account = { bank: '카카오뱅크', accountNumber: '3333-01-1234567', holder: '컴퓨터학부 학생회' }
function setup(registration: MyRegistration | Response = mine()) {
  const api = mockApi()
  api.on('POST', lookupPath, () => registration instanceof Response ? registration : json(registration))
  render(<MyRegistrationPage token={token} />)
  return api
}

test('토큰으로 신청 내용을 보여 주고, 주소를 저장하라고 알리며 복사할 수 있다', async () => {
  const writeText = vi.fn(async () => {})
  vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } })
  const api = setup()
  expect(await screen.findByRole('heading', { name: '참가 신청이 완료됐어요' })).toBeTruthy()
  expect(api.calls[0]!.body).toEqual({ token })
  for (const text of ['2026 체육대회', '8월 20일 (목) 오전 10:00 ~ 오후 6:00', 'ERICA 체육관', '김바다', '2022123456', '010-1234-5678',
    '8월 2일 (일) 오후 2:05', '소프트웨어융합대학 학생회']) expect(screen.getByText(text)).toBeTruthy()
  expect(screen.getByText('이 화면 주소를 저장해 두세요. 신청을 확인하고 취소할 때 필요해요.')).toBeTruthy()
  expect(screen.getByText('8월 19일 (수) 오후 11:59까지 취소할 수 있어요.')).toBeTruthy()
  // 참가비가 없는 신청은 참가비 묶음이 없다.
  expect(screen.queryByRole('region', { name: '참가비' })).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: '주소 복사' }))
  await waitFor(() => expect(writeText).toHaveBeenCalledWith(window.location.href))
  expect(await screen.findByText('주소를 복사했어요.')).toBeTruthy()
})

test('마감 전에는 확인을 받고 취소하며, 취소하면 정보가 사라지고 기기에 저장한 토큰도 지운다', async () => {
  localStorage.setItem('vada.registration.ABCD2345', token)
  const api = setup(mine({ phone: null }))
  await screen.findByRole('heading', { name: '참가 신청이 완료됐어요' })
  api.on('POST', cancelPath, () => json(mine({ name: null, studentId: null, phone: null, cancelled: true, cancellable: false })))
  fireEvent.click(screen.getByRole('button', { name: '신청 취소' }))
  const dialog = await screen.findByRole('dialog', { name: '신청을 취소할까요?' })
  fireEvent.click(within(dialog).getByRole('button', { name: '취소하기' }))
  expect(await screen.findByRole('heading', { name: '신청을 취소했어요' })).toBeTruthy()
  expect(api.calls.at(-1)).toMatchObject({ method: 'POST', path: cancelPath, body: { token } })
  expect(screen.queryByText('김바다')).toBeNull()
  expect(localStorage.getItem('vada.registration.ABCD2345')).toBeNull()
})

test('취소가 막히면 이유를 알리고, 마감 뒤에는 취소 버튼 대신 문의를 안내한다', async () => {
  const api = setup()
  await screen.findByRole('heading', { name: '참가 신청이 완료됐어요' })
  api.on('POST', cancelPath, () => json({ error: 'CANCEL_CLOSED' }, 409))
  fireEvent.click(screen.getByRole('button', { name: '신청 취소' }))
  fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: '취소하기' }))
  expect(await screen.findByText('마감 뒤에는 취소할 수 없어요. 학생회에 문의해 주세요.')).toBeTruthy()
  cleanup()
  setup(mine({ cancellable: false }))
  await screen.findByRole('heading', { name: '참가 신청이 완료됐어요' })
  expect(screen.queryByRole('button', { name: '신청 취소' })).toBeNull()
  expect(screen.getByText('마감 뒤에 취소하려면 학생회에 문의해 주세요.')).toBeTruthy()
})

test('토큰이 없거나 찾을 수 없으면 알리고, 연결이 안 되면 다시 시도할 수 있다', async () => {
  render(<MyRegistrationPage token={null} />)
  const missing = '신청 정보를 찾을 수 없어요. 취소했거나 보관 기간이 지났을 수 있어요.'
  expect(screen.getByText(missing)).toBeTruthy()
  cleanup()
  setup(json({ error: 'NOT_FOUND' }, 404))
  expect(await screen.findByText(missing)).toBeTruthy()
  cleanup()
  const api = setup(json({ error: 'INTERNAL' }, 500))
  expect(await screen.findByText('신청 정보를 불러오지 못했어요.')).toBeTruthy()
  api.on('POST', lookupPath, () => json(mine()))
  fireEvent.click(screen.getByRole('button', { name: '다시 시도' }))
  expect(await screen.findByRole('heading', { name: '참가 신청이 완료됐어요' })).toBeTruthy()
})

test('브라우저 저장소를 쓸 수 없어도 보기와 취소가 된다', async () => {
  vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => { throw new Error('denied') })
  const api = setup()
  await screen.findByRole('heading', { name: '참가 신청이 완료됐어요' })
  api.on('POST', cancelPath, () => json(mine({ name: null, studentId: null, phone: null, cancelled: true, cancellable: false })))
  fireEvent.click(screen.getByRole('button', { name: '신청 취소' }))
  fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: '취소하기' }))
  expect(await screen.findByRole('heading', { name: '신청을 취소했어요' })).toBeTruthy()
})

test('참가비: 미납자 참가비면 금액·안내·계좌·입금자명을 보이고, 계좌번호는 숫자만, 입금자명은 그대로 복사한다', async () => {
  const writeText = vi.fn(async () => {})
  vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } })
  setup(mine({ payment: { basis: 'nonmember', fee: 5000, paidAt: null, account } }))
  const section = await screen.findByRole('region', { name: '참가비' })
  for (const text of ['5,000원', '학생회비 납부 명단에서 이름과 학번을 찾지 못했어요. 학생회비를 냈다면 학생회에 문의해 주세요.', '카카오뱅크',
    '3333-01-1234567', '컴퓨터학부 학생회', '김바다3456', '이 이름으로 입금해 주세요. 학생회가 입금을 확인할 때 써요.',
    "입금 확인 전이에요. 학생회가 입금을 확인하면 여기에 '입금 확인됨'이 보여요."]) expect(within(section).getByText(text)).toBeTruthy()
  fireEvent.click(within(section).getByRole('button', { name: '계좌번호 복사' }))
  await waitFor(() => expect(writeText).toHaveBeenCalledWith('3333011234567'))
  fireEvent.click(within(section).getByRole('button', { name: '입금자명 복사' }))
  await waitFor(() => expect(writeText).toHaveBeenLastCalledWith('김바다3456'))
})

test('참가비: 정액이면 미납자 안내가 없고, 납부자 0원이면 낼 돈이 없다고만 알린다', async () => {
  setup(mine({ payment: { basis: 'flat', fee: 5000, paidAt: null, account } }))
  const flat = await screen.findByRole('region', { name: '참가비' })
  expect(within(flat).getByText('5,000원')).toBeTruthy()
  expect(within(flat).queryByText(/찾지 못했어요/)).toBeNull()
  cleanup()
  setup(mine({ payment: { basis: 'member', fee: 0, paidAt: null, account: null } }))
  const member = await screen.findByRole('region', { name: '참가비' })
  expect(within(member).getByText('학생회비 납부자라 참가비가 없어요.')).toBeTruthy()
  expect(within(member).queryByRole('button', { name: '계좌번호 복사' })).toBeNull()
})

test('참가비: 입금을 확인했으면 확인 표시와 금액·시각을 보이고, 취소는 학생회에 문의하라고 한다', async () => {
  setup(mine({ cancellable: false, payment: { basis: 'nonmember', fee: 5000, paidAt: '2026-08-03T10:00', account: null } }))
  const section = await screen.findByRole('region', { name: '참가비' })
  expect(within(section).getByText('입금 확인됨')).toBeTruthy()
  expect(within(section).getByText('5,000원 · 8월 3일 (월) 오전 10:00')).toBeTruthy()
  expect(within(section).queryByRole('button', { name: '계좌번호 복사' })).toBeNull()
  expect(screen.queryByRole('button', { name: '신청 취소' })).toBeNull()
  expect(screen.getByText('입금을 확인한 신청은 학생회에 문의해 취소해 주세요.')).toBeTruthy()
  expect(screen.queryByText('마감 뒤에 취소하려면 학생회에 문의해 주세요.')).toBeNull()
  // 화면을 연 뒤 학생회가 입금을 확인했으면, 취소가 막히고 화면을 다시 불러와 입금 확인과 문의 안내를 보인다.
  cleanup()
  const stale = setup(mine({ payment: { basis: 'nonmember', fee: 5000, paidAt: null, account } }))
  await screen.findByRole('heading', { name: '참가 신청이 완료됐어요' })
  stale.on('POST', cancelPath, () => json({ error: 'PAYMENT_CONFIRMED' }, 409))
  stale.on('POST', lookupPath, () => json(mine({ cancellable: false, payment: { basis: 'nonmember', fee: 5000, paidAt: '2026-08-03T10:00', account: null } })))
  fireEvent.click(screen.getByRole('button', { name: '신청 취소' }))
  fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: '취소하기' }))
  expect(await screen.findByText('입금 확인됨')).toBeTruthy()
  expect(screen.getByText('입금을 확인한 신청은 학생회에 문의해 취소해 주세요.')).toBeTruthy()
  expect(screen.queryByRole('button', { name: '신청 취소' })).toBeNull()
  expect(screen.queryByRole('button', { name: '계좌번호 복사' })).toBeNull()
  expect(stale.calls.filter(call => call.path === lookupPath)).toHaveLength(2)
})

test('계좌번호를 복사하지 못하면 길게 눌러 복사하라고 알린다', async () => {
  vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText: vi.fn(async () => { throw new Error('denied') }) } })
  setup(mine({ payment: { basis: 'nonmember', fee: 5000, paidAt: null, account } }))
  const section = await screen.findByRole('region', { name: '참가비' })
  fireEvent.click(within(section).getByRole('button', { name: '계좌번호 복사' }))
  expect(await within(section).findByText('계좌번호를 복사하지 못했어요. 번호를 길게 눌러 복사해 주세요.')).toBeTruthy()
})

test('찾을 수 없는 신청이면 이 기기에 저장한 그 토큰만 지운다', async () => {
  localStorage.setItem('vada.registration.ABCD2345', token)
  localStorage.setItem('vada.registration.EFGH2345', 'Zz9_-xYz0123456789abcd')
  setup(json({ error: 'NOT_FOUND' }, 404))
  expect(await screen.findByText('신청 정보를 찾을 수 없어요. 취소했거나 보관 기간이 지났을 수 있어요.')).toBeTruthy()
  expect(localStorage.getItem('vada.registration.ABCD2345')).toBeNull()
  expect(localStorage.getItem('vada.registration.EFGH2345')).toBe('Zz9_-xYz0123456789abcd')
})
