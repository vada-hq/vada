// @vitest-environment jsdom
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { CANCEL_PATH, LOOKUP_PATH, myRegistration } from '@/test-support/registration-fixtures'
import { json, mockApi } from '@/test-support/mock-api'
import { settle } from '@/test-support/settle'
import { CANCEL_REGISTRATION_ERRORS, REGISTRATION_LOST } from '@/lib/registration-messages'
import { qrMatrix, qrPath } from '@/lib/qr-code'
import MyRegistrationPage from './MyRegistrationPage'

const SAVED_KEY = 'vada.registration.ABCD2345'

beforeEach(() => {
  window.localStorage.clear()
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

function setup(mine = myRegistration(), token = 'tok123') {
  const api = mockApi()
  api.on('POST', LOOKUP_PATH, () => json(mine))
  render(<MyRegistrationPage token={token} />)
  return api
}

test('토큰은 본문으로만 보내고 내가 넣은 것과 참가비, 계좌, QR이 보인다', async () => {
  const api = setup()
  expect(await screen.findByText('김새내')).toBeTruthy()
  expect(api.calls[api.calls.length - 1]?.body).toEqual({ token: 'tok123' })
  expect(api.calls.every(call => !call.path.includes('tok123'))).toBe(true)
  expect(screen.getByText('20260001')).toBeTruthy()
  expect(screen.getByText('5,000원')).toBeTruthy()
  expect(screen.getByText('국민은행 123-456-789012')).toBeTruthy()
  const qr = screen.getByRole('img', { name: '출석 확인 QR' })
  expect(qr.querySelector('path')?.getAttribute('d')?.length).toBeGreaterThan(100)
  expect(qr.getAttribute('class')).toContain('bg-white')
  expect(qr.querySelector('path')?.getAttribute('class')).toContain('fill-black')
})

test('참가비가 없으면 계좌가 없고, 출석했으면 QR 대신 출석 확인됨이 보인다', async () => {
  setup(myRegistration({ appliedFee: 0, account: null, attended: true, cancellable: false }))
  expect(await screen.findByText('출석 확인됨')).toBeTruthy()
  expect(screen.getByRole('heading', { name: '신입생 환영회' })).toBeTruthy()
  expect(screen.queryByRole('img', { name: '출석 확인 QR' })).toBeNull()
  expect(screen.queryByText(/은행/)).toBeNull()
  expect(screen.queryByRole('button', { name: '신청 취소' })).toBeNull()
  expect(screen.getByText('무료')).toBeTruthy()
  expect(screen.queryByText('입금 확인 전')).toBeNull()
})

test('QR 캡처 묶음에는 행사명과 안내만 더하고 개인 정보와 입금 상태는 복제하지 않는다', async () => {
  setup()
  const qr = await screen.findByRole('img', { name: '출석 확인 QR' })
  const card = qr.closest('section')!
  expect(within(card).getByRole('heading', { name: '신입생 환영회' })).toBeTruthy()
  expect(within(card).getByText('행사 당일 이 QR을 보여 주세요.')).toBeTruthy()
  for (const text of ['김새내', '20260001', '입금 확인 전'])
    expect(within(card).queryByText(text)).toBeNull()
  expect(qr.parentElement?.className).toContain('p-4')
  expect(qr.parentElement?.className).toContain('bg-white')
  const matrix = qrMatrix(myRegistration().qrText)
  expect(qr.querySelector('path')?.getAttribute('d')).toBe(qrPath(matrix))
  // size-56(14rem) QR + p-4(1rem)의 흰 바깥 여백. 작게 줄어들면 모듈당 바깥 여백은 더 커진다.
  const externalModules = matrix.length / 14
  expect(2 + externalModules).toBeGreaterThanOrEqual(4)
  const sides = [matrix[0]!, matrix[1]!, matrix.at(-1)!, matrix.at(-2)!]
  expect(sides.every(row => row.every(value => !value))).toBe(true)
  expect(matrix.every(row => !row[0] && !row[1] && !row.at(-1) && !row.at(-2))).toBe(true)
  expect(screen.getByText('입금 확인 전')).toBeTruthy()
  expect(screen.queryByRole('button', { name: /QR.*(저장|공유|다운로드)/ })).toBeNull()
})

test('개인 링크를 다시 읽으면 확인됨과 확인 취소 상태가 바뀐다', async () => {
  const api = setup()
  expect(await screen.findByText('입금 확인 전')).toBeTruthy()
  api.on('POST', LOOKUP_PATH, () => json({ ...myRegistration(), depositConfirmed: true }))
  document.dispatchEvent(new Event('visibilitychange'))
  expect(await screen.findByText('입금 확인됨')).toBeTruthy()
  api.on('POST', LOOKUP_PATH, () => json({ ...myRegistration(), depositConfirmed: false }))
  document.dispatchEvent(new Event('visibilitychange'))
  expect(await screen.findByText('입금 확인 전')).toBeTruthy()
})

test('모르는 토큰이면 찾을 수 없다고 하고 기억한 토큰을 지운다', async () => {
  window.localStorage.setItem(SAVED_KEY, 'tok123')
  const api = mockApi()
  api.on('POST', LOOKUP_PATH, () => json({ error: 'NOT_FOUND' }, 404))
  render(<MyRegistrationPage token="tok123" />)
  expect((await screen.findByRole('alert')).textContent).toBe(REGISTRATION_LOST)
  expect(window.localStorage.getItem(SAVED_KEY)).toBeNull()
})

test('토큰이 없는 주소는 서버에 묻지 않고 찾을 수 없다고 한다', async () => {
  const api = mockApi()
  render(<MyRegistrationPage token="" />)
  expect((await screen.findByRole('alert')).textContent).toBe(REGISTRATION_LOST)
  expect(api.calls).toHaveLength(0)
})

test('취소는 확인을 거치고, 하면 신청을 취소했다고 하며 기억한 토큰을 지운다', async () => {
  window.localStorage.setItem(SAVED_KEY, 'tok123')
  const api = setup()
  api.on('POST', CANCEL_PATH, () => json({ cancelled: true }))
  fireEvent.click(await screen.findByRole('button', { name: '신청 취소' }))
  expect(api.calls.some(call => call.path === CANCEL_PATH)).toBe(false)
  const dialog = await screen.findByRole('dialog')
  fireEvent.click(within(dialog).getByRole('button', { name: '신청 취소' }))
  expect(await screen.findByText('신청을 취소했어요.')).toBeTruthy()
  expect(api.calls.find(call => call.path === CANCEL_PATH)?.body).toEqual({ token: 'tok123' })
  expect(window.localStorage.getItem(SAVED_KEY)).toBeNull()
})

test('취소가 끝난 뒤 다시 읽기가 돌아도 취소했어요가 찾을 수 없어요로 바뀌지 않는다', async () => {
  const api = setup()
  api.on('POST', CANCEL_PATH, () => json({ cancelled: true }))
  fireEvent.click(await screen.findByRole('button', { name: '신청 취소' }))
  fireEvent.click(
    within(await screen.findByRole('dialog')).getByRole('button', { name: '신청 취소' }),
  )
  await screen.findByText('신청을 취소했어요.')
  // 취소 뒤 서버는 404다. 화면이 다시 읽으면 문구가 바뀐다.
  api.on('POST', LOOKUP_PATH, () => json({ error: 'NOT_FOUND' }, 404))
  const reads = api.calls.filter(call => call.path === LOOKUP_PATH).length
  document.dispatchEvent(new Event('visibilitychange'))
  await settle()
  expect(screen.getByText('신청을 취소했어요.')).toBeTruthy()
  expect(api.calls.filter(call => call.path === LOOKUP_PATH)).toHaveLength(reads)
})

test('마감 뒤 409로 취소 버튼이 사라져도 이유가 남고 확인 창은 닫힌다', async () => {
  const api = setup()
  api.on('POST', CANCEL_PATH, () => json({ error: 'CANCEL_CLOSED' }, 409))
  fireEvent.click(await screen.findByRole('button', { name: '신청 취소' }))
  // 다시 읽으면 마감이 지나 취소할 수 없다.
  api.on('POST', LOOKUP_PATH, () => json(myRegistration({ cancellable: false })))
  fireEvent.click(
    within(await screen.findByRole('dialog')).getByRole('button', { name: '신청 취소' }),
  )
  await waitFor(() => expect(screen.queryByRole('button', { name: '신청 취소' })).toBeNull())
  expect((await screen.findByRole('alert')).textContent).toBe(
    CANCEL_REGISTRATION_ERRORS.CANCEL_CLOSED,
  )
  expect(screen.queryByRole('dialog')).toBeNull()
})

test('계좌번호 복사 버튼은 정의 목록 밖에 있다', async () => {
  setup()
  const button = await screen.findByRole('button', { name: '계좌번호 복사' })
  expect(button.closest('dl')).toBeNull()
})

test('주소 복사가 막히면 주소를 보여 길게 눌러 복사하게 한다', async () => {
  setup()
  vi.stubGlobal('navigator', { clipboard: undefined })
  fireEvent.click(await screen.findByRole('button', { name: '주소 복사' }))
  expect(await screen.findByText(/길게 눌러 복사해 주세요/)).toBeTruthy()
})
