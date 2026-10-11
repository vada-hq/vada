// @vitest-environment jsdom
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { checkInQrText, type CheckInScanResponse, type EventSummary, type RegistrationResponse } from '@vada/contracts'
import { deferredResponse, json, mockApi } from '../test-support/mock-api'
import { event as eventFixture } from '../test-support/workflow-fixtures'
import { CameraError, openCamera } from './camera'
import { scanInterval } from './CheckInScanner'
import { loadQrReader, type QrReader } from './qr-reader'
import RegistrationPanel from './RegistrationPanel'
import { checkedBy, entry, feeEntries, feeForm, feeResponse, paidBy, registrationForm, registrationResponse } from './registration-fixtures'
import { useRegistration } from './useRegistration'

// 카메라와 판독기는 가짜다. 판독기는 줄(queue)에 넣은 글자를 한 번에 하나씩 읽는다.
vi.mock('./camera', async importActual => ({ ...await importActual<typeof import('./camera')>(), openCamera: vi.fn() }))
vi.mock('./qr-reader', () => ({ loadQrReader: vi.fn() }))

const base = '/api/organizations/o/events/e/registration'
const code = '0123456789abcdef'.repeat(4)
let queue: string[] = []
let reader: QrReader & { read: ReturnType<typeof vi.fn> }
function fakeStream() {
  const track = { stop: vi.fn() }
  return { stream: { getTracks: () => [track] } as unknown as MediaStream, track }
}
beforeEach(() => {
  vi.resetAllMocks()
  queue = []
  reader = { read: vi.fn(async () => queue.shift() ?? null) }
  vi.mocked(loadQrReader).mockResolvedValue(reader)
  vi.mocked(openCamera).mockImplementation(async () => fakeStream().stream)
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined)
})
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks() })

const timed = (): EventSummary => ({ ...eventFixture(), startsAt: '2026-08-20T10:00', endsAt: '2026-08-20T18:00', place: '체육관' })
function Harness() {
  const state = useRegistration('o', 'e', true)
  return <RegistrationPanel organizationId="o" event={timed()} state={state} onEventChange={() => {}} />
}
const scanned = (response: RegistrationResponse, registrationId: string, already = false): CheckInScanResponse =>
  ({ ...response, checkIn: { registrationId, already } })
// 이수강(r2)이 참석한 명단
const lee = (overrides: Partial<RegistrationResponse> = {}) => registrationResponse({ form: registrationForm({ checkedIn: 1 }),
  registrations: [entry('r1', '김바다', '2022123456'), entry('r2', '이수강', '2023222222', null, { checkedIn: checkedBy })], ...overrides })
const ready = '참가자의 QR을 네모 안에 맞춰 주세요.'
const closeButton = (dialog: HTMLElement) => within(dialog).getAllByRole('button', { name: '닫기' })[0]!
async function open(body: RegistrationResponse = registrationResponse()) {
  const api = mockApi()
  api.on('GET', base, () => json(body))
  render(<Harness />)
  fireEvent.click(await screen.findByRole('button', { name: 'QR로 참석 확인' }))
  const dialog = await screen.findByRole('dialog', { name: 'QR로 참석 확인' })
  return { api, dialog }
}

test('QR을 찍으면 바로 참석으로 남기고, [다음]을 누르기 전에는 다시 읽지 않으며, 같은 QR을 다시 찍으면 이미 참석이라고 알린다', async () => {
  const { api, dialog } = await open()
  api.on('POST', `${base}/check-in`, () => json(scanned(lee(), 'r2')))
  await within(dialog).findByText(ready)
  queue.push(checkInQrText(code))
  expect(await within(dialog).findByText('참석을 확인했어요')).toBeTruthy()
  expect(within(dialog).getByText('이수강')).toBeTruthy()
  expect(within(dialog).getByText('학번 2023222222')).toBeTruthy()
  expect(api.calls.at(-1)).toMatchObject({ method: 'POST', path: `${base}/check-in`, body: { code } })
  const reads = reader.read.mock.calls.length
  await new Promise(resolve => setTimeout(resolve, scanInterval * 3))
  expect(reader.read.mock.calls.length).toBe(reads)
  api.on('POST', `${base}/check-in`, () => json(scanned(lee(), 'r2', true)))
  queue.push(checkInQrText(code))
  fireEvent.click(within(dialog).getByRole('button', { name: '다음' }))
  expect(await within(dialog).findByText('이미 참석했어요')).toBeTruthy()
  expect(within(dialog).getByText('참석 확인 · 8월 20일 (목) 오전 10:02 · 기획')).toBeTruthy()
  expect(api.calls.filter(call => call.method === 'POST')).toHaveLength(2)
})

