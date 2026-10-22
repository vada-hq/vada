// @vitest-environment jsdom
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { qrTextOf } from '@vada/contracts'
import { json, mockApi } from '@/test-support/mock-api'
import {
  CHECK_IN_PATH,
  REGISTRATION_ID,
  STAFF_EVENT_ID,
} from '@/test-support/staff-registration-fixtures'
import { PERMISSION_CHANGED, REGISTRATION_STAFF_ERRORS } from '@/lib/messages'
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
  expect(handlers.onChecked).toHaveBeenCalledWith(REGISTRATION_ID)
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
