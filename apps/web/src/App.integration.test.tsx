// @vitest-environment jsdom
import { useSyncExternalStore } from 'react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { MyCouncil } from '@vada/contracts'
import App from './App'
import { renderApp } from './test-support/render-app'
import { councilView, myCouncil, teamResponse } from './test-support/council-fixtures'
import { homeResponse, onHomeExtras } from './test-support/home-fixtures'
import { deferredResponse, json, mockApi } from './test-support/mock-api'
import { asElement } from '@/test-support/elements'
import { settle } from '@/test-support/settle'

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
let api: ReturnType<typeof mockApi>
beforeEach(() => {
  window.history.replaceState(null, '', '/')
  vi.resetAllMocks()
  api = mockApi()
  auth.useSession.mockReturnValue({
    data: { user: { id: 'u1', name: '김회장', email: 'kim@example.test' } },
    isPending: false,
    error: null,
    refetch: auth.refetch,
  })
})
afterEach(() => {
  cleanup()
  try {
    api.assertNoUnexpectedRequests()
  } finally {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  }
})

// 내 학생회 목록을 차례로 돌려준다. 마지막 응답은 그 뒤로도 같다.
function councilsInSequence(...lists: MyCouncil[][]) {
  let call = 0
  api.on('GET', '/api/me/councils', () =>
    json({ councils: lists[Math.min(call++, lists.length - 1)] }),
  )
}
// 홈이 첫 화면이라 학생회를 열면 홈을 읽는다. 이 시험들은 운영진 화면을 보므로 홈과 방은 비어 있다.
function emptyRooms(id: string) {
  api.on('GET', `/api/organizations/${id}/home`, () => json(homeResponse()))
  onHomeExtras(api, {}, id)
  api.on('GET', `/api/organizations/${id}/rooms`, () =>
    json({ rooms: [], notices: [], unreadTotal: 0, mentionTotal: 0 }),
  )
  api.on('GET', `/api/organizations/${id}/tasks?view=mine&status=open`, () =>
    json({ tasks: [], truncated: false }),
  )
}
// 만든 직후가 아니면 홈이 첫 화면이다. 옆 메뉴로 운영진 > 사람을 연다.
async function openPeople() {
  const aside = await screen.findByRole('complementary', { name: '학생회 작업 공간' })
  fireEvent.click(await within(aside).findByRole('button', { name: '사람' }))
}
function openCouncil(id = '0199d1a0-0000-7000-8000-0000000000c1', name = '컴퓨터학부 학생회') {
  emptyRooms(id)
  api.on('GET', `/api/organizations/${id}`, () => json(councilView(id, { name })))
  api.on('GET', `/api/organizations/${id}/members`, () => json(teamResponse()))
  // 회장단에게는 운영진 > 사람 위에 초대 링크가 보인다.
  api.on('GET', `/api/organizations/${id}/invite`, () => json({ code: 'ABCD2345' }))
}

test('학생회가 없으면 초대 코드와 학생회 만들기를 보이고, 빈 칸이면 보내지 않으며, 만들면 운영진 > 사람으로 간다', async () => {
  councilsInSequence([])
  openCouncil()
  api.on('POST', '/api/organizations/create', () =>
    json({ council: myCouncil('0199d1a0-0000-7000-8000-0000000000c1') }, 201),
  )
  await renderApp()
  expect(await screen.findByRole('heading', { name: '아직 들어간 학생회가 없어요' })).toBeTruthy()
  const enter = asElement(
    screen.getByRole('button', { name: '초대 코드로 들어가기' }),
    HTMLButtonElement,
  )
  expect(enter.disabled).toBe(false)
  fireEvent.click(enter)
  expect(screen.getByText('초대 코드를 입력해 주세요')).toBeTruthy()
  expect(api.calls.some(call => call.method === 'POST')).toBe(false)
  fireEvent.click(screen.getByRole('button', { name: '학생회 만들기' }))
  const form = screen.getByRole('form', { name: '학생회 만들기' })
  const submit = within(form).getByRole('button', { name: '학생회 만들기' }) as HTMLButtonElement
  // 비운 채 누르면 보내지 않고 칸 아래에 알린다.
  expect(submit.disabled).toBe(false)
  fireEvent.click(submit)
  expect(within(form).getByText('학생회 이름을 입력해 주세요')).toBeTruthy()
  expect(within(form).getByText('학교를 입력해 주세요')).toBeTruthy()
  expect(api.calls.some(call => call.method === 'POST')).toBe(false)
  fireEvent.change(within(form).getByLabelText('학생회 이름'), {
    target: { value: '컴퓨터학부 학생회' },
  })
  fireEvent.change(within(form).getByLabelText('학교'), { target: { value: '한양대학교 ERICA' } })
  fireEvent.change(within(form).getByLabelText('단위'), { target: { value: 'college' } })
  fireEvent.click(submit)
  expect(await screen.findByRole('heading', { level: 1, name: '사람' })).toBeTruthy()
  expect(await screen.findByText('운영진 3명')).toBeTruthy()
  const year = new Date(Date.now() + 9 * 3_600_000).toISOString().slice(0, 4)
  expect(api.calls.find(call => call.method === 'POST')?.body).toEqual({
    name: '컴퓨터학부 학생회',
    unit: 'college',
    schoolName: '한양대학교 ERICA',
    cohortName: year,
    startsOn: `${year}-01-01`,
    endsOn: `${year}-12-31`,
  })
})

