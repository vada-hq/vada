// @vitest-environment jsdom
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { MyCouncil } from '@vada/contracts'
import App from './App'
import { councilView, myCouncil, teamResponse } from './test-support/council-fixtures'
import { json, mockApi } from './test-support/mock-api'

const auth = vi.hoisted(() => ({ useSession: vi.fn(), social: vi.fn(), signOut: vi.fn() }))
vi.mock('./auth/auth-client', () => ({ authClient: { useSession: auth.useSession, signIn: { social: auth.social }, signOut: auth.signOut } }))
let api: ReturnType<typeof mockApi>
beforeEach(() => {
  window.history.replaceState(null, '', '/')
  vi.resetAllMocks()
  api = mockApi()
  auth.useSession.mockReturnValue({ data: { user: { id: 'u1', name: '김회장', email: 'kim@example.test' } }, isPending: false, error: null })
})
afterEach(() => {
  cleanup()
  try { api.assertNoUnexpectedRequests() } finally { vi.unstubAllGlobals(); vi.restoreAllMocks() }
})

// 내 학생회 목록을 차례로 돌려준다. 마지막 응답은 그 뒤로도 같다.
function councilsInSequence(...lists: MyCouncil[][]) {
  let call = 0
  api.on('GET', '/api/me/councils', () => json({ councils: lists[Math.min(call++, lists.length - 1)] }))
}
function openCouncil(id = 'c1', name = '컴퓨터학부 학생회') {
  api.on('GET', `/api/organizations/${id}`, () => json(councilView(id, { name })))
  api.on('GET', `/api/organizations/${id}/members`, () => json(teamResponse()))
}

test('학생회가 없으면 초대 코드와 학생회 만들기를 보이고, 만들면 운영진 > 사람으로 간다', async () => {
  councilsInSequence([])
  openCouncil()
  api.on('POST', '/api/organizations/create', () => json({ council: myCouncil() }, 201))
  render(<App />)
  expect(await screen.findByRole('heading', { name: '아직 들어간 학생회가 없어요' })).toBeTruthy()
  expect((screen.getByRole('button', { name: '초대 코드로 들어가기' }) as HTMLButtonElement).disabled).toBe(true)
  fireEvent.click(screen.getByRole('button', { name: '학생회 만들기' }))
  const form = screen.getByRole('form', { name: '학생회 만들기' })
  const submit = within(form).getByRole('button', { name: '학생회 만들기' }) as HTMLButtonElement
  expect(submit.disabled).toBe(true)
  fireEvent.change(within(form).getByLabelText('학생회 이름'), { target: { value: '컴퓨터학부 학생회' } })
  fireEvent.change(within(form).getByLabelText('학교'), { target: { value: '한양대학교 ERICA' } })
  fireEvent.change(within(form).getByLabelText('단위'), { target: { value: 'college' } })
  expect(submit.disabled).toBe(false)
  fireEvent.click(submit)
  expect(await screen.findByRole('heading', { level: 1, name: '사람' })).toBeTruthy()
  expect(await screen.findByText('운영진 3명')).toBeTruthy()
  const year = new Date(Date.now() + 9 * 3_600_000).toISOString().slice(0, 4)
  expect(api.calls.find(call => call.method === 'POST')?.body).toEqual({ name: '컴퓨터학부 학생회', unit: 'college', schoolName: '한양대학교 ERICA',
    cohortName: year, startsOn: `${year}-01-01`, endsOn: `${year}-12-31` })
})

test('임기에 오늘이 없으면 만들지 못한 까닭을 보여 준다', async () => {
  councilsInSequence([])
  api.on('POST', '/api/organizations/create', () => json({ error: 'COHORT_NOT_CURRENT' }, 409))
  render(<App />)
  fireEvent.click(await screen.findByRole('button', { name: '학생회 만들기' }))
  const form = screen.getByRole('form', { name: '학생회 만들기' })
  fireEvent.change(within(form).getByLabelText('학생회 이름'), { target: { value: '학생회' } })
  fireEvent.change(within(form).getByLabelText('학교'), { target: { value: '학교' } })
  fireEvent.click(within(form).getByRole('button', { name: '학생회 만들기' }))
  expect(await screen.findByText('임기에 오늘이 들어 있어야 해요. 기간을 확인해 주세요.')).toBeTruthy()
})

test('초대 링크로 오면 학생회 이름을 묻고, 들어가면 그 학생회를 연다', async () => {
  window.history.replaceState(null, '', '/join/ABCD2345')
  api.on('GET', '/api/invites/ABCD2345', () => json({ council: { id: 'c1', name: '컴퓨터학부 학생회' }, joined: false }))
  api.on('POST', '/api/organizations/join', () => json({ council: myCouncil('c1', '컴퓨터학부 학생회', null) }))
  councilsInSequence([myCouncil('c1', '컴퓨터학부 학생회', null)])
  openCouncil()
  render(<App />)
  expect(await screen.findByRole('heading', { name: '컴퓨터학부 학생회에 들어갈까요?' })).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: '들어가기' }))
  expect(await screen.findByText('운영진 3명')).toBeTruthy()
  expect(window.location.pathname).toBe('/')
  expect(api.calls.find(call => call.method === 'POST')?.body).toEqual({ code: 'ABCD2345' })
})

