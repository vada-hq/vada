// @vitest-environment jsdom
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { qrTextOf, type FormListAction } from '@vada/contracts'
import { councilView } from '@/test-support/council-fixtures'
import { json, mockApi } from '@/test-support/mock-api'
import {
  CHECK_IN_PATH,
  FORMS_PATH,
  REGISTRATION_ID,
  STAFF_EVENT_ID,
  applicant,
  applicantChange,
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
const EVENT_APPLICANTS_PATH = `/api/organizations/c1/events/${STAFF_EVENT_ID}/applicants`
const LIST: FormListAction[] = ['form.create']
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
    actions: LIST,
    applicants: [applicant()],
  }
  const api = mockApi()
  api.on('GET', FORMS_PATH, () =>
    json({ forms: server.forms, truncated: false, actions: server.actions }),
  )
  const readApplicants = () =>
    json({
      applicants: server.applicants.map(row => ({
        ...row,
        formId: staffForm().id,
        formTitle: staffForm().name,
        affiliation: null,
        answers: [],
        needsAttention: false,
      })),
      counts: {
        applicants: server.applicants.length,
        attended: server.applicants.filter(row => row.attended).length,
      },
      truncated: false,
      canView: true,
      canManage: true,
      showAffiliation: false,
      showForm: false,
    })
  api.on('GET', EVENT_APPLICANTS_PATH, readApplicants)
  api.on('GET', '/api/organizations/c1/accounts', () => json({ accounts: [], truncated: false }))
  const handlers = { onForbidden: vi.fn(), onLost: vi.fn() }
  render(
    <RegistrationTab
      view={councilView('c1', { memberId: 'm9' })}
      eventId={STAFF_EVENT_ID}
      event={null}
      onEditEvent={vi.fn()}
      {...handlers}
    />,
  )
  return { api, server, handlers }
}

async function openList() {
  return (await screen.findByText('김새내')).closest('tr') as HTMLElement
}
async function openActions() {
  fireEvent.keyDown(await screen.findByRole('button', { name: '김새내 동작' }), {
    key: 'ArrowDown',
  })
  return screen.findByRole('menu')
}
// 15초 읽기를 기다리지 않고 화면이 다시 보이는 것으로 바로 읽게 한다.
const pollNow = () => act(async () => void document.dispatchEvent(new Event('visibilitychange')))

test('신청 취소 확인 창에서 404면 창을 닫고 이유를 보이고 그 행을 뺀다', async () => {
  const { api, server } = setup()
  api.on('POST', `${ROW}/cancel`, () => {
    server.applicants = []
    return json({ error: 'NOT_FOUND' }, 404)
  })
  await openList()
  fireEvent.click(within(await openActions()).getByRole('menuitem', { name: '신청 취소' }))
  const dialog = await screen.findByRole('dialog')
  fireEvent.click(within(dialog).getByRole('button', { name: '신청 취소' }))
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  expect(screen.getByText(REGISTRATION_STAFF_LOST)).toBeTruthy()
  expect(screen.queryByText('김새내')).toBeNull()
})

test('신청 취소 확인 창에서 403이면 창을 닫고 학생회를 다시 읽게 하고 이유를 보인다', async () => {
  const { api, handlers } = setup()
  api.on('POST', `${ROW}/cancel`, () => json({ error: 'FORBIDDEN' }, 403))
  await openList()
  fireEvent.click(within(await openActions()).getByRole('menuitem', { name: '신청 취소' }))
  fireEvent.click(
    within(await screen.findByRole('dialog')).getByRole('button', { name: '신청 취소' }),
  )
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  expect(handlers.onForbidden).toHaveBeenCalled()
  expect(screen.getByText(PERMISSION_CHANGED)).toBeTruthy()
})

test('[출석]이 404면 이유를 보이고 그 행을 뺀다', async () => {
  const { api, server } = setup()
  api.on('POST', `${ROW}/attendance`, () => {
    server.applicants = []
    return json({ error: 'NOT_FOUND' }, 404)
  })
  await openList()
  fireEvent.click(within(await openActions()).getByRole('menuitem', { name: '출석' }))
  await waitFor(() => expect(screen.queryByText('김새내')).toBeNull())
  expect(screen.getByText(REGISTRATION_STAFF_LOST)).toBeTruthy()
})