test('학생회 만들기는 보내는 동안 버튼이 꺼져, 두 번 눌러도 한 번만 보낸다', async () => {
  councilsInSequence([])
  openCouncil()
  const pending = deferredResponse()
  api.on('POST', '/api/organizations/create', () => pending.promise)
  await renderApp()
  fireEvent.click(await screen.findByRole('button', { name: '학생회 만들기' }))
  const form = screen.getByRole('form', { name: '학생회 만들기' })
  fireEvent.change(within(form).getByLabelText('학생회 이름'), {
    target: { value: '컴퓨터학부 학생회' },
  })
  fireEvent.change(within(form).getByLabelText('학교'), { target: { value: '한양대학교 ERICA' } })
  fireEvent.click(within(form).getByRole('button', { name: '학생회 만들기' }))
  const sending = (await within(form).findByRole('button', {
    name: '만드는 중…',
  })) as HTMLButtonElement
  expect(sending.disabled).toBe(true)
  // 꺼진 버튼을 눌러도, 입력칸에서 Enter로 보내도 두 번째 요청은 가지 않는다.
  fireEvent.click(sending)
  fireEvent.submit(form)
  expect(api.calls.filter(call => call.method === 'POST')).toHaveLength(1)
  pending.resolve(json({ council: myCouncil('0199d1a0-0000-7000-8000-0000000000c1') }, 201))
  expect(await screen.findByRole('heading', { level: 1, name: '사람' })).toBeTruthy()
  expect(api.calls.filter(call => call.method === 'POST')).toHaveLength(1)
})

test('학생회 만들기에서 임기 끝이 시작보다 뒤가 아니면 눌러도 보내지 않고 임기 끝 칸 아래에 까닭을 보인다', async () => {
  councilsInSequence([])
  await renderApp()
  fireEvent.click(await screen.findByRole('button', { name: '학생회 만들기' }))
  const form = screen.getByRole('form', { name: '학생회 만들기' })
  fireEvent.change(within(form).getByLabelText('학생회 이름'), {
    target: { value: '컴퓨터학부 학생회' },
  })
  fireEvent.change(within(form).getByLabelText('학교'), { target: { value: '한양대학교 ERICA' } })
  const submit = within(form).getByRole('button', { name: '학생회 만들기' }) as HTMLButtonElement
  const reason = '임기 시작보다 뒤의 날짜를 입력해 주세요'
  fireEvent.change(within(form).getByLabelText('임기 시작'), { target: { value: '2026-06-01' } })
  fireEvent.change(within(form).getByLabelText('임기 끝'), { target: { value: '2026-05-01' } })
  expect(within(form).queryByText(reason)).toBeNull()
  expect(submit.disabled).toBe(false)
  fireEvent.click(submit)
  expect(within(form).getByText(reason)).toBeTruthy()
  const end = within(form).getByLabelText('임기 끝')
  expect(end.getAttribute('aria-invalid')).toBe('true')
  await waitFor(() => expect(document.activeElement).toBe(end))
  expect(api.calls.some(call => call.method === 'POST')).toBe(false)
  fireEvent.change(end, { target: { value: '2026-12-31' } })
  expect(within(form).queryByText(reason)).toBeNull()
})

test('임기에 오늘이 없으면 만들지 못한 까닭을 보여 준다', async () => {
  councilsInSequence([])
  api.on('POST', '/api/organizations/create', () => json({ error: 'COHORT_NOT_CURRENT' }, 409))
  await renderApp()
  fireEvent.click(await screen.findByRole('button', { name: '학생회 만들기' }))
  const form = screen.getByRole('form', { name: '학생회 만들기' })
  fireEvent.change(within(form).getByLabelText('학생회 이름'), { target: { value: '학생회' } })
  fireEvent.change(within(form).getByLabelText('학교'), { target: { value: '학교' } })
  fireEvent.click(within(form).getByRole('button', { name: '학생회 만들기' }))
  expect(
    await screen.findByText('임기에 오늘이 들어 있어야 해요. 기간을 확인해 주세요.'),
  ).toBeTruthy()
})