test('이 행사 신청에서 찾을 수 없으면 이름으로 찾으라고 알리고, 명단은 다시 부르지 않는다', async () => {
  const { api, dialog } = await open()
  api.on('POST', `${base}/check-in`, () => json({ error: 'NOT_FOUND' }, 404))
  await within(dialog).findByText(ready)
  queue.push(checkInQrText(code))
  expect(await within(dialog).findByText('이 행사 신청에서 찾을 수 없어요')).toBeTruthy()
  expect(within(dialog).getByText('다른 행사의 QR이거나 취소한 신청일 수 있어요. 명단에서 이름으로 찾아 주세요.')).toBeTruthy()
  expect(api.calls.filter(call => call.method === 'GET')).toHaveLength(1)
})

test('연결하지 못하면 다시 찍으라고 하고, 권한이 없으면 그 까닭을 알린다', async () => {
  const { api, dialog } = await open()
  api.on('POST', `${base}/check-in`, () => { throw new Error('offline') })
  await within(dialog).findByText(ready)
  queue.push(checkInQrText(code))
  expect(await within(dialog).findByText('연결하지 못했어요')).toBeTruthy()
  expect(within(dialog).getByText('다시 찍어 주세요.')).toBeTruthy()
  api.on('POST', `${base}/check-in`, () => json({ error: 'FORBIDDEN' }, 403))
  queue.push(checkInQrText(code))
  fireEvent.click(within(dialog).getByRole('button', { name: '다음' }))
  expect(await within(dialog).findByText('참석을 확인하지 못했어요')).toBeTruthy()
  expect(within(dialog).getByText('부서가 있는 구성원만 참가 신청을 관리할 수 있어요.')).toBeTruthy()
})

test('참가 신청 QR이 아니면 보내지 않고 잠깐 알린 뒤 계속 읽는다', async () => {
  const { api, dialog } = await open()
  await within(dialog).findByText(ready)
  queue.push('https://example.com')
  expect(await within(dialog).findByText('참가 신청 QR이 아니에요.')).toBeTruthy()
  const reads = reader.read.mock.calls.length
  await waitFor(() => expect(reader.read.mock.calls.length).toBeGreaterThan(reads))
  expect(api.calls.filter(call => call.method === 'POST')).toHaveLength(0)
})

test('결과 카드에서 입금을 확인하고, 잘못 찍었으면 참석 확인을 취소한다', async () => {
  const { api, dialog } = await open(feeResponse())
  api.on('POST', `${base}/check-in`, () => json(scanned(feeResponse({ registrations: feeEntries({ r3: { checkedIn: checkedBy } }) }), 'r3')))
  await within(dialog).findByText(ready)
  queue.push(checkInQrText(code))
  expect(await within(dialog).findByText('참석을 확인했어요')).toBeTruthy()
  expect(within(dialog).getByText('7,000원 · 입금 전')).toBeTruthy()
  api.on('POST', `${base}/entries/r3/payment`, () => json(feeResponse({ form: feeForm({ payments: { count: 2, total: 14000 } }),
    registrations: feeEntries({ r3: { checkedIn: checkedBy, paid: { ...paidBy, at: '2026-08-20T10:03' } } }) })))
  fireEvent.click(within(dialog).getByRole('button', { name: '입금 확인' }))
  expect(await within(dialog).findByText('7,000원 · 입금 확인')).toBeTruthy()
  expect(within(dialog).queryByRole('button', { name: '입금 확인' })).toBeNull()
  api.on('POST', `${base}/entries/r3/check-in/cancel`, () => json(feeResponse()))
  fireEvent.click(within(dialog).getByRole('button', { name: '참석 확인 취소' }))
  expect(await within(dialog).findByText('참석 확인을 취소했어요')).toBeTruthy()
  expect(api.calls.at(-1)).toMatchObject({ method: 'POST', path: `${base}/entries/r3/check-in/cancel`, body: {} })
})

