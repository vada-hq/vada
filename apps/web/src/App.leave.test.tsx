// @vitest-environment jsdom
import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { renderApp } from './test-support/render-app'
import { resetWindowHistory, windowHistoryIdle } from './lib/use-window-history'
import { LEAVE_CONFIRM, LEAVE_TITLE } from './lib/messages'
import { roomList } from './test-support/chat-fixtures'
import {
  councilView,
  LEADER_PERMISSIONS,
  myCouncil,
  teamResponse,
} from './test-support/council-fixtures'
import { homeResponse, onHomeExtras } from './test-support/home-fixtures'
import { json, mockApi } from './test-support/mock-api'

const auth = vi.hoisted(() => ({ useSession: vi.fn(), signOut: vi.fn() }))
vi.mock('./auth/auth-client', () => ({
  authClient: { useSession: auth.useSession, signIn: { social: vi.fn() }, signOut: auth.signOut },
}))

const C1 = '0199d1a0-0000-7000-8000-0000000000c1'
let api: ReturnType<typeof mockApi>

beforeEach(() => {
  window.history.replaceState(null, '', '/')
  api = mockApi()
  auth.useSession.mockReturnValue({
    data: { user: { id: 'u1', name: '김회장', email: 'kim@example.test' } },
    isPending: false,
    error: null,
    refetch: vi.fn(),
  })
  api.on('GET', '/api/me/councils', () => json({ councils: [myCouncil(C1)] }))
  api.on('GET', `/api/organizations/${C1}`, () =>
    json(councilView(C1, { permissions: LEADER_PERMISSIONS })),
  )
  api.on('GET', `/api/organizations/${C1}/members`, () => json(teamResponse()))
  api.on('GET', `/api/organizations/${C1}/rooms`, () => json(roomList()))
  api.on('GET', `/api/organizations/${C1}/home`, () => json(homeResponse()))
  onHomeExtras(api, {}, C1)
})
afterEach(async () => {
  cleanup()
  await windowHistoryIdle()
  resetWindowHistory()
  vi.restoreAllMocks()
})

const aside = () => screen.getByRole('complementary', { name: '학생회 작업 공간', hidden: true })
const menu = (name: string | RegExp) => within(aside()).getByRole('button', { name, hidden: true })
const heading = (name: string) => screen.findByRole('heading', { level: 1, name, hidden: true })
const pathNow = () => window.location.pathname + window.location.search
const settle = () =>
  act(async () => {
    await windowHistoryIdle()
  })
const nameField = () => screen.getByLabelText('학생회 이름')

async function openSettings() {
  window.history.replaceState(null, '', `/settings/${C1}`)
  await renderApp()
  expect(await heading('학생회 정보')).toBeTruthy()
}
const edit = () => fireEvent.change(nameField(), { target: { value: '고친 이름 학생회' } })

test('설정에서 이름을 고치다 메뉴를 누르면 확인이 먼저 나오고, 닫기면 쓰던 입력이 그대로다', async () => {
  await openSettings()
  edit()
  fireEvent.click(menu('조직'))
  expect(await screen.findByText(LEAVE_TITLE)).toBeTruthy()
  expect(pathNow()).toBe(`/settings/${C1}`)
  fireEvent.click(screen.getAllByRole('button', { name: '닫기' })[0]!)
  await waitFor(() => expect(screen.queryByText(LEAVE_TITLE)).toBeNull())
  expect(pathNow()).toBe(`/settings/${C1}`)
  expect((nameField() as HTMLInputElement).value).toBe('고친 이름 학생회')
})

test('입력을 버리고 나가면 그 메뉴가 열린다', async () => {
  await openSettings()
  edit()
  fireEvent.click(menu('조직'))
  fireEvent.click(await screen.findByRole('button', { name: LEAVE_CONFIRM }))
  expect(await heading('조직')).toBeTruthy()
  expect(pathNow()).toBe(`/people/${C1}`)
  await waitFor(() => expect(screen.queryByText(LEAVE_TITLE)).toBeNull())
})

test('고치지 않았거나 원래 값으로 되돌렸으면 묻지 않는다', async () => {
  await openSettings()
  fireEvent.change(nameField(), { target: { value: '고친 이름 학생회' } })
  fireEvent.change(nameField(), { target: { value: '컴퓨터학부 학생회' } })
  fireEvent.click(menu('조직'))
  expect(await heading('조직')).toBeTruthy()
  expect(screen.queryByText(LEAVE_TITLE)).toBeNull()
})