test('초대 링크로 오면 학생회 이름을 묻고, 들어가면 그 학생회를 연다', async () => {
  window.history.replaceState(null, '', '/join/ABCD2345')
  api.on('GET', '/api/invites/ABCD2345', () =>
    json({
      council: { id: '0199d1a0-0000-7000-8000-0000000000c1', name: '컴퓨터학부 학생회' },
      joined: false,
    }),
  )
  api.on('POST', '/api/organizations/join', () =>
    json({ council: myCouncil('0199d1a0-0000-7000-8000-0000000000c1', '컴퓨터학부 학생회', null) }),
  )
  councilsInSequence([myCouncil('0199d1a0-0000-7000-8000-0000000000c1', '컴퓨터학부 학생회', null)])
  openCouncil()
  await renderApp()
  expect(
    await screen.findByRole('heading', { name: '컴퓨터학부 학생회에 들어갈까요?' }),
  ).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: '들어가기' }))
  expect(await screen.findByText('운영진 3명')).toBeTruthy()
  // 방금 들어온 학생회는 운영진 화면 주소로 열린다.
  expect(window.location.pathname).toBe('/people/0199d1a0-0000-7000-8000-0000000000c1')
  expect(api.calls.find(call => call.method === 'POST')?.body).toEqual({ code: 'ABCD2345' })
})

test('이미 들어온 학생회의 초대 링크는 묻지 않고 그 학생회를 연다', async () => {
  window.history.replaceState(null, '', '/join/ABCD2345')
  api.on('GET', '/api/invites/ABCD2345', () =>
    json({
      council: { id: '0199d1a0-0000-7000-8000-0000000000c2', name: '경영학부 학생회' },
      joined: true,
    }),
  )
  councilsInSequence([
    myCouncil('0199d1a0-0000-7000-8000-0000000000c1'),
    myCouncil('0199d1a0-0000-7000-8000-0000000000c2', '경영학부 학생회'),
  ])
  openCouncil('0199d1a0-0000-7000-8000-0000000000c2', '경영학부 학생회')
  await renderApp()
  expect(await screen.findByRole('button', { name: '학생회 메뉴: 경영학부 학생회' })).toBeTruthy()
})

test('코드를 직접 입력하면 초대 확인으로 가고, 틀린 코드면 다시 입력할 수 있다', async () => {
  councilsInSequence([])
  api.on('GET', '/api/invites/ZZZZ2222', () => json({ error: 'NOT_FOUND' }, 404))
  await renderApp()
  fireEvent.change(await screen.findByLabelText('초대 코드'), {
    target: { value: 'https://vada.test/join/zzzz-2222' },
  })
  fireEvent.click(screen.getByRole('button', { name: '초대 코드로 들어가기' }))
  expect(
    await screen.findByText(
      '초대 코드가 올바르지 않아요. 바뀌었을 수 있으니 학생회에 다시 받아 주세요.',
    ),
  ).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: '다시 입력' }))
  expect(await screen.findByRole('heading', { name: '아직 들어간 학생회가 없어요' })).toBeTruthy()
})

test('지금 기수가 없는 학생회에는 들어가지 못한 까닭을 보여 준다', async () => {
  window.history.replaceState(null, '', '/join/ABCD2345')
  api.on('GET', '/api/invites/ABCD2345', () =>
    json({
      council: { id: '0199d1a0-0000-7000-8000-0000000000c1', name: '컴퓨터학부 학생회' },
      joined: false,
    }),
  )
  api.on('POST', '/api/organizations/join', () => json({ error: 'NO_CURRENT_COHORT' }, 409))
  await renderApp()
  fireEvent.click(await screen.findByRole('button', { name: '들어가기' }))
  expect(
    await screen.findByText('지금 들어갈 수 있는 기수가 없어요. 학생회 회장단에게 알려 주세요.'),
  ).toBeTruthy()
  // 들어가지 못했어도 화면은 그대로이고, 다시 눌러 볼 수 있다.
  expect(
    asElement(screen.getByRole('button', { name: '들어가기' }), HTMLButtonElement).disabled,
  ).toBe(false)
  expect(screen.getByRole('heading', { name: '컴퓨터학부 학생회에 들어갈까요?' })).toBeTruthy()
})

