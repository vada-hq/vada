// @vitest-environment jsdom
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, screen } from '@testing-library/react'
import { renderApp } from './test-support/render-app'
import { councilView, myCouncil, teamResponse } from './test-support/council-fixtures'
import { messagePage, roomDetail, roomList } from './test-support/chat-fixtures'
import { homeTask, homeWithTasks } from './test-support/home-fixtures'
import { json, mockApi } from './test-support/mock-api'
import { snapshotHtml } from './test-support/snapshot-html'

// 앱 틀과 알림을 나누기 전의 겉 모양을 그대로 적어 둔 특성 시험이다(docs/features/r01-maintainability.md 조각 7).
// 나눈 뒤에도 이 스냅숏 파일은 바뀌지 않아야 한다.
const auth = vi.hoisted(() => ({
  useSession: vi.fn(),
  social: vi.fn(),
  signOut: vi.fn(),
  refetch: vi.fn(),
}))
vi.mock('./auth/auth-client', () => ({
  authClient: {
    useSession: auth.useSession,
    signIn: { social: auth.social },
    signOut: auth.signOut,
  },
}))
const kakaoAgent =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 KAKAOTALK 10.9.0'
const session = (state: object) =>
  auth.useSession.mockReturnValue({
    isPending: false,
    error: null,
    refetch: auth.refetch,
    ...state,
  })
const signedIn = () =>
  session({ data: { user: { id: 'u1', name: '김회장', email: 'kim@example.test' } } })