test('저장하면 입력이 남지 않은 것이라 묻지 않는다', async () => {
  api.on('POST', `/api/organizations/${C1}/settings`, () =>
    json(councilView(C1, { name: '고친 이름 학생회', permissions: LEADER_PERMISSIONS })),
  )
  await openSettings()
  edit()
  fireEvent.click(screen.getByRole('button', { name: '학생회 정보 저장' }))
  expect(await screen.findByText('저장했어요.')).toBeTruthy()
  fireEvent.click(menu('조직'))
  expect(await heading('조직')).toBeTruthy()
  expect(screen.queryByText(LEAVE_TITLE)).toBeNull()
})

test('앞뒤 공백을 넣어 저장해도(서버가 다듬어 돌려준다) 저장 뒤에는 묻지 않고 beforeunload도 풀린다', async () => {
  api.on('POST', `/api/organizations/${C1}/settings`, () =>
    json(councilView(C1, { name: '고친 이름 학생회', permissions: LEADER_PERMISSIONS })),
  )
  await openSettings()
  fireEvent.change(nameField(), { target: { value: '고친 이름 학생회 ' } })
  fireEvent.click(screen.getByRole('button', { name: '학생회 정보 저장' }))
  expect(await screen.findByText('저장했어요.')).toBeTruthy()
  const event = new Event('beforeunload', { cancelable: true })
  window.dispatchEvent(event)
  expect(event.defaultPrevented).toBe(false)
  fireEvent.click(menu('조직'))
  expect(await heading('조직')).toBeTruthy()
  expect(screen.queryByText(LEAVE_TITLE)).toBeNull()
})

test('권한을 잃어 떠나는 이동은 입력이 있어도 묻지 않고 다음 학생회 홈으로 간다', async () => {
  const C2 = '0199d1a0-0000-7000-8000-0000000000c2'
  api.on('GET', '/api/me/councils', () =>
    json({ councils: [myCouncil(C1), myCouncil(C2, '둘째')] }),
  )
  api.on('GET', `/api/organizations/${C2}`, () => json(councilView(C2)))
  api.on('GET', `/api/organizations/${C2}/members`, () => json(teamResponse()))
  api.on('GET', `/api/organizations/${C2}/rooms`, () => json(roomList()))
  api.on('GET', `/api/organizations/${C2}/home`, () => json(homeResponse()))
  onHomeExtras(api, {}, C2)
  let lost = false
  api.on('GET', `/api/organizations/${C1}`, () =>
    lost
      ? json({ code: 'FORBIDDEN' }, 403)
      : json(councilView(C1, { permissions: LEADER_PERMISSIONS })),
  )
  api.on('POST', `/api/organizations/${C1}/settings`, () => {
    lost = true
    return json({ code: 'FORBIDDEN' }, 403)
  })
  await openSettings()
  edit()
  fireEvent.click(screen.getByRole('button', { name: '학생회 정보 저장' }))
  await waitFor(() => expect(pathNow()).toBe(`/home/${C2}`))
  expect(screen.queryByText(LEAVE_TITLE)).toBeNull()
})

test('기기 뒤로도 같은 확인을 거친다: 계속 쓰기면 그 자리, 나가기면 앞 메뉴', async () => {
  window.history.replaceState(null, '', `/home/${C1}`)
  await renderApp()
  expect(await heading('홈')).toBeTruthy()
  fireEvent.keyDown(screen.getByRole('button', { name: 'Vada 컴퓨터학부 학생회 학생회 메뉴' }), {
    key: 'Enter',
  })
  fireEvent.click(await screen.findByRole('menuitem', { name: '설정' }))
  expect(await heading('학생회 정보')).toBeTruthy()
  await settle()
  edit()
  act(() => window.history.back())
  expect(await screen.findByText(LEAVE_TITLE)).toBeTruthy()
  await waitFor(() => expect(pathNow()).toBe(`/settings/${C1}`))
  expect(screen.getByRole('heading', { level: 1, name: '학생회 정보', hidden: true })).toBeTruthy()
  fireEvent.click(screen.getAllByRole('button', { name: '닫기' })[0]!)
  await waitFor(() => expect(screen.queryByText(LEAVE_TITLE)).toBeNull())
  await settle()
  expect((nameField() as HTMLInputElement).value).toBe('고친 이름 학생회')
  act(() => window.history.back())
  fireEvent.click(await screen.findByRole('button', { name: LEAVE_CONFIRM }))
  expect(await heading('홈')).toBeTruthy()
  expect(pathNow()).toBe(`/home/${C1}`)
})

test('beforeunload는 고친 입력이 있는 동안만 걸린다', async () => {
  await openSettings()
  const before = new Event('beforeunload', { cancelable: true })
  window.dispatchEvent(before)
  expect(before.defaultPrevented).toBe(false)
  edit()
  const during = new Event('beforeunload', { cancelable: true })
  window.dispatchEvent(during)
  expect(during.defaultPrevented).toBe(true)
})