test('정산한 행사는 결과 카드에 입금 확인이 없다', async () => {
  const settled = feeResponse({ settled: true })
  const { api, dialog } = await open(settled)
  api.on('POST', `${base}/check-in`, () => json(scanned(feeResponse({ settled: true, registrations: feeEntries({ r3: { checkedIn: checkedBy } }) }), 'r3')))
  await within(dialog).findByText(ready)
  queue.push(checkInQrText(code))
  expect(await within(dialog).findByText('참석을 확인했어요')).toBeTruthy()
  expect(within(dialog).getByText('7,000원 · 입금 전')).toBeTruthy()
  expect(within(dialog).queryByRole('button', { name: '입금 확인' })).toBeNull()
})

test('카메라 권한이 없으면 까닭과 다른 방법을 알리고, 다시 시도한다', async () => {
  vi.mocked(openCamera).mockRejectedValueOnce(new CameraError('denied'))
  const { dialog } = await open()
  expect(await within(dialog).findByText('카메라를 쓸 수 없어요. 브라우저 설정에서 이 사이트의 카메라 사용을 허용해 주세요.')).toBeTruthy()
  expect(within(dialog).getByText('QR을 찍을 수 없으면 명단에서 이름으로 찾아 [참석]을 눌러 주세요.')).toBeTruthy()
  expect(loadQrReader).not.toHaveBeenCalled()
  fireEvent.click(within(dialog).getByRole('button', { name: '다시 시도' }))
  expect(await within(dialog).findByText(ready)).toBeTruthy()
  expect(openCamera).toHaveBeenCalledTimes(2)
})

test('카메라를 지원하지 않거나 판독기를 받지 못하면 알린다', async () => {
  vi.mocked(openCamera).mockRejectedValueOnce(new CameraError('unsupported'))
  const first = await open()
  expect(await within(first.dialog).findByText('이 브라우저에서는 카메라를 쓸 수 없어요.')).toBeTruthy()
  cleanup()
  vi.mocked(loadQrReader).mockRejectedValueOnce(new Error('wasm'))
  const second = await open()
  expect(await within(second.dialog).findByText('QR 판독기를 불러오지 못했어요.')).toBeTruthy()
})

test('닫으면 카메라를 끈다', async () => {
  const { stream, track } = fakeStream()
  vi.mocked(openCamera).mockResolvedValue(stream)
  const { dialog } = await open()
  await within(dialog).findByText(ready)
  fireEvent.click(closeButton(dialog))
  await waitFor(() => expect(screen.queryByRole('dialog', { name: 'QR로 참석 확인' })).toBeNull())
  expect(track.stop).toHaveBeenCalled()
  // 닫은 뒤에는 판독도 멈춘다.
  const reads = reader.read.mock.calls.length
  await new Promise(resolve => setTimeout(resolve, scanInterval * 3))
  expect(reader.read.mock.calls.length).toBe(reads)
})

test('응답을 기다리는 사이 닫으면 결과를 그리지 않고 카메라를 다시 켜지 않는다', async () => {
  const pending = deferredResponse()
  const { api, dialog } = await open()
  api.on('POST', `${base}/check-in`, () => pending.promise)
  await within(dialog).findByText(ready)
  queue.push(checkInQrText(code))
  await waitFor(() => expect(api.calls.some(call => call.method === 'POST')).toBe(true))
  fireEvent.click(closeButton(dialog))
  await waitFor(() => expect(screen.queryByRole('dialog', { name: 'QR로 참석 확인' })).toBeNull())
  await act(async () => { pending.resolve(json(scanned(lee(), 'r2'))) })
  await new Promise(resolve => setTimeout(resolve, scanInterval * 2))
  expect(screen.queryByText('참석을 확인했어요')).toBeNull()
  expect(openCamera).toHaveBeenCalledTimes(1)
})

test('화면이 숨으면 카메라를 끄고, 다시 보이면 켠다', async () => {
  const first = fakeStream()
  const second = fakeStream()
  vi.mocked(openCamera).mockResolvedValueOnce(first.stream).mockResolvedValueOnce(second.stream)
  const { dialog } = await open()
  await within(dialog).findByText(ready)
  let state: DocumentVisibilityState = 'hidden'
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => state })
  try {
    act(() => { document.dispatchEvent(new Event('visibilitychange')) })
    await waitFor(() => expect(first.track.stop).toHaveBeenCalled())
    state = 'visible'
    act(() => { document.dispatchEvent(new Event('visibilitychange')) })
    await waitFor(() => expect(openCamera).toHaveBeenCalledTimes(2))
    expect(await within(dialog).findByText(ready)).toBeTruthy()
  } finally {
    delete (document as { visibilityState?: unknown }).visibilityState
  }
})
