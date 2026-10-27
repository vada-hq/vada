// @vitest-environment jsdom
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { qrTextOf } from '@vada/contracts'
import { deferredResponse, json, mockApi } from '@/test-support/mock-api'
import {
  CHECK_IN_PATH,
  REGISTRATION_ID,
  STAFF_EVENT_ID,
  applicantChange,
} from '@/test-support/staff-registration-fixtures'
import { PERMISSION_CHANGED } from '@/lib/messages'
import { REGISTRATION_STAFF_ERRORS } from '@/lib/registration-messages'
import { CameraError, openCamera } from './camera'
import { CheckInScanner } from './CheckInScanner'
import { loadQrReader, type QrReader } from './qr-reader'

// 카메라와 판독기는 가짜다. 판독기는 줄에 넣은 글자를 한 번에 하나씩 읽는다.
vi.mock('./camera', async importActual => ({
  ...(await importActual<typeof import('./camera')>()),
  openCamera: vi.fn(),
}))
vi.mock('./qr-reader', () => ({ loadQrReader: vi.fn() }))

const HASH = '0123456789abcdef'.repeat(4)
const READY = '참가자의 QR을 네모 안에 맞춰 주세요.'
let queue: string[] = []
let reader: QrReader & { read: ReturnType<typeof vi.fn> }
const track = { stop: vi.fn() }

