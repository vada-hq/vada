// @vitest-environment jsdom
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { qrTextOf, type RegistrationAction } from '@vada/contracts'
import { councilView } from '@/test-support/council-fixtures'
import { json, mockApi } from '@/test-support/mock-api'
import {
  APPLICANTS_PATH,
  CHECK_IN_PATH,
  FORMS_PATH,
  REGISTRATION_ID,
  STAFF_EVENT_ID,
  applicant,
  staffForm,
} from '@/test-support/staff-registration-fixtures'
import { PERMISSION_CHANGED } from '@/lib/messages'
import { REGISTRATION_STAFF_LOST } from '@/lib/registration-messages'
import { openCamera } from './camera'
import { loadQrReader, type QrReader } from './qr-reader'
import { RegistrationTab } from './RegistrationTab'

vi.mock('./camera', async importActual => ({
  ...(await importActual<typeof import('./camera')>()),
  openCamera: vi.fn(),
}))
vi.mock('./qr-reader', () => ({ loadQrReader: vi.fn() }))

const ROW = `/api/organizations/c1/registrations/${REGISTRATION_ID}`
const MANAGE: RegistrationAction[] = ['registration.manage', 'registration.view_applicants']
let queue: string[] = []

beforeEach(() => {
  queue = []
  const reader: QrReader = { read: vi.fn(async () => queue.shift() ?? null) }
  vi.mocked(loadQrReader).mockResolvedValue(reader)
  vi.mocked(openCamera).mockImplementation(
    async () => ({ getTracks: () => [{ stop: vi.fn() }] }) as unknown as MediaStream,
  )
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined)
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

// 서버 값을 시험이 바꿀 수 있게 상태로 둔다.
function setup() {
  const server = {
    forms: [staffForm()],
    actions: MANAGE,
    applicants: [applicant()],
  }
  const api = mockApi()
  api.on('GET', FORMS_PATH, () =>
    json({ forms: server.forms, truncated: false, actions: server.actions }),
  )
  api.on('GET', APPLICANTS_PATH, () => json({ applicants: server.applicants, truncated: false }))
  api.on('GET', '/api/organizations/c1/accounts', () => json({ accounts: [], truncated: false }))
  const handlers = { onForbidden: vi.fn(), onLost: vi.fn() }
  render(
    <RegistrationTab
      view={councilView('c1', { memberId: 'm9' })}
      eventId={STAFF_EVENT_ID}
      {...handlers}
    />,
  )
  return { api, server, handlers }
}

async function openList() {
  fireEvent.click(await screen.findByRole('button', { name: '링크와 신청자' }))
  fireEvent.click(await screen.findByRole('button', { name: '신청자 보기' }))
  return (await screen.findByText('김새내')).closest('li') as HTMLElement
}
// 15초 읽기를 기다리지 않고 화면이 다시 보이는 것으로 바로 읽게 한다.
const pollNow = () => act(async () => void document.dispatchEvent(new Event('visibilitychange')))

test('신청 취소 확인 창에서 404면 창을 닫고 이유를 보이고 그 행을 뺀다', async () => {
  const { api } = setup()
  api.on('POST', `${ROW}/cancel`, () => json({ error: 'NOT_FOUND' }, 404))
  const row = await openList()
  fireEvent.click(within(row).getByRole('button', { name: '신청 취소' }))
  const dialog = await screen.findByRole('dialog')
  fireEvent.click(within(dialog).getByRole('button', { name: '신청 취소' }))
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  expect(screen.getByText(REGISTRATION_STAFF_LOST)).toBeTruthy()
  expect(screen.queryByText('김새내')).toBeNull()
})

test('신청 취소 확인 창에서 403이면 창을 닫고 학생회를 다시 읽게 하고 이유를 보인다', async () => {
  const { api, handlers } = setup()
  api.on('POST', `${ROW}/cancel`, () => json({ error: 'FORBIDDEN' }, 403))
  const row = await openList()
  fireEvent.click(within(row).getByRole('button', { name: '신청 취소' }))
  fireEvent.click(
    within(await screen.findByRole('dialog')).getByRole('button', { name: '신청 취소' }),
  )
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  expect(handlers.onForbidden).toHaveBeenCalled()
  expect(screen.getByText(PERMISSION_CHANGED)).toBeTruthy()
})

test('[출석]이 404면 이유를 보이고 그 행을 뺀다', async () => {
  const { api } = setup()
  api.on('POST', `${ROW}/attendance`, () => json({ error: 'NOT_FOUND' }, 404))
  const row = await openList()
  fireEvent.click(within(row).getByRole('button', { name: '출석' }))
  await waitFor(() => expect(screen.queryByText('김새내')).toBeNull())
  expect(screen.getByText(REGISTRATION_STAFF_LOST)).toBeTruthy()
})

test('목록을 서버에서 새로 읽으면 이 화면에서 바꾼 출석보다 서버 값이 앞선다', async () => {
  const { api, server } = setup()
  api.on('POST', `${ROW}/attendance`, () =>
    json({ registrationId: REGISTRATION_ID, name: '김새내', studentId: null, already: false }),
  )
  const row = await openList()
  fireEvent.click(within(row).getByRole('button', { name: '출석' }))
  await within(row).findByRole('button', { name: '출석 취소' })
  // 다른 운영진이 출석을 취소했다
  server.applicants = [applicant({ attended: false })]
  fireEvent.click(screen.getByRole('button', { name: '새로 읽기' }))
  await within(row).findByRole('button', { name: '출석' })
  expect(within(row).queryByRole('button', { name: '출석 취소' })).toBeNull()
})

test('스캐너가 출석을 확인하면 열려 있는 신청자 목록에 바로 출석으로 보인다(요청 중 닫아도 반영된다)', async () => {
  const { api } = setup()
  let release!: () => void
  const held = new Promise<void>(resolve => (release = resolve))
  api.on('POST', CHECK_IN_PATH, async () => {
    await held
    return json({
      registrationId: REGISTRATION_ID,
      name: '김새내',
      studentId: null,
      already: false,
    })
  })
  const row = await openList()
  expect(within(row).getByRole('button', { name: '출석' })).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'QR로 출석 확인' }))
  const scanner = await screen.findByRole('dialog', { name: 'QR로 출석 확인' })
  await within(scanner).findByText('참가자의 QR을 네모 안에 맞춰 주세요.')
  queue.push(qrTextOf('0123456789abcdef'.repeat(4)))
  await waitFor(() => expect(api.calls.some(call => call.path === CHECK_IN_PATH)).toBe(true))
  // 요청이 끝나기 전에 스캐너를 닫는다
  fireEvent.click(within(scanner).getAllByRole('button', { name: '닫기' })[0]!)
  await act(async () => release())
  await within(row).findByRole('button', { name: '출석 취소' })
})

test('고치는 중에 양식이 사라지면 창을 닫고 이유를 보인다', async () => {
  const { server } = setup()
  fireEvent.click(await screen.findByRole('button', { name: '고치기' }))
  await screen.findByRole('dialog', { name: '신청 양식 고치기' })
  server.forms = []
  await pollNow()
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  expect(screen.getByText(REGISTRATION_STAFF_LOST)).toBeTruthy()
})

test('관리 권한이 빠지면 열린 스캐너와 고치기 창을 닫고 이유를 보인다', async () => {
  const { server } = setup()
  fireEvent.click(await screen.findByRole('button', { name: 'QR로 출석 확인' }))
  await screen.findByRole('dialog', { name: 'QR로 출석 확인' })
  server.actions = ['registration.view_applicants']
  await pollNow()
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  expect(screen.getByText(PERMISSION_CHANGED)).toBeTruthy()
})
