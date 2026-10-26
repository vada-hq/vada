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
const result = (already: boolean) => ({
  registrationId: REGISTRATION_ID,
  applicant: applicantChange(),
  name: '김새내',
  studentId: '20260001',
  already,
})

test('QR을 찍으면 해시(소문자)로 출석을 보내 이름·학번을 크게 보이고, [다음] 전에는 다시 읽지 않는다', async () => {
  const { api, dialog, handlers } = await open()
  api.on('POST', CHECK_IN_PATH, () => json(result(false)))
  queue.push(qrTextOf(HASH))
  expect(await within(dialog).findByText('출석을 확인했어요')).toBeTruthy()
  expect(within(dialog).getByText('김새내').className).toContain('text-lg')
  expect(within(dialog).getByText('학번 20260001')).toBeTruthy()
  expect(api.calls.at(-1)).toMatchObject({
    method: 'POST',
    path: CHECK_IN_PATH,
    body: { tokenHash: HASH },
  })
  expect(handlers.onChecked).toHaveBeenCalledWith(applicantChange())
  // 결과는 카메라 화면 위에 겹친다
  const view = within(dialog).getByLabelText('카메라 화면').parentElement as HTMLElement
  expect(view.contains(within(dialog).getByRole('status', { name: '찍은 결과' }))).toBe(true)
  const reads = reader.read.mock.calls.length
  await new Promise(resolve => setTimeout(resolve, 700))
  expect(reader.read.mock.calls.length).toBe(reads)
  // 같은 QR을 다시 찍으면 이미 출석이다(오류가 아니다)
  api.on('POST', CHECK_IN_PATH, () => json(result(true)))
  queue.push(qrTextOf(HASH))
  fireEvent.click(within(dialog).getByRole('button', { name: '다음' }))
  expect(await within(dialog).findByText('이미 출석했어요')).toBeTruthy()
  expect(api.calls.filter(call => call.method === 'POST')).toHaveLength(2)
})