test('이미 들어온 학생회의 초대 링크는 묻지 않고 그 학생회를 연다', async () => {
  window.history.replaceState(null, '', '/join/ABCD2345')
  api.on('GET', '/api/invites/ABCD2345', () => json({ council: { id: 'c2', name: '경영학부 학생회' }, joined: true }))
  councilsInSequence([myCouncil('c1'), myCouncil('c2', '경영학부 학생회')])
  openCouncil('c2', '경영학부 학생회')
  render(<App />)
  expect(await screen.findByRole('button', { name: '학생회 메뉴: 경영학부 학생회' })).toBeTruthy()
})

test('코드를 직접 입력하면 초대 확인으로 가고, 틀린 코드면 다시 입력할 수 있다', async () => {
  councilsInSequence([])
  api.on('GET', '/api/invites/ZZZZ2222', () => json({ error: 'NOT_FOUND' }, 404))
  render(<App />)
  fireEvent.change(await screen.findByLabelText('초대 코드'), { target: { value: 'https://vada.test/join/zzzz-2222' } })
  fireEvent.click(screen.getByRole('button', { name: '초대 코드로 들어가기' }))
  expect(await screen.findByText('초대 코드가 올바르지 않아요. 바뀌었을 수 있으니 학생회에 다시 받아 주세요.')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: '다시 입력' }))
  expect(await screen.findByRole('heading', { name: '아직 들어간 학생회가 없어요' })).toBeTruthy()
})

test('지금 기수가 없는 학생회에는 들어가지 못한 까닭을 보여 준다', async () => {
  window.history.replaceState(null, '', '/join/ABCD2345')
  api.on('GET', '/api/invites/ABCD2345', () => json({ council: { id: 'c1', name: '컴퓨터학부 학생회' }, joined: false }))
  api.on('POST', '/api/organizations/join', () => json({ error: 'NO_CURRENT_COHORT' }, 409))
  render(<App />)
  fireEvent.click(await screen.findByRole('button', { name: '들어가기' }))
  expect(await screen.findByText('지금 들어갈 수 있는 기수가 없어요. 학생회 회장단에게 알려 주세요.')).toBeTruthy()
})

test('내보내진 사람의 다음 요청이 403이면 그 학생회를 닫고, 남은 학생회가 없으면 학생회 없음 안내로 돌아간다', async () => {
  councilsInSequence([myCouncil('c1', '컴퓨터학부 학생회', null)], [])
  api.on('GET', '/api/organizations/c1', () => json({ error: 'FORBIDDEN' }, 403))
  api.on('GET', '/api/organizations/c1/members', () => json({ error: 'FORBIDDEN' }, 403))
  render(<App />)
  expect(await screen.findByRole('heading', { name: '아직 들어간 학생회가 없어요' })).toBeTruthy()
  expect(api.calls.filter(call => call.path === '/api/me/councils').length).toBeGreaterThanOrEqual(2)
})

test('학생회 이름 메뉴로 다른 학생회를 고른다', async () => {
  councilsInSequence([myCouncil('c1'), myCouncil('c2', '경영학부 학생회', null)])
  openCouncil()
  openCouncil('c2', '경영학부 학생회')
  render(<App />)
  const menu = await screen.findByRole('button', { name: '학생회 메뉴: 컴퓨터학부 학생회' })
  fireEvent.keyDown(menu, { key: 'Enter' })
  fireEvent.click(await screen.findByRole('menuitem', { name: '경영학부 학생회' }))
  expect(await screen.findByRole('button', { name: '학생회 메뉴: 경영학부 학생회' })).toBeTruthy()
  await waitFor(() => expect(api.calls.some(call => call.path === '/api/organizations/c2/members')).toBe(true))
})

test('옆 메뉴 아래 사용자 줄에 이름, 직급, 휴대폰 알림, 로그아웃이 있고 휴대폰 폭에서는 시트로 연다', async () => {
  councilsInSequence([myCouncil()])
  openCouncil()
  auth.signOut.mockResolvedValue({ error: null })
  render(<App />)
  const aside = await screen.findByRole('complementary', { name: '학생회 작업 공간' })
  expect(await within(aside).findByText('회장')).toBeTruthy()
  expect(within(aside).getByText('김회장')).toBeTruthy()
  expect(within(aside).getByRole('button', { name: '휴대폰 알림' })).toBeTruthy()
  fireEvent.click(within(aside).getByRole('button', { name: '로그아웃' }))
  await waitFor(() => expect(auth.signOut).toHaveBeenCalledOnce())
  fireEvent.click(screen.getByRole('button', { name: '메뉴 열기' }))
  const sheet = await screen.findByRole('dialog', { name: '학생회 작업 공간' })
  expect(within(sheet).getByRole('button', { name: '로그아웃' })).toBeTruthy()
})