test('목록을 서버에서 새로 읽으면 이 화면에서 바꾼 출석보다 서버 값이 앞선다', async () => {
  const { api, server } = setup()
  api.on('POST', `${ROW}/attendance`, () => {
    server.applicants = [
      applicant({ attended: true, actions: ['registration.cancel_check_in', 'deposit.confirm'] }),
    ]
    return json({
      registrationId: REGISTRATION_ID,
      applicant: applicantChange(),
      name: '김새내',
      studentId: null,
      already: false,
    })
  })
  const row = await openList()
  fireEvent.click(within(await openActions()).getByRole('menuitem', { name: '출석' }))
  await within(row).findByText('참석')
  // 다른 운영진이 출석을 취소했다
  server.applicants = [applicant({ attended: false })]
  fireEvent.click(screen.getByRole('button', { name: '새로 읽기' }))
  await within(row).findByText('참석 기록 없음')
  const menu = await openActions()
  expect(within(menu).getByRole('menuitem', { name: '출석' })).toBeTruthy()
  expect(within(menu).queryByRole('menuitem', { name: '출석 취소' })).toBeNull()
})

test('스캐너가 출석을 확인하면 열려 있는 신청자 목록에 바로 출석으로 보인다(요청 중 닫아도 반영된다)', async () => {
  const { api } = setup()
  let release!: () => void
  const held = new Promise<void>(resolve => (release = resolve))
  api.on('POST', CHECK_IN_PATH, async () => {
    await held
    return json({
      registrationId: REGISTRATION_ID,
      applicant: applicantChange(),
      name: '김새내',
      studentId: null,
      already: false,
    })
  })
  const row = await openList()
  expect(within(row).getByText('참석 기록 없음')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'QR로 출석 확인' }))
  const scanner = await screen.findByRole('dialog', { name: 'QR로 출석 확인' })
  await within(scanner).findByText('참가자의 QR을 네모 안에 맞춰 주세요.')
  queue.push(qrTextOf('0123456789abcdef'.repeat(4)))
  await waitFor(() => expect(api.calls.some(call => call.path === CHECK_IN_PATH)).toBe(true))
  // 요청이 끝나기 전에 스캐너를 닫는다
  fireEvent.click(within(scanner).getAllByRole('button', { name: '닫기' })[0]!)
  await act(async () => release())
  await within(row).findByText('참석')
})

test('고치는 중에 양식이 사라지면 고치기 화면을 닫고 이유를 보인다', async () => {
  const { server } = setup()
  fireEvent.click(await screen.findByRole('button', { name: '고치기' }))
  await screen.findByRole('form', { name: '신청 양식 고치기' })
  server.forms = []
  await pollNow()
  await waitFor(() => expect(screen.queryByRole('form', { name: '신청 양식 고치기' })).toBeNull())
  expect(screen.getByText(REGISTRATION_STAFF_LOST)).toBeTruthy()
})

test('양식의 form.check_in이 빠지면 열린 스캐너를 닫고 이유를 보인다(목록의 form.create와 무관하다)', async () => {
  const { server } = setup()
  fireEvent.click(await screen.findByRole('button', { name: 'QR로 출석 확인' }))
  await screen.findByRole('dialog', { name: 'QR로 출석 확인' })
  server.forms = [staffForm({ actions: ['form.update', 'form.view_applicants'] })]
  await pollNow()
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  expect(screen.getByText(PERMISSION_CHANGED)).toBeTruthy()
  expect(screen.queryByRole('button', { name: 'QR로 출석 확인' })).toBeNull()
  expect(screen.getByRole('button', { name: '참여 설문 만들기' })).toBeTruthy()
})

test('그 양식의 form.update가 빠지면 열린 고치기 화면을 닫고 이유를 보인다(목록의 form.create는 그대로)', async () => {
  const { server } = setup()
  fireEvent.click(await screen.findByRole('button', { name: '고치기' }))
  await screen.findByRole('form', { name: '신청 양식 고치기' })
  server.forms = [staffForm({ actions: ['form.check_in', 'form.view_applicants'] })]
  await pollNow()
  await waitFor(() => expect(screen.queryByRole('form', { name: '신청 양식 고치기' })).toBeNull())
  expect(screen.getByText(PERMISSION_CHANGED)).toBeTruthy()
})