test('그 행사 신청이 아니면(404) 찾을 수 없다고 알리고 이름으로 찾으라 한다', async () => {
  const { api, dialog, handlers } = await open()
  api.on('POST', CHECK_IN_PATH, () => json({ error: 'NOT_FOUND' }, 404))
  queue.push(qrTextOf(HASH))
  expect(await within(dialog).findByText('이 행사 신청에서 찾을 수 없어요')).toBeTruthy()
  expect(dialog.textContent).toContain('이름으로 찾아')
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

test('429는 문구를, 403은 학생회를 다시 읽게 하고 부모가 닫게 한다', async () => {
  const { api, dialog, handlers } = await open()
  api.on('POST', CHECK_IN_PATH, () => json({ error: 'TOO_MANY_REQUESTS' }, 429))
  queue.push(qrTextOf(HASH))
  expect(await within(dialog).findByText(REGISTRATION_STAFF_ERRORS.TOO_MANY_REQUESTS!)).toBeTruthy()
  api.on('POST', CHECK_IN_PATH, () => json({ error: 'FORBIDDEN' }, 403))
  queue.push(qrTextOf(HASH))
  fireEvent.click(within(dialog).getByRole('button', { name: '다음' }))
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
  fireEvent.click(within(dialog).getAllByRole('button', { name: '닫기' })[0]!)
  expect(handlers.onClose).toHaveBeenCalled()
  cleanup()
  expect(track.stop).toHaveBeenCalled()
})

test('미납 QR: 참가비를 보이고 정액을 한 번만 기록한 뒤 카드와 명단을 갱신한다', async () => {
  const { api, dialog, handlers } = await open()
  api.on('POST', CHECK_IN_PATH, () => json({ ...result(false), appliedFee: 5000 }))
  const pending = deferredResponse()
  const path = `/api/organizations/c1/registrations/${REGISTRATION_ID}/deposit`
  api.on('POST', path, () => pending.promise)
  queue.push(qrTextOf(HASH))
  const card = await within(dialog).findByRole('status', { name: '찍은 결과' })
  expect(await within(card).findByText('입금 확인 전')).toBeTruthy()
  const confirm = within(card).getByRole('button', { name: '5,000원 입금 확인' })
  fireEvent.click(confirm)
  fireEvent.click(confirm)
  expect(api.calls.filter(call => call.path === path)).toHaveLength(1)
  expect(api.calls.at(-1)?.body).toEqual({ amount: 5000 })
  expect(within(card).getByRole('button', { name: '다음' }).hasAttribute('disabled')).toBe(true)
  expect(
    within(dialog)
      .getAllByRole('button', { name: '닫기' })
      .every(b => b.hasAttribute('disabled')),
  ).toBe(true)
  const updated = applicantChange({
    deposit: { status: 'confirmed', amount: 5000 },
    actions: ['registration.cancel_check_in', 'deposit.cancel'],
  })
  pending.resolve(json({ deposit: updated.deposit, applicant: updated }, 201))
  expect(await within(card).findByText('입금 확인 5,000원')).toBeTruthy()
  expect(handlers.onChecked).toHaveBeenLastCalledWith(updated)
  expect(document.activeElement).toBe(within(card).getByRole('button', { name: '다음' }))
  expect(within(card).queryByRole('button', { name: '5,000원 입금 확인' })).toBeNull()
  expect(within(card).getByRole('button', { name: '확인 취소' })).toBeTruthy()
})

test('이미 출석한 미납 QR도 다른 금액을 기록하고, 권한 없는 사람은 상태만 본다', async () => {
  const { api, dialog } = await open()
  api.on('POST', CHECK_IN_PATH, () => json({ ...result(true), appliedFee: 5000 }))
  const path = `/api/organizations/c1/registrations/${REGISTRATION_ID}/deposit`
  const updated = applicantChange({
    deposit: { status: 'confirmed', amount: 4000 },
    actions: ['deposit.cancel'],
  })
  api.on('POST', path, () => json({ deposit: updated.deposit, applicant: updated }, 201))
  queue.push(qrTextOf(HASH))
  const card = await within(dialog).findByRole('status', { name: '찍은 결과' })
  fireEvent.click(await within(card).findByRole('button', { name: '다른 금액' }))
  const amountDialog = await screen.findByRole('dialog', { name: '김새내님의 입금을 확인할까요?' })
  const input = within(amountDialog).getByLabelText('입금 금액(원)', { exact: false })
  fireEvent.change(input, { target: { value: '4000' } })
  fireEvent.click(within(amountDialog).getByRole('button', { name: '입금 확인' }))
  expect(await within(card).findByText('입금 확인 4,000원')).toBeTruthy()
  expect(api.calls.at(-1)?.body).toEqual({ amount: 4000 })
  fireEvent.click(within(card).getByRole('button', { name: '다음' }))
  api.on('POST', CHECK_IN_PATH, () =>
    json({
      ...result(false),
      appliedFee: 5000,
      applicant: applicantChange({ actions: ['registration.cancel_check_in'] }),
    }),
  )
  queue.push(qrTextOf(HASH))
  const readonly = await within(dialog).findByText('입금 확인 전')
  expect(readonly).toBeTruthy()
  expect(within(dialog).queryByRole('button', { name: '5,000원 입금 확인' })).toBeNull()
})

test('무료와 참가비 미확인은 다르고, 무료/미확인 응답으로 금액을 추정해 확인하지 않는다', async () => {
  const { api, dialog } = await open()
  api.on('POST', CHECK_IN_PATH, () =>
    json({
      ...result(false),
      appliedFee: 0,
      applicant: applicantChange({ actions: ['registration.cancel_check_in'] }),
    }),
  )
  queue.push(qrTextOf(HASH))
  expect(await within(dialog).findByText('참가비 없음')).toBeTruthy()
  fireEvent.click(within(dialog).getByRole('button', { name: '다음' }))
  api.on('POST', CHECK_IN_PATH, () => json(result(false)))
  queue.push(qrTextOf(HASH))
  expect(await within(dialog).findByText('참가비 확인 필요')).toBeTruthy()
  expect(within(dialog).queryByRole('button', { name: /원 입금 확인/ })).toBeNull()
})

test('현장 확인 실패는 카드에 남고 재시도할 수 있으며, 권한 상실은 부모에게 알린다', async () => {
  const { api, dialog, handlers } = await open()
  api.on('POST', CHECK_IN_PATH, () => json({ ...result(false), appliedFee: 5000 }))
  const path = `/api/organizations/c1/registrations/${REGISTRATION_ID}/deposit`
  api.on('POST', path, () => json({ error: 'TOO_MANY_REQUESTS' }, 429))
  queue.push(qrTextOf(HASH))
  const confirm = await within(dialog).findByRole('button', { name: '5,000원 입금 확인' })
  fireEvent.click(confirm)
  expect(await within(dialog).findByText(REGISTRATION_STAFF_ERRORS.TOO_MANY_REQUESTS!)).toBeTruthy()
  expect(within(dialog).getByText('입금 확인 전')).toBeTruthy()
  api.on('POST', path, () => json({ error: 'FORBIDDEN' }, 403))
  fireEvent.click(confirm)
  await waitFor(() => expect(handlers.onForbidden).toHaveBeenCalled())
  expect(handlers.onLost).toHaveBeenCalledWith(PERMISSION_CHANGED)
})

test('스캔 결과의 잘못된 입금 확인을 사유와 함께 되돌리고 다시 확인할 수 있다', async () => {
  const { api, dialog, handlers } = await open()
  const paid = applicantChange({
    deposit: { status: 'confirmed', amount: 5000 },
    actions: ['registration.cancel_check_in', 'deposit.cancel'],
  })
  api.on('POST', CHECK_IN_PATH, () => json({ ...result(true), appliedFee: 5000, applicant: paid }))
  const path = `/api/organizations/c1/registrations/${REGISTRATION_ID}/deposit/cancel`
  const updated = applicantChange()
  api.on('POST', path, () => json({ deposit: updated.deposit, applicant: updated }))
  queue.push(qrTextOf(HASH))
  fireEvent.click(await within(dialog).findByRole('button', { name: '확인 취소' }))
  const undo = await screen.findByRole('dialog', { name: '김새내님의 입금 확인을 취소할까요?' })
  fireEvent.change(within(undo).getByLabelText('취소 사유'), {
    target: { value: '다른 사람의 입금을 잘못 확인' },
  })
  fireEvent.click(within(undo).getByRole('button', { name: '입금 확인 취소' }))
  expect(await within(dialog).findByText('입금 확인 전')).toBeTruthy()
  expect(api.calls.at(-1)?.body).toEqual({ reason: '다른 사람의 입금을 잘못 확인' })
  expect(handlers.onChecked).toHaveBeenLastCalledWith(updated)
  expect(within(dialog).getByRole('button', { name: '5,000원 입금 확인' })).toBeTruthy()
})

test('다른 운영진이 먼저 입금을 확인했으면 새로 읽어 기록액을 표시하고 중복 기록하지 않는다', async () => {
  const { api, dialog } = await open()
  api.on('POST', CHECK_IN_PATH, () => json({ ...result(false), appliedFee: 5000 }))
  const path = `/api/organizations/c1/registrations/${REGISTRATION_ID}/deposit`
  api.on('POST', path, () => json({ error: 'DEPOSIT_EXISTS' }, 409))
  queue.push(qrTextOf(HASH))
  fireEvent.click(await within(dialog).findByRole('button', { name: '5,000원 입금 확인' }))
  const reread = await within(dialog).findByRole('button', { name: '새로 읽기' })
  const paid = applicantChange({
    deposit: { status: 'confirmed', amount: 4000 },
    actions: ['deposit.cancel'],
  })
  api.on('POST', CHECK_IN_PATH, () => json({ ...result(true), appliedFee: 5000, applicant: paid }))
  fireEvent.click(reread)
  expect(await within(dialog).findByText('입금 확인 4,000원')).toBeTruthy()
  expect(within(dialog).queryByRole('button', { name: '5,000원 입금 확인' })).toBeNull()
  expect(api.calls.filter(call => call.path === path)).toHaveLength(1)
})
