// @vitest-environment jsdom
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import {
  CANCEL_PATH,
  FORM_PATH,
  LOOKUP_PATH,
  myRegistration,
  publicForm,
} from '@/test-support/registration-fixtures'
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
  vi.useRealTimers()
})

function setup(mine = myRegistration(), token = 'tok123') {
  const api = mockApi()
  api.on('POST', LOOKUP_PATH, () => json(mine))
  render(<MyRegistrationPage token={token} />)
  return api
}

// 같은 기기에서 신청했으면 코드가 남아 있어 공개 양식에서 행사 일시·장소·지우는 날을 읽는다.
function setupSaved(mine = myRegistration(), form = publicForm()) {
  window.localStorage.setItem(SAVED_KEY, 'tok123')
  const api = mockApi()
  api.on('POST', LOOKUP_PATH, () => json(mine))
  api.on('GET', FORM_PATH, () => json(form))
  render(<MyRegistrationPage token="tok123" />)
  return api
}

async function openQr() {
  fireEvent.click(await screen.findByRole('button', { name: /^입장 QR/ }))
  return within(await screen.findByRole('dialog')).getByRole('img', { name: '입장 QR' })
}

test('토큰은 본문으로만 보내고 내가 넣은 것과 참가비, 계좌가 보이며 입장 QR은 시트에 있다', async () => {
  const api = setup()
  expect(await screen.findByText('신입생 환영회 · 김새내')).toBeTruthy()
  expect(api.calls[api.calls.length - 1]?.body).toEqual({ token: 'tok123' })
  expect(api.calls.every(call => !call.path.includes('tok123'))).toBe(true)
  expect(screen.getByText('20260001')).toBeTruthy()
  expect(screen.getByText('참가비 5,000원')).toBeTruthy()
  expect(screen.getByText('국민은행')).toBeTruthy()
  expect(screen.getByText('123-456-789012')).toBeTruthy()
  // 행사 당일 전에는 QR이 접혀 있다(신청 직후 QR이 주인공이 아니다, 내용 ④).
  expect(screen.queryByRole('img', { name: '입장 QR' })).toBeNull()
  const qr = await openQr()
  expect(qr.querySelector('path')?.getAttribute('d')?.length).toBeGreaterThan(100)
  expect(qr.getAttribute('class')).toContain('bg-white')
  expect(qr.querySelector('path')?.getAttribute('class')).toContain('fill-black')
})

test('참가비가 없으면 계좌·입금 상태가 없고, 출석했으면 QR 대신 출석 확인됨이 보인다', async () => {
  setup(myRegistration({ appliedFee: 0, account: null, attended: true, cancellable: false }))
  expect(await screen.findByText('참가비 무료')).toBeTruthy()
  expect(screen.queryByRole('region', { name: '입금 계좌' })).toBeNull()
  expect(screen.queryByText(/은행/)).toBeNull()
  expect(screen.queryByText('입금 전')).toBeNull()
  expect(screen.queryByRole('button', { name: '신청 취소' })).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: /^입장 QR/ }))
  const dialog = await screen.findByRole('dialog')
  expect(within(dialog).getByText('출석 확인됨')).toBeTruthy()
  expect(within(dialog).queryByRole('img', { name: '입장 QR' })).toBeNull()
})

test('QR 판에는 이름과 행사명만 있고 입금 상태·학번은 없으며 사방 여백이 4모듈 이상이다', async () => {
  setup()
  const qr = await openQr()
  const plate = qr.closest<HTMLElement>('[data-plate]')!
  expect(within(plate).getByText('김새내 · 신입생 환영회')).toBeTruthy()
  for (const text of ['20260001', '입금 전']) expect(within(plate).queryByText(text)).toBeNull()
  // QR의 matrix 안 여백 2모듈에 흰 네모 안쪽 여백(p-3)을 더한다.
  expect(qr.parentElement?.className).toContain('p-3')
  expect(qr.parentElement?.className).toContain('bg-white')
  const matrix = qrMatrix(myRegistration().qrText)
  expect(qr.querySelector('path')?.getAttribute('d')).toBe(qrPath(matrix))
  const sides = [matrix[0]!, matrix[1]!, matrix.at(-1)!, matrix.at(-2)!]
  expect(sides.every(row => row.every(value => !value))).toBe(true)
  expect(matrix.every(row => !row[0] && !row[1] && !row.at(-1) && !row.at(-2))).toBe(true)
  expect(screen.queryByRole('button', { name: /QR.*(저장|공유|다운로드)/ })).toBeNull()
})