test('내보내진 사람의 다음 요청이 403이면 그 학생회를 닫고, 남은 학생회가 없으면 학생회 없음 안내로 돌아간다', async () => {
  councilsInSequence(
    [myCouncil('0199d1a0-0000-7000-8000-0000000000c1', '컴퓨터학부 학생회', null)],
    [],
  )
  api.on('GET', '/api/organizations/0199d1a0-0000-7000-8000-0000000000c1', () =>
    json({ error: 'FORBIDDEN' }, 403),
  )
  api.on('GET', '/api/organizations/0199d1a0-0000-7000-8000-0000000000c1/members', () =>
    json({ error: 'FORBIDDEN' }, 403),
  )
  await renderApp()
  expect(await screen.findByRole('heading', { name: '아직 들어간 학생회가 없어요' })).toBeTruthy()
  expect(api.calls.filter(call => call.path === '/api/me/councils').length).toBeGreaterThanOrEqual(
    2,
  )
})

test('학생회 이름 메뉴로 다른 학생회를 고른다', async () => {
  councilsInSequence([
    myCouncil('0199d1a0-0000-7000-8000-0000000000c1'),
    myCouncil('0199d1a0-0000-7000-8000-0000000000c2', '경영학부 학생회', null),
  ])
  openCouncil()
  openCouncil('0199d1a0-0000-7000-8000-0000000000c2', '경영학부 학생회')
  await renderApp()
  const menu = await screen.findByRole('button', { name: '학생회 메뉴: 컴퓨터학부 학생회' })
  fireEvent.keyDown(menu, { key: 'Enter' })
  fireEvent.click(await screen.findByRole('menuitem', { name: '경영학부 학생회' }))
  expect(await screen.findByRole('button', { name: '학생회 메뉴: 경영학부 학생회' })).toBeTruthy()
  await waitFor(() =>
    expect(
      api.calls.some(
        call => call.path === '/api/organizations/0199d1a0-0000-7000-8000-0000000000c2/members',
      ),
    ).toBe(true),
  )
})