beforeEach(() => {
  vi.resetAllMocks()
  window.history.replaceState(null, '', '/')
  session({ data: null })
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

test('로그인 전', async () => {
  await renderApp()
  expect(snapshotHtml()).toMatchSnapshot()
})

test('로그인 전: 초대 링크로 옴', async () => {
  window.history.replaceState(null, '', '/join/ABCD2345')
  await renderApp()
  expect(snapshotHtml()).toMatchSnapshot()
})

test('로그인 전: 로그인 시작 실패', async () => {
  auth.social.mockRejectedValue(new Error('x'))
  await renderApp()
  fireEvent.click(screen.getByRole('button', { name: /Google/ }))
  await screen.findByText('로그인을 시작하지 못했어요. 연결을 확인하고 다시 시도해 주세요.')
  expect(snapshotHtml()).toMatchSnapshot()
})

test('로그인 전: 카카오톡 안 브라우저', async () => {
  vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(kakaoAgent)
  await renderApp()
  expect(snapshotHtml()).toMatchSnapshot()
})

test('세션을 불러오는 중', async () => {
  session({ data: null, isPending: true })
  await renderApp()
  expect(snapshotHtml()).toMatchSnapshot()
})

test('세션 확인 오류', async () => {
  session({ data: null, error: new Error('x') })
  await renderApp()
  expect(snapshotHtml()).toMatchSnapshot()
})

test('학생회 없음', async () => {
  signedIn()
  const api = mockApi()
  api.on('GET', '/api/me/councils', () => json({ councils: [] }))
  await renderApp()
  await screen.findByRole('heading', { name: '아직 들어간 학생회가 없어요' })
  expect(snapshotHtml()).toMatchSnapshot()
})

test('학생회 확인 중', async () => {
  signedIn()
  const api = mockApi()
  api.on('GET', '/api/me/councils', () => new Promise<Response>(() => {}))
  await renderApp()
  expect(snapshotHtml()).toMatchSnapshot()
})

function openWorkspace() {
  signedIn()
  const api = mockApi()
  const councils = [myCouncil('c1', '컴퓨터학부 학생회'), myCouncil('c2', '소프트웨어학부 학생회')]
  api.on('GET', '/api/me/councils', () => json({ councils }))
  api.on('GET', '/api/organizations/c1', () => json(councilView('c1')))
  api.on('GET', '/api/organizations/c1/members', () => json(teamResponse()))
  api.on('GET', '/api/organizations/c1/invite', () => json({ code: 'ABCD2345' }))
  api.on('GET', '/api/organizations/c1/rooms', () => json(roomList()))
  api.on('GET', '/api/organizations/c1/home', () => json(homeWithTasks([homeTask('a', 'today')])))
  api.on('GET', '/api/organizations/c1/tasks?view=mine&status=open', () =>
    json({ tasks: [], truncated: false }),
  )
  api.on('GET', '/api/organizations/c1/rooms/r1', () => json(roomDetail()))
  api.on('GET', '/api/organizations/c1/rooms/r1/messages', () => json(messagePage()))
  api.on('POST', '/api/organizations/c1/rooms/r1/read', () => new Response(null, { status: 204 }))
  return api
}
// 홈이 첫 화면이다. 대화나 운영진 화면을 찍는 시험은 옆 메뉴로 연다.
async function openChat() {
  fireEvent.click(await screen.findByRole('button', { name: /^대화/ }))
}
async function openPeople() {
  fireEvent.click(await screen.findByRole('button', { name: '사람' }))
}

test('작업 공간: 학생회를 불러오는 중', async () => {
  const api = openWorkspace()
  api.on('GET', '/api/organizations/c1', () => new Promise<Response>(() => {}))
  await renderApp()
  await screen.findByText('학생회 불러오는 중…')
  expect(snapshotHtml()).toMatchSnapshot()
})

test('작업 공간: 사람', async () => {
  openWorkspace()
  await renderApp()
  await openPeople()
  await screen.findByText('운영진 3명')
  // 초대 링크는 따로 불러와 늦게 그려진다. 끝난 상태를 찍는다.
  await screen.findByRole('region', { name: '초대 링크' })
  expect(snapshotHtml()).toMatchSnapshot()
})

test('작업 공간: 부서', async () => {
  openWorkspace()
  await renderApp()
  await openPeople()
  await screen.findByText('운영진 3명')
  // 초대 링크는 따로 불러와 늦게 그려진다. 끝난 상태를 찍는다.
  await screen.findByRole('region', { name: '초대 링크' })
  fireEvent.click(screen.getAllByRole('button', { name: '부서' })[0] as HTMLElement)
  await screen.findByRole('heading', { level: 1, name: '부서' })
  await screen.findByText('부서 2개')
  expect(snapshotHtml()).toMatchSnapshot()
})

test('작업 공간: 홈', async () => {
  openWorkspace()
  await renderApp()
  await screen.findByRole('button', { name: /업무 a/ })
  expect(snapshotHtml()).toMatchSnapshot()
})

test('작업 공간: 대화 방 목록', async () => {
  openWorkspace()
  await renderApp()
  await openChat()
  await screen.findByText('재정부')
  expect(snapshotHtml()).toMatchSnapshot()
})

test('작업 공간: 대화 방', async () => {
  openWorkspace()
  await renderApp()
  await openChat()
  fireEvent.click(await screen.findByRole('button', { name: /운영진 전체방/ }))
  await screen.findByText('모레 회의 있어요')
  expect(snapshotHtml()).toMatchSnapshot()
})

test('작업 공간: 학생회를 불러오지 못함', async () => {
  const api = openWorkspace()
  api.on('GET', '/api/organizations/c1', () => json({ error: 'Internal server error' }, 500))
  await renderApp()
  await screen.findByText('학생회를 불러오지 못했어요. 연결을 확인해 주세요.')
  expect(snapshotHtml()).toMatchSnapshot()
})

test('작업 공간: 옆 메뉴를 연 휴대폰 폭', async () => {
  openWorkspace()
  await renderApp()
  await openPeople()
  await screen.findByText('운영진 3명')
  // 초대 링크는 따로 불러와 늦게 그려진다. 끝난 상태를 찍는다.
  await screen.findByRole('region', { name: '초대 링크' })
  fireEvent.click(screen.getByRole('button', { name: '메뉴 열기' }))
  await screen.findByRole('dialog')
  expect(snapshotHtml()).toMatchSnapshot()
})