test('개인 링크를 다시 읽으면 확인됨과 확인 취소 상태가 바뀐다', async () => {
  const api = setup()
  expect(await screen.findByText('입금 전')).toBeTruthy()
  api.on('POST', LOOKUP_PATH, () => json({ ...myRegistration(), depositConfirmed: true }))
  document.dispatchEvent(new Event('visibilitychange'))
  expect(await screen.findByText('입금 확인됨')).toBeTruthy()
  api.on('POST', LOOKUP_PATH, () => json({ ...myRegistration(), depositConfirmed: false }))
  document.dispatchEvent(new Event('visibilitychange'))
  expect(await screen.findByText('입금 전')).toBeTruthy()
})

test('모르는 토큰이면 찾을 수 없다고 하고 기억한 토큰을 지운다', async () => {
  window.localStorage.setItem(SAVED_KEY, 'tok123')
  const api = mockApi()
  api.on('POST', LOOKUP_PATH, () => json({ error: 'NOT_FOUND' }, 404))
  api.on('GET', FORM_PATH, () => json(publicForm()))
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
  const api = setupSaved()
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

test('계좌 면을 누르면 계좌번호를 복사하고 화면 아래에 알린다', async () => {
  const writeText = vi.fn(async () => {})
  vi.stubGlobal('navigator', { clipboard: { writeText } })
  setup()
  fireEvent.click(await screen.findByRole('button', { name: '계좌번호 복사' }))
  expect(await screen.findByText('계좌번호를 복사했어요')).toBeTruthy()
  expect(writeText).toHaveBeenCalledWith('123-456-789012')
})

test('주소 복사가 막히면 주소를 보여 길게 눌러 복사하게 한다', async () => {
  setup()
  vi.stubGlobal('navigator', { clipboard: undefined })
  fireEvent.click(await screen.findByRole('button', { name: '주소 복사' }))
  expect(await screen.findByText(/길게 눌러 복사해 주세요/)).toBeTruthy()
  expect(screen.getByText(window.location.href)).toBeTruthy()
})

test('차례: 완료 → 참가비 → 계좌 → 입장 QR → 행사 정보·문의 → 다시 열기 → 취소 → 지우는 날', async () => {
  setupSaved()
  const title = await screen.findByRole('heading', { name: '신청 완료', level: 1 })
  const account = screen.getByRole('region', { name: '입금 계좌' })
  expect(within(account).getByText('입금 전')).toBeTruthy()
  const purge = await screen.findByText('신청 정보는 2027년 10월 24일에 지워져요.')
  const ordered = [
    title,
    screen.getByText('참가비 5,000원'),
    screen.getByText('신입생 환영회 · 김새내'),
    account,
    screen.getByRole('button', { name: /^입장 QR/ }),
    screen.getByText('10월 24일 (토) 14:00 ~ 18:00'),
    screen.getByText('대강당'),
    screen.getByText(myRegistration().form.notice!),
    screen.getByText('문의는 위 안내에 적힌 곳으로 해 주세요.'),
    screen.getByText('같은 휴대폰으로 신청 링크를 다시 열면 이 화면이 나와요'),
    screen.getByRole('button', { name: '주소 복사' }),
    screen.getByRole('button', { name: '신청 취소' }),
    purge,
  ]
  for (let index = 1; index < ordered.length; index++)
    expect(
      ordered[index - 1]!.compareDocumentPosition(ordered[index]!) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
  expect(screen.queryByText(/저장해 두/)).toBeNull()
})

test('이 기기에 신청 코드가 없으면 행사 일시·장소·지우는 날 없이 문의만 보인다', async () => {
  const api = setup()
  expect(await screen.findByText('문의는 위 안내에 적힌 곳으로 해 주세요.')).toBeTruthy()
  expect(screen.queryByText(/지워져요/)).toBeNull()
  expect(screen.queryByText('대강당')).toBeNull()
  expect(api.calls.some(call => call.method === 'GET')).toBe(false)
})

test('입금 상태는 서버의 입금 확인 값이고 계좌 면에 한 번만 보인다', async () => {
  setup(myRegistration({ depositConfirmed: true }))
  const account = await screen.findByRole('region', { name: '입금 계좌' })
  expect(within(account).getByText('입금 확인됨')).toBeTruthy()
  expect(screen.getAllByText('입금 확인됨')).toHaveLength(1)
  expect(screen.queryByText('입금 전')).toBeNull()
})

test('질문이 있는 양식이면 내 답이 질문마다 보이고 답하지 않은 질문은 답 없음이다', async () => {
  setup(
    myRegistration({
      answers: [
        { questionId: 'q1', title: '티셔츠 사이즈', values: ['M'] },
        { questionId: 'q2', title: '참가 종목', values: ['축구', '농구'] },
        { questionId: 'q3', title: '하고 싶은 말', values: [] },
      ],
    }),
  )
  const answers = await screen.findByRole('region', { name: '내 답' })
  expect(within(answers).getByText('티셔츠 사이즈')).toBeTruthy()
  expect(within(answers).getByText('축구, 농구')).toBeTruthy()
  expect(within(answers).getByText('답 없음')).toBeTruthy()
})

// 행사 당일(한국 날짜가 행사 기간 안)에는 입장 QR이 맨 위로 온다(내용 ④).
const ON_THE_DAY = new Date('2026-10-24T13:00:00+09:00')

test('행사 당일이면 입장 QR이 맨 위에 펼쳐 있고 완료는 그 아래다', async () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(ON_THE_DAY)
  setupSaved()
  const top = await screen.findByRole('heading', { name: '입장 QR', level: 1 })
  const qr = screen.getByRole('img', { name: '입장 QR' })
  const done = screen.getByRole('heading', { name: '신청 완료', level: 2 })
  expect(top.compareDocumentPosition(qr) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  expect(qr.compareDocumentPosition(done) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  expect(screen.queryByRole('button', { name: /^입장 QR/ })).toBeNull()
  // 입금 전이면 그날 낼 수 있게 계좌가 남는다.
  expect(screen.getByRole('button', { name: '계좌번호 복사' })).toBeTruthy()
})

test('행사 당일에 입금이 확인됐으면 계좌를 접고 참가비와 입금 확인됨만 보인다', async () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(ON_THE_DAY)
  setupSaved(myRegistration({ depositConfirmed: true }))
  await screen.findByRole('heading', { name: '입장 QR', level: 1 })
  expect(screen.getByText('입금 확인됨')).toBeTruthy()
  expect(screen.getByText(/참가비 5,000원/)).toBeTruthy()
  expect(screen.queryByRole('button', { name: '계좌번호 복사' })).toBeNull()
  expect(screen.queryByRole('region', { name: '입금 계좌' })).toBeNull()
})

test('행사 전날과 다음 날에는 입장 QR이 접혀 있다', async () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  for (const now of ['2026-10-23T23:59:00+09:00', '2026-10-25T00:00:00+09:00']) {
    vi.setSystemTime(new Date(now))
    setupSaved()
    await screen.findByText('대강당')
    expect(screen.getByRole('heading', { name: '신청 완료', level: 1 })).toBeTruthy()
    expect(screen.getByRole('button', { name: /^입장 QR/ })).toBeTruthy()
    cleanup()
    window.localStorage.clear()
  }
})