test('옆 메뉴 아래 사용자 줄에 이름, 직급, 휴대폰 알림, 로그아웃이 있고 휴대폰 폭에서는 시트로 연다', async () => {
  councilsInSequence([myCouncil('0199d1a0-0000-7000-8000-0000000000c1')])
  openCouncil()
  auth.signOut.mockResolvedValue({ error: null })
  await renderApp()
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

test('옆 메뉴로 운영진 > 부서를 열고, 학생회 이름 메뉴의 설정으로 학생회 정보를 연다', async () => {
  councilsInSequence([myCouncil('0199d1a0-0000-7000-8000-0000000000c1')])
  openCouncil()
  await renderApp()
  const aside = await screen.findByRole('complementary', { name: '학생회 작업 공간' })
  fireEvent.click(within(aside).getByRole('button', { name: '부서' }))
  expect(await screen.findByRole('heading', { level: 1, name: '부서' })).toBeTruthy()
  expect(await screen.findByText('부서 2개')).toBeTruthy()
  fireEvent.keyDown(within(aside).getByRole('button', { name: '학생회 메뉴: 컴퓨터학부 학생회' }), {
    key: 'Enter',
  })
  fireEvent.click(await screen.findByRole('menuitem', { name: '설정' }))
  expect(await screen.findByRole('heading', { level: 1, name: '학생회 정보' })).toBeTruthy()
  expect(asElement(screen.getByLabelText('학교'), HTMLInputElement).value).toBe('한양대학교 ERICA')
})

// 학생회를 잃은 뒤 내 학생회 목록을 다시 읽다 실패해도(500) 그 학생회는 목록에서 빠지고, 남은 학생회나 안내로 간다.
test('내보내진 뒤 학생회 목록을 다시 읽지 못해도 그 학생회를 떠나, 남은 학생회를 연다', async () => {
  let listCalls = 0
  api.on('GET', '/api/me/councils', () =>
    listCalls++ === 0
      ? json({
          councils: [
            myCouncil('0199d1a0-0000-7000-8000-0000000000c1'),
            myCouncil('0199d1a0-0000-7000-8000-0000000000c2', '경영학부 학생회', null),
          ],
        })
      : json({ error: 'Internal server error' }, 500),
  )
  api.on('GET', '/api/organizations/0199d1a0-0000-7000-8000-0000000000c1', () =>
    json({ error: 'FORBIDDEN' }, 403),
  )
  api.on('GET', '/api/organizations/0199d1a0-0000-7000-8000-0000000000c1/members', () =>
    json({ error: 'FORBIDDEN' }, 403),
  )
  openCouncil('0199d1a0-0000-7000-8000-0000000000c2', '경영학부 학생회')
  await renderApp()
  const menu = await screen.findByRole('button', { name: '학생회 메뉴: 경영학부 학생회' })
  await waitFor(() => expect(listCalls).toBeGreaterThanOrEqual(2))
  fireEvent.keyDown(menu, { key: 'Enter' })
  const list = await screen.findByRole('menu')
  expect(
    within(list)
      .getAllByRole('menuitem')
      .map(item => item.textContent),
  ).toEqual(['경영학부 학생회', '설정'])
  fireEvent.keyDown(list, { key: 'Escape' })
  await waitFor(() => expect(screen.queryByRole('menu')).toBeNull())
  await openPeople()
  expect(await screen.findByText('운영진 3명')).toBeTruthy()
})

test('내보내진 뒤 학생회 목록을 다시 읽지 못해도 남은 학생회가 없으면 학생회 없음 안내로 돌아간다', async () => {
  let listCalls = 0
  api.on('GET', '/api/me/councils', () =>
    listCalls++ === 0
      ? json({ councils: [myCouncil('0199d1a0-0000-7000-8000-0000000000c1')] })
      : json({ error: 'Internal server error' }, 500),
  )
  api.on('GET', '/api/organizations/0199d1a0-0000-7000-8000-0000000000c1', () =>
    json({ error: 'FORBIDDEN' }, 403),
  )
  api.on('GET', '/api/organizations/0199d1a0-0000-7000-8000-0000000000c1/members', () =>
    json({ error: 'FORBIDDEN' }, 403),
  )
  await renderApp()
  expect(await screen.findByRole('heading', { name: '아직 들어간 학생회가 없어요' })).toBeTruthy()
  await waitFor(() => expect(listCalls).toBeGreaterThanOrEqual(2))
  expect(screen.queryByRole('button', { name: /학생회 메뉴/ })).toBeNull()
})

test('내보내진 뒤 다른 학생회가 남아 있으면 그 학생회로 옮긴다', async () => {
  councilsInSequence(
    [
      myCouncil('0199d1a0-0000-7000-8000-0000000000c1'),
      myCouncil('0199d1a0-0000-7000-8000-0000000000c2', '경영학부 학생회', null),
    ],
    [myCouncil('0199d1a0-0000-7000-8000-0000000000c2', '경영학부 학생회', null)],
  )
  api.on('GET', '/api/organizations/0199d1a0-0000-7000-8000-0000000000c1', () =>
    json({ error: 'FORBIDDEN' }, 403),
  )
  api.on('GET', '/api/organizations/0199d1a0-0000-7000-8000-0000000000c1/members', () =>
    json({ error: 'FORBIDDEN' }, 403),
  )
  openCouncil('0199d1a0-0000-7000-8000-0000000000c2', '경영학부 학생회')
  await renderApp()
  expect(await screen.findByRole('button', { name: '학생회 메뉴: 경영학부 학생회' })).toBeTruthy()
  await openPeople()
  expect(await screen.findByText('운영진 3명')).toBeTruthy()
  expect(screen.queryByRole('button', { name: '학생회 메뉴: 컴퓨터학부 학생회' })).toBeNull()
})

test('학생회를 불러오지 못해 다시 시도했는데 403이면 그 학생회를 떠난다', async () => {
  councilsInSequence([myCouncil('0199d1a0-0000-7000-8000-0000000000c1')], [])
  let viewCalls = 0
  api.on('GET', '/api/organizations/0199d1a0-0000-7000-8000-0000000000c1', () =>
    viewCalls++ === 0
      ? json({ error: 'Internal server error' }, 500)
      : json({ error: 'FORBIDDEN' }, 403),
  )
  api.on('GET', '/api/organizations/0199d1a0-0000-7000-8000-0000000000c1/members', () =>
    json({ error: 'FORBIDDEN' }, 403),
  )
  // 동의 읽기를 기다리지 않는다: 읽기 실패 화면은 잠깐만 떠 있다가 403으로 지워진다.
  render(<App />)
  fireEvent.click(await screen.findByRole('button', { name: '다시 시도' }))
  expect(await screen.findByRole('heading', { name: '아직 들어간 학생회가 없어요' })).toBeTruthy()
})

test('작업 공간이 열린 뒤 운영진 목록이 403이면 학생회를 다시 읽고, 운영진이 아니면 그 학생회를 떠난다', async () => {
  councilsInSequence([myCouncil('0199d1a0-0000-7000-8000-0000000000c1')], [])
  let viewCalls = 0
  api.on('GET', '/api/organizations/0199d1a0-0000-7000-8000-0000000000c1', () =>
    viewCalls++ === 0
      ? json(councilView('0199d1a0-0000-7000-8000-0000000000c1'))
      : json({ error: 'FORBIDDEN' }, 403),
  )
  let memberCalls = 0
  api.on('GET', '/api/organizations/0199d1a0-0000-7000-8000-0000000000c1/members', () =>
    memberCalls++ === 0
      ? json({ error: 'Internal server error' }, 500)
      : json({ error: 'FORBIDDEN' }, 403),
  )
  api.on('GET', '/api/organizations/0199d1a0-0000-7000-8000-0000000000c1/invite', () =>
    json({ code: 'ABCD2345' }),
  )
  emptyRooms('0199d1a0-0000-7000-8000-0000000000c1')
  await renderApp()
  await openPeople()
  fireEvent.click(await screen.findByRole('button', { name: '다시 시도' }))
  expect(await screen.findByRole('heading', { name: '아직 들어간 학생회가 없어요' })).toBeTruthy()
  expect(viewCalls).toBe(2)
})

// 로그인이 풀리면(쿠키 만료) API가 401을 준다. 서버 연결 오류로 보이지 않고 로그인 화면으로 돌아가야 한다.
test('API가 401이면 세션을 다시 읽어 로그인 화면으로 돌아간다', async () => {
  let session: { user: { id: string; name: string; email: string } } | null = {
    user: { id: 'u1', name: '김회장', email: 'kim@example.test' },
  }
  const listeners = new Set<() => void>()
  auth.refetch.mockImplementation(async () => {
    session = null
    listeners.forEach(listener => listener())
  })
  auth.useSession.mockImplementation(() => ({
    data: useSyncExternalStore(
      listener => {
        listeners.add(listener)
        return () => {
          listeners.delete(listener)
        }
      },
      () => session,
    ),
    isPending: false,
    error: null,
    refetch: auth.refetch,
  }))
  api.on('GET', '/api/me/councils', () => json({ error: 'UNAUTHENTICATED' }, 401))
  await renderApp()
  expect(await screen.findByRole('button', { name: 'Google로 로그인' })).toBeTruthy()
  expect(auth.refetch).toHaveBeenCalled()
  expect(screen.queryByText(/서버 연결을 확인해 주세요/)).toBeNull()
})

// 학생회 이름 메뉴로 고르면 작업 공간이 새로 그려진다. 키보드 사용자가 body에 떨어지지 않게 새 이름 메뉴 버튼으로 돌려놓는다.
test('학생회를 바꾸면 키보드 포커스가 새 작업 공간의 학생회 메뉴 버튼에 있다', async () => {
  councilsInSequence([
    myCouncil('0199d1a0-0000-7000-8000-0000000000c1'),
    myCouncil('0199d1a0-0000-7000-8000-0000000000c2', '경영학부 학생회', null),
  ])
  openCouncil()
  openCouncil('0199d1a0-0000-7000-8000-0000000000c2', '경영학부 학생회')
  await renderApp()
  fireEvent.keyDown(await screen.findByRole('button', { name: '학생회 메뉴: 컴퓨터학부 학생회' }), {
    key: 'Enter',
  })
  fireEvent.click(await screen.findByRole('menuitem', { name: '경영학부 학생회' }))
  const next = await screen.findByRole('button', { name: '학생회 메뉴: 경영학부 학생회' })
  await waitFor(() => expect(document.activeElement).toBe(next))
  // 메뉴를 닫을 때 Radix가 거는 지연 작업이 포커스를 도로 가져가지 않는다. 메뉴가 닫히고 그 작업이 끝난 뒤에 본다.
  await waitFor(() => expect(screen.queryByRole('menu')).toBeNull())
  await settle()
  expect(document.activeElement).toBe(next)
})

test('휴대폰 폭의 옆 메뉴(시트)에서 학생회를 바꾸면 포커스가 헤더의 메뉴 열기 버튼에 있다', async () => {
  councilsInSequence([
    myCouncil('0199d1a0-0000-7000-8000-0000000000c1'),
    myCouncil('0199d1a0-0000-7000-8000-0000000000c2', '경영학부 학생회', null),
  ])
  openCouncil()
  openCouncil('0199d1a0-0000-7000-8000-0000000000c2', '경영학부 학생회')
  await renderApp()
  await screen.findByRole('complementary', { name: '학생회 작업 공간' })
  fireEvent.click(screen.getByRole('button', { name: '메뉴 열기' }))
  const sheet = await screen.findByRole('dialog', { name: '학생회 작업 공간' })
  fireEvent.keyDown(within(sheet).getByRole('button', { name: '학생회 메뉴: 컴퓨터학부 학생회' }), {
    key: 'Enter',
  })
  fireEvent.click(await screen.findByRole('menuitem', { name: '경영학부 학생회' }))
  await screen.findByRole('button', { name: '학생회 메뉴: 경영학부 학생회' })
  await waitFor(() =>
    expect(document.activeElement).toBe(screen.getByRole('button', { name: '메뉴 열기' })),
  )
  await waitFor(() => expect(screen.queryByRole('menu')).toBeNull())
  await settle()
  expect(document.activeElement).toBe(screen.getByRole('button', { name: '메뉴 열기' }))
})

test('로그아웃에 실패해도 알림 줄은 화면 높이 안의 같은 열에 있고, 작업 공간은 남은 높이만 쓴다', async () => {
  councilsInSequence([myCouncil('0199d1a0-0000-7000-8000-0000000000c1')])
  openCouncil()
  auth.signOut.mockResolvedValue({ error: { message: 'failed' } })
  await renderApp()
  const aside = await screen.findByRole('complementary', { name: '학생회 작업 공간' })
  fireEvent.click(within(aside).getByRole('button', { name: '로그아웃' }))
  const banner = await screen.findByText('로그아웃하지 못했어요. 다시 시도해 주세요.')
  // 알림 줄과 작업 공간이 h-dvh 한 열 안에 함께 있고, 작업 공간이 그 열의 남은 높이(flex-1 min-h-0)를 쓴다.
  const column = banner.parentElement!
  expect(column.className).toContain('h-dvh')
  expect(column.className).toContain('flex-col')
  const workspace = aside.parentElement!
  expect(workspace.parentElement).toBe(column)
  expect(workspace.className).toContain('flex-1')
  expect(workspace.className).toContain('min-h-0')
  expect(workspace.className).not.toContain('h-dvh')
})

test('설정에서 학생회 이름을 바꾸면 옆 메뉴의 학생회 이름과 헤더 경로도 바뀐다', async () => {
  councilsInSequence(
    [myCouncil('0199d1a0-0000-7000-8000-0000000000c1')],
    [myCouncil('0199d1a0-0000-7000-8000-0000000000c1', '소프트웨어학부 학생회')],
  )
  openCouncil()
  api.on('POST', '/api/organizations/0199d1a0-0000-7000-8000-0000000000c1/settings', () =>
    json(councilView('0199d1a0-0000-7000-8000-0000000000c1', { name: '소프트웨어학부 학생회' })),
  )
  await renderApp()
  const aside = await screen.findByRole('complementary', { name: '학생회 작업 공간' })
  fireEvent.keyDown(within(aside).getByRole('button', { name: '학생회 메뉴: 컴퓨터학부 학생회' }), {
    key: 'Enter',
  })
  fireEvent.click(await screen.findByRole('menuitem', { name: '설정' }))
  const form = await screen.findByRole('form', { name: '학생회 정보' })
  fireEvent.change(within(form).getByLabelText('학생회 이름'), {
    target: { value: '소프트웨어학부 학생회' },
  })
  fireEvent.click(within(form).getByRole('button', { name: '학생회 정보 저장' }))
  expect(await within(form).findByText('저장했어요.')).toBeTruthy()
  expect(
    await within(aside).findByRole('button', { name: '학생회 메뉴: 소프트웨어학부 학생회' }),
  ).toBeTruthy()
  expect(screen.queryByRole('button', { name: '학생회 메뉴: 컴퓨터학부 학생회' })).toBeNull()
  expect(within(screen.getByRole('banner')).getByText('소프트웨어학부 학생회')).toBeTruthy()
  // 저장 뒤에도 보던 쪽과 입력칸은 그대로다.
  expect(asElement(within(form).getByLabelText('학생회 이름'), HTMLInputElement).value).toBe(
    '소프트웨어학부 학생회',
  )
})

// 회장 넘기기가 성공하면 작업 공간이 학생회를 "내 변경 뒤 다시 읽기"로 다시 읽는다. 그 읽기로 줄어든 권한은 알리지 않고,
// 그 읽기가 실패하거나 버려진 뒤 바깥 변경으로 줄어든 권한은 알린다(vada-docs#24). People 시험과 달리 진짜 연결을 지난다.
const LOST = '권한이 바뀌었어요. 화면을 새로 불러왔어요.'
// 학생회 GET을 차례로 답한다. 첫 번째는 회장, 그다음은 주어진 답이다.
function councilReads(...after: (() => Response | Promise<Response>)[]) {
  councilsInSequence([myCouncil('0199d1a0-0000-7000-8000-0000000000c1')])
  let reads = 0
  api.on('GET', '/api/organizations/0199d1a0-0000-7000-8000-0000000000c1', () => {
    const answer =
      reads === 0
        ? () => json(councilView('0199d1a0-0000-7000-8000-0000000000c1'))
        : after[reads - 1]!
    reads++
    return answer()
  })
  emptyRooms('0199d1a0-0000-7000-8000-0000000000c1')
  api.on('GET', '/api/organizations/0199d1a0-0000-7000-8000-0000000000c1/members', () =>
    json(teamResponse()),
  )
  api.on('GET', '/api/organizations/0199d1a0-0000-7000-8000-0000000000c1/invite', () =>
    json({ code: 'ABCD2345' }),
  )
  api.on('POST', '/api/organizations/0199d1a0-0000-7000-8000-0000000000c1/president/transfer', () =>
    json(teamResponse()),
  )
  api.on('POST', '/api/organizations/0199d1a0-0000-7000-8000-0000000000c1/invite/rotate', () =>
    json({ error: 'FORBIDDEN' }, 403),
  )
}
const demoted = () =>
  json(councilView('0199d1a0-0000-7000-8000-0000000000c1', { councilRank: null }))
const councilGets = () =>
  api.calls.filter(call => call.path === '/api/organizations/0199d1a0-0000-7000-8000-0000000000c1')
async function transferPresident() {
  await renderApp()
  await openPeople()
  fireEvent.keyDown(await screen.findByRole('button', { name: '이재정 동작' }), { key: 'Enter' })
  fireEvent.click(await screen.findByRole('menuitem', { name: '회장 넘기기' }))
  const dialog = await screen.findByRole('dialog', { name: '이재정님에게 회장 직급을 넘길까요?' })
  fireEvent.click(within(dialog).getByRole('button', { name: '넘기기' }))
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  await waitFor(() => expect(councilGets()).toHaveLength(2))
}
const rotateInvite = () =>
  fireEvent.click(
    within(screen.getByRole('region', { name: '초대 링크' })).getByRole('button', {
      name: '코드 바꾸기',
    }),
  )

test('회장 넘기기가 성공해 다시 읽은 학생회에서 내 권한이 줄어도 권한이 바뀌었다는 경고를 보이지 않는다', async () => {
  councilReads(demoted)
  await transferPresident()
  await waitFor(() => expect(screen.queryByRole('region', { name: '초대 링크' })).toBeNull())
  await settle()
  expect(screen.queryByText(LOST)).toBeNull()
})

test('회장 넘기기 뒤 다시 읽기가 실패하고 코드 바꾸기가 403이면 사라진 초대 카드의 까닭을 보인다', async () => {
  councilReads(() => json({ error: 'Internal server error' }, 500), demoted)
  await transferPresident()
  await settle()
  rotateInvite()
  await waitFor(() => expect(screen.queryByRole('region', { name: '초대 링크' })).toBeNull())
  expect(await screen.findByText(LOST)).toBeTruthy()
})

test('회장 넘기기 뒤 내 다시 읽기가 늦게 와도 버려지고, 그 사이 바깥 변경의 경고가 남는다', async () => {
  const late = deferredResponse()
  councilReads(() => late.promise, demoted)
  await transferPresident()
  rotateInvite()
  // 403 문구는 초대 카드 안에도 잠깐 보이므로, 카드가 사라진 뒤의 쪽 문구를 본다.
  await waitFor(() => expect(screen.queryByRole('region', { name: '초대 링크' })).toBeNull())
  expect(await screen.findByText(LOST)).toBeTruthy()
  late.resolve(json(councilView('0199d1a0-0000-7000-8000-0000000000c1')))
  await settle()
  expect(screen.queryByRole('region', { name: '초대 링크' })).toBeNull()
  expect(screen.getByText(LOST)).toBeTruthy()
})

test('학생회를 열면 첫 화면이 홈이고, 옆 메뉴의 대화에 안 읽은 수 합계가 보이며 99를 넘으면 99+다', async () => {
  councilsInSequence([myCouncil('0199d1a0-0000-7000-8000-0000000000c1')])
  openCouncil()
  api.on('GET', '/api/organizations/0199d1a0-0000-7000-8000-0000000000c1/rooms', () =>
    json({ rooms: [], notices: [], unreadTotal: 120, mentionTotal: 0 }),
  )
  api.on(
    'GET',
    '/api/organizations/0199d1a0-0000-7000-8000-0000000000c1/tasks?view=mine&status=open',
    () => json({ tasks: [], truncated: false }),
  )
  await renderApp()
  expect(await screen.findByRole('heading', { level: 1, name: '홈' })).toBeTruthy()
  const aside = await screen.findByRole('complementary', { name: '학생회 작업 공간' })
  expect((await within(aside).findByLabelText('안 읽은 메시지 120개')).textContent).toBe('99+')
})