beforeEach(() => {
  vi.resetAllMocks()
  queue = []
  reader = { read: vi.fn(async () => queue.shift() ?? null) }
  vi.mocked(loadQrReader).mockResolvedValue(reader)
  vi.mocked(openCamera).mockImplementation(
    async () => ({ getTracks: () => [track] }) as unknown as MediaStream,
  )
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined)
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

async function open() {
  const api = mockApi()
  const handlers = { onForbidden: vi.fn(), onLost: vi.fn(), onChecked: vi.fn(), onClose: vi.fn() }
  render(<CheckInScanner councilId="c1" eventId={STAFF_EVENT_ID} {...handlers} />)
  const dialog = await screen.findByRole('dialog', { name: 'QR로 출석 확인' })
  await within(dialog).findByText(READY)
  return { api, dialog, handlers }
}
const ATTENDANCE_ID = '00000000-0000-4000-8000-0000000000b1'
const result = (already: boolean) => ({
  registrationId: REGISTRATION_ID,
  attendanceId: ATTENDANCE_ID,
  applicant: applicantChange(),
  name: '김새내',
  studentId: '20260001',
  already,
})
const FIRST_AT = '2026-10-27T05:03:00.000Z'
const DEPOSIT_PATH = `/api/organizations/c1/registrations/${REGISTRATION_ID}/deposit`
const UNDO_PATH = `/api/organizations/c1/registrations/${REGISTRATION_ID}/attendance/cancel`
const free = applicantChange({ actions: ['registration.cancel_check_in'] })
const cardOf = (dialog: HTMLElement) => within(dialog).findByRole('status', { name: '찍은 결과' })
const posts = (api: ReturnType<typeof mockApi>, path: string) =>
  api.calls.filter(call => call.method === 'POST' && call.path === path)

test('무료 QR: 해시(소문자)로 출석을 보내 판정과 이름·학번을 보이고, 카메라 대신 결과를 보이며 [다음 사람] 전에는 읽지 않는다', async () => {
  const { api, dialog, handlers } = await open()
  api.on('POST', CHECK_IN_PATH, () => json({ ...result(false), appliedFee: 0, applicant: free }))
  queue.push(qrTextOf(HASH))
  const card = await cardOf(dialog)
  expect(within(card).getByText('입장 가능')).toBeTruthy()
  expect(within(card).getByText('김새내').className).toContain('text-lg')
  expect(within(card).getByText('학번 20260001')).toBeTruthy()
  expect(within(card).getByText('참가비 없음')).toBeTruthy()
  expect(api.calls.at(-1)).toMatchObject({
    method: 'POST',
    path: CHECK_IN_PATH,
    body: { tokenHash: HASH },
  })
  expect(handlers.onChecked).toHaveBeenCalledWith(free)
  // 결과는 카메라 화면 안에 겹치지 않고, 카메라 화면을 숨긴 자리에 놓여 잘리지 않는다.
  const view = within(dialog).getByLabelText('카메라 화면').parentElement as HTMLElement
  expect(view.contains(card)).toBe(false)
  expect(view.classList.contains('hidden')).toBe(true)
  // 주 버튼은 하나이고, 닫는 길은 창의 X 하나다.
  expect(within(card).getAllByRole('button')).toHaveLength(1)
  expect(within(dialog).getAllByRole('button', { name: '닫기' })).toHaveLength(1)
  const reads = reader.read.mock.calls.length
  await new Promise(resolve => setTimeout(resolve, 700))
  expect(reader.read.mock.calls.length).toBe(reads)
  // 같은 QR을 다시 찍으면 입장 불가다(QR 다시 쓰기일 수 있다). 누구인지와 처음 출석한 시각을 보인다.
  api.on('POST', CHECK_IN_PATH, () =>
    json({ ...result(true), appliedFee: 0, applicant: free, checkedInAt: FIRST_AT }),
  )
  queue.push(qrTextOf(HASH))
  fireEvent.click(within(card).getByRole('button', { name: '다음 사람' }))
  expect(view.classList.contains('hidden')).toBe(false)
  const again = await cardOf(dialog)
  expect(within(again).getByText('입장 불가 · 이미 출석')).toBeTruthy()
  expect(within(again).getByText('김새내')).toBeTruthy()
  expect(within(again).getByText('학번 20260001')).toBeTruthy()
  expect(within(again).getByText(/^처음 출석 (2026년 )?10월 27일 \(화\) 14:03$/)).toBeTruthy()
  expect(posts(api, CHECK_IN_PATH)).toHaveLength(2)
})

test('그 행사 신청이 아니면(404) 입장 불가 · 신청 없음이고 명단에서 이름으로 찾으라 한다', async () => {
  const { api, dialog, handlers } = await open()
  api.on('POST', CHECK_IN_PATH, () => json({ error: 'NOT_FOUND' }, 404))
  queue.push(qrTextOf(HASH))
  const card = await cardOf(dialog)
  expect(within(card).getByText('입장 불가 · 신청 없음')).toBeTruthy()
  expect(within(card).getByText('명단에서 이름으로 찾아 주세요.')).toBeTruthy()
  expect(within(card).getByRole('button', { name: '다음 사람' })).toBeTruthy()
  expect(handlers.onChecked).not.toHaveBeenCalled()
  expect(handlers.onLost).not.toHaveBeenCalled()
})

test('우리 QR이 아니면 안내만 보이고 서버로 보내지 않는다', async () => {
  const { api, dialog } = await open()
  queue.push('https://example.com', 'VADA:짧음')
  expect(await within(dialog).findByText('참가 신청 QR이 아니에요.')).toBeTruthy()
  await waitFor(() => expect(queue).toHaveLength(0))
  expect(api.calls.filter(call => call.method === 'POST')).toHaveLength(0)
})

test('429는 확인 실패와 문구에 [다시 찍기]를, 403은 학생회를 다시 읽게 하고 부모가 닫게 한다', async () => {
  const { api, dialog, handlers } = await open()
  api.on('POST', CHECK_IN_PATH, () => json({ error: 'TOO_MANY_REQUESTS' }, 429))
  queue.push(qrTextOf(HASH))
  const card = await cardOf(dialog)
  expect(within(card).getByText('확인 실패')).toBeTruthy()
  expect(within(card).getByText(REGISTRATION_STAFF_ERRORS.TOO_MANY_REQUESTS!)).toBeTruthy()
  api.on('POST', CHECK_IN_PATH, () => json({ error: 'FORBIDDEN' }, 403))
  queue.push(qrTextOf(HASH))
  fireEvent.click(within(card).getByRole('button', { name: '다시 찍기' }))
  await waitFor(() => expect(handlers.onForbidden).toHaveBeenCalled())
  expect(handlers.onLost).toHaveBeenCalledWith(PERMISSION_CHANGED)
})

test('카메라를 못 쓰면 이유와 이름으로 출석하라는 안내를 보이고, 다시 시도하면 켠다', async () => {
  vi.mocked(openCamera).mockRejectedValueOnce(new CameraError('denied'))
  render(
    <CheckInScanner
      councilId="c1"
      eventId={STAFF_EVENT_ID}
      onForbidden={vi.fn()}
      onLost={vi.fn()}
      onChecked={vi.fn()}
      onClose={vi.fn()}
    />,
  )
  const dialog = await screen.findByRole('dialog', { name: 'QR로 출석 확인' })
  expect(await within(dialog).findByText(/카메라를 쓸 수 없어요/)).toBeTruthy()
  expect(dialog.textContent).toContain('이름으로 찾아 [출석]')
  fireEvent.click(within(dialog).getByRole('button', { name: '다시 시도' }))
  expect(await within(dialog).findByText(READY)).toBeTruthy()
})

test('닫으면 카메라를 끈다', async () => {
  const { dialog, handlers } = await open()
  fireEvent.click(within(dialog).getByRole('button', { name: '닫기' }))
  expect(handlers.onClose).toHaveBeenCalled()
  cleanup()
  expect(track.stop).toHaveBeenCalled()
})

test('미납 QR: 참가비 받기 판정에서 [받고 입장]은 정액을 한 번만 기록하고 입장 가능으로 바뀐다. [다른 금액]은 없다', async () => {
  const { api, dialog, handlers } = await open()
  api.on('POST', CHECK_IN_PATH, () => json({ ...result(false), appliedFee: 5000 }))
  const pending = deferredResponse()
  api.on('POST', DEPOSIT_PATH, () => pending.promise)
  queue.push(qrTextOf(HASH))
  const card = await cardOf(dialog)
  expect(within(card).getByText('참가비 받기 · 5,000원')).toBeTruthy()
  expect(within(card).getByText('김새내')).toBeTruthy()
  expect(within(card).queryByRole('button', { name: '다른 금액' })).toBeNull()
  expect(within(card).queryByRole('button', { name: '다음 사람' })).toBeNull()
  expect(within(card).getByRole('button', { name: '입장 안 함' })).toBeTruthy()
  const receive = within(card).getByRole('button', { name: '5,000원 받고 입장' })
  fireEvent.click(receive)
  fireEvent.click(receive)
  expect(posts(api, DEPOSIT_PATH)).toHaveLength(1)
  expect(api.calls.at(-1)?.body).toEqual({ amount: 5000 })
  // 보내는 동안 다른 동작과 닫기를 막는다.
  expect(within(card).getByRole('button', { name: '입장 안 함' }).hasAttribute('disabled')).toBe(
    true,
  )
  expect(within(dialog).getByRole('button', { name: '닫기' }).hasAttribute('disabled')).toBe(true)
  const updated = applicantChange({
    deposit: { status: 'confirmed', amount: 5000 },
    actions: ['registration.cancel_check_in', 'deposit.cancel'],
  })
  pending.resolve(json({ deposit: updated.deposit, applicant: updated }, 201))
  expect(await within(card).findByText('입장 가능')).toBeTruthy()
  expect(within(card).getByText('입금 확인 5,000원')).toBeTruthy()
  expect(handlers.onChecked).toHaveBeenLastCalledWith(updated)
  await waitFor(() =>
    expect(document.activeElement).toBe(within(card).getByRole('button', { name: '다음 사람' })),
  )
  expect(within(card).queryByRole('button', { name: '5,000원 받고 입장' })).toBeNull()
  // 방금 잘못 누른 기록은 그 자리에서 사유와 함께 되돌린다.
  expect(within(card).getByRole('button', { name: '확인 취소' })).toBeTruthy()
})

test('[입장 안 함]은 이번 찍기가 남긴 출석 번호로 취소해 명단에 반영하고 [다음 사람]으로 넘어간다', async () => {
  const { api, dialog, handlers } = await open()
  api.on('POST', CHECK_IN_PATH, () => json({ ...result(false), appliedFee: 5000 }))
  const path = UNDO_PATH
  const cancelled = applicantChange({ attended: false, actions: ['registration.check_in'] })
  api.on('POST', path, () => json({ cancelled: true, applicant: cancelled }))
  queue.push(qrTextOf(HASH))
  const card = await cardOf(dialog)
  fireEvent.click(within(card).getByRole('button', { name: '입장 안 함' }))
  expect(await within(card).findByText('입장 안 함 · 출석 취소')).toBeTruthy()
  expect(posts(api, path)).toHaveLength(1)
  // 그사이 다른 운영진이 취소·재출석했으면 남의 출석을 취소하지 않도록 이번 출석의 번호를 보낸다.
  expect(posts(api, path)[0]?.body).toEqual({ attendanceId: ATTENDANCE_ID })
  expect(posts(api, DEPOSIT_PATH)).toHaveLength(0)
  expect(handlers.onChecked).toHaveBeenLastCalledWith(cancelled)
  expect(within(card).getByText('김새내')).toBeTruthy()
  await waitFor(() =>
    expect(document.activeElement).toBe(within(card).getByRole('button', { name: '다음 사람' })),
  )
  expect(within(card).getAllByRole('button')).toHaveLength(1)
})

test('그사이 다른 운영진이 출석을 바꿨으면 [입장 안 함]은 짧은 안내와 [다음 사람]만 보이고 명단을 바꾸지 않는다', async () => {
  const { api, dialog, handlers } = await open()
  api.on('POST', CHECK_IN_PATH, () => json({ ...result(false), appliedFee: 5000 }))
  api.on('POST', UNDO_PATH, () => json({ error: 'ATTENDANCE_CHANGED' }, 409))
  queue.push(qrTextOf(HASH))
  const card = await cardOf(dialog)
  fireEvent.click(within(card).getByRole('button', { name: '입장 안 함' }))
  expect(await within(card).findByText('다른 운영진이 이미 바꿨어요.')).toBeTruthy()
  expect(
    within(card)
      .getAllByRole('button')
      .map(button => button.textContent),
  ).toEqual(['다음 사람'])
  await waitFor(() =>
    expect(document.activeElement).toBe(within(card).getByRole('button', { name: '다음 사람' })),
  )
  expect(posts(api, UNDO_PATH)).toHaveLength(1)
  expect(handlers.onChecked).toHaveBeenCalledTimes(1)
  fireEvent.click(within(card).getByRole('button', { name: '다음 사람' }))
  expect(await within(dialog).findByText(READY)).toBeTruthy()
})

test('입금 확인 권한이 없으면 참가비 미납 판정과 재정부 확인만 보이고, 참가비를 모르면 금액을 추정해 받지 않는다', async () => {
  const { api, dialog } = await open()
  api.on('POST', CHECK_IN_PATH, () => json({ ...result(false), appliedFee: 5000, applicant: free }))
  queue.push(qrTextOf(HASH))
  const card = await cardOf(dialog)
  expect(within(card).getByText('참가비 미납 · 5,000원')).toBeTruthy()
  expect(within(card).getByText('재정부 확인 필요')).toBeTruthy()
  expect(within(card).queryByRole('button', { name: /받고 입장/ })).toBeNull()
  expect(within(card).queryByRole('button', { name: '입장 안 함' })).toBeNull()
  api.on('POST', CHECK_IN_PATH, () => json(result(false)))
  queue.push(qrTextOf(HASH))
  fireEvent.click(within(card).getByRole('button', { name: '다음 사람' }))
  expect(await within(dialog).findByText('참가비 확인 필요')).toBeTruthy()
  expect(within(dialog).queryByRole('button', { name: /받고 입장/ })).toBeNull()
})

test('이미 출석한 미납 QR: 입장 불가는 그대로 두고 [받기]로 참가비를 받을 수 있다. [입장 안 함]은 없다', async () => {
  const { api, dialog, handlers } = await open()
  api.on('POST', CHECK_IN_PATH, () =>
    json({ ...result(true), appliedFee: 5000, checkedInAt: FIRST_AT }),
  )
  const updated = applicantChange({
    deposit: { status: 'confirmed', amount: 5000 },
    actions: ['registration.cancel_check_in', 'deposit.cancel'],
  })
  api.on('POST', DEPOSIT_PATH, () => json({ deposit: updated.deposit, applicant: updated }, 201))
  queue.push(qrTextOf(HASH))
  const card = await cardOf(dialog)
  expect(within(card).getByText('입장 불가 · 이미 출석')).toBeTruthy()
  expect(within(card).getByText('김새내')).toBeTruthy()
  expect(within(card).getByText('학번 20260001')).toBeTruthy()
  expect(within(card).getByText(/^처음 출석 /)).toBeTruthy()
  expect(
    within(card)
      .getAllByRole('button')
      .map(button => button.textContent),
  ).toEqual(['5,000원 받기', '다음 사람'])
  // 주 버튼은 [받기] 하나다.
  expect(within(card).getByRole('button', { name: '다음 사람' }).className).toContain(
    'border-input',
  )
  const receive = within(card).getByRole('button', { name: '5,000원 받기' })
  fireEvent.click(receive)
  fireEvent.click(receive)
  expect(await within(card).findByText('입금 확인 5,000원')).toBeTruthy()
  expect(posts(api, DEPOSIT_PATH)).toHaveLength(1)
  expect(api.calls.at(-1)?.body).toEqual({ amount: 5000 })
  expect(handlers.onChecked).toHaveBeenLastCalledWith(updated)
  expect(within(card).getByText('입장 불가 · 이미 출석')).toBeTruthy()
  expect(within(card).queryByRole('button', { name: '5,000원 받기' })).toBeNull()
  expect(within(card).queryByRole('button', { name: '입장 안 함' })).toBeNull()
  await waitFor(() =>
    expect(document.activeElement).toBe(within(card).getByRole('button', { name: '다음 사람' })),
  )
})

test('이미 출석한 미납 QR을 입금 확인 권한 없이 찍으면 미납 한 줄과 [다음 사람]만 보인다', async () => {
  const { api, dialog } = await open()
  api.on('POST', CHECK_IN_PATH, () =>
    json({ ...result(true), appliedFee: 5000, applicant: free, checkedInAt: FIRST_AT }),
  )
  queue.push(qrTextOf(HASH))
  const card = await cardOf(dialog)
  expect(within(card).getByText('입장 불가 · 이미 출석')).toBeTruthy()
  expect(within(card).getByText('참가비 미납 · 재정부 확인 필요')).toBeTruthy()
  expect(
    within(card)
      .getAllByRole('button')
      .map(button => button.textContent),
  ).toEqual(['다음 사람'])
})

test('현장 받기 실패는 카드에 남고 다시 누를 수 있으며, 권한 상실은 부모에게 알린다', async () => {
  const { api, dialog, handlers } = await open()
  api.on('POST', CHECK_IN_PATH, () => json({ ...result(false), appliedFee: 5000 }))
  api.on('POST', DEPOSIT_PATH, () => json({ error: 'TOO_MANY_REQUESTS' }, 429))
  queue.push(qrTextOf(HASH))
  const card = await cardOf(dialog)
  const receive = within(card).getByRole('button', { name: '5,000원 받고 입장' })
  fireEvent.click(receive)
  expect(await within(card).findByText(REGISTRATION_STAFF_ERRORS.TOO_MANY_REQUESTS!)).toBeTruthy()
  expect(within(card).getByText('참가비 받기 · 5,000원')).toBeTruthy()
  api.on('POST', DEPOSIT_PATH, () => json({ error: 'FORBIDDEN' }, 403))
  fireEvent.click(receive)
  await waitFor(() => expect(handlers.onForbidden).toHaveBeenCalled())
  expect(handlers.onLost).toHaveBeenCalledWith(PERMISSION_CHANGED)
})

test('방금 받은 입금을 사유와 함께 되돌리면 다시 참가비 받기 판정이다', async () => {
  const { api, dialog, handlers } = await open()
  api.on('POST', CHECK_IN_PATH, () => json({ ...result(false), appliedFee: 5000 }))
  const paid = applicantChange({
    deposit: { status: 'confirmed', amount: 5000 },
    actions: ['registration.cancel_check_in', 'deposit.cancel'],
  })
  api.on('POST', DEPOSIT_PATH, () => json({ deposit: paid.deposit, applicant: paid }, 201))
  const path = `${DEPOSIT_PATH}/cancel`
  const updated = applicantChange()
  api.on('POST', path, () => json({ deposit: updated.deposit, applicant: updated }))
  queue.push(qrTextOf(HASH))
  const card = await cardOf(dialog)
  fireEvent.click(within(card).getByRole('button', { name: '5,000원 받고 입장' }))
  fireEvent.click(await within(card).findByRole('button', { name: '확인 취소' }))
  const undo = await screen.findByRole('dialog', { name: '김새내님의 입금 확인을 취소할까요?' })
  fireEvent.change(within(undo).getByLabelText('취소 사유'), {
    target: { value: '다른 사람의 입금을 잘못 확인' },
  })
  fireEvent.click(within(undo).getByRole('button', { name: '입금 확인 취소' }))
  expect(await within(card).findByText('참가비 받기 · 5,000원')).toBeTruthy()
  expect(api.calls.at(-1)?.body).toEqual({ reason: '다른 사람의 입금을 잘못 확인' })
  expect(handlers.onChecked).toHaveBeenLastCalledWith(updated)
  expect(within(card).getByRole('button', { name: '5,000원 받고 입장' })).toBeTruthy()
})

test('다른 운영진이 먼저 입금을 확인했으면 새로 읽어 입장 가능과 기록액을 보이고 중복 기록하지 않는다', async () => {
  const { api, dialog } = await open()
  api.on('POST', CHECK_IN_PATH, () => json({ ...result(false), appliedFee: 5000 }))
  api.on('POST', DEPOSIT_PATH, () => json({ error: 'DEPOSIT_EXISTS' }, 409))
  queue.push(qrTextOf(HASH))
  const card = await cardOf(dialog)
  fireEvent.click(within(card).getByRole('button', { name: '5,000원 받고 입장' }))
  const reread = await within(card).findByRole('button', { name: '새로 읽기' })
  const paid = applicantChange({
    deposit: { status: 'confirmed', amount: 4000 },
    actions: ['deposit.cancel'],
  })
  // 새로 읽기는 출석을 다시 보내 already가 오지만, 이번 찍기가 남긴 출석이라 이미 출석으로 부르지 않는다.
  api.on('POST', CHECK_IN_PATH, () =>
    json({ ...result(true), appliedFee: 5000, applicant: paid, checkedInAt: FIRST_AT }),
  )
  fireEvent.click(reread)
  expect(await within(dialog).findByText('입장 가능')).toBeTruthy()
  expect(within(dialog).getByText('입금 확인 4,000원')).toBeTruthy()
  expect(within(dialog).queryByText('입장 불가 · 이미 출석')).toBeNull()
  expect(within(dialog).queryByRole('button', { name: '5,000원 받고 입장' })).toBeNull()
  expect(posts(api, DEPOSIT_PATH)).toHaveLength(1)
})

test('새로 읽기 사이에 다른 운영진이 취소·재출석했으면 그 출석은 이번 찍기 것이 아니라 이미 출석이고 [입장 안 함]이 없다', async () => {
  const { api, dialog } = await open()
  api.on('POST', CHECK_IN_PATH, () => json({ ...result(false), appliedFee: 5000 }))
  api.on('POST', DEPOSIT_PATH, () => json({ error: 'EVENT_COMPLETED' }, 409))
  queue.push(qrTextOf(HASH))
  const card = await cardOf(dialog)
  fireEvent.click(within(card).getByRole('button', { name: '5,000원 받고 입장' }))
  const reread = await within(card).findByRole('button', { name: '새로 읽기' })
  api.on('POST', CHECK_IN_PATH, () =>
    json({
      ...result(true),
      attendanceId: '00000000-0000-4000-8000-0000000000b2',
      appliedFee: 5000,
      checkedInAt: FIRST_AT,
    }),
  )
  fireEvent.click(reread)
  expect(await within(dialog).findByText('입장 불가 · 이미 출석')).toBeTruthy()
  expect(within(dialog).queryByRole('button', { name: '입장 안 함' })).toBeNull()
})
