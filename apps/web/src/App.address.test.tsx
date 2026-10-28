import { navigationWidth } from '@/test-support/navigation-width'
// @vitest-environment jsdom
import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { koreanDateOf } from '@vada/contracts'
import { monthOf, weeksOf } from './tasks/calendar-month'
import { renderApp } from './test-support/render-app'
import { resetWindowHistory, windowHistoryIdle } from './lib/use-window-history'
import { roomList } from './test-support/chat-fixtures'
import { councilView, myCouncil, teamResponse } from './test-support/council-fixtures'
import { homeResponse, onHomeExtras } from './test-support/home-fixtures'
import { json, mockApi } from './test-support/mock-api'
import { taskDetail } from './test-support/task-detail-fixtures'
import { purchaseDetail } from './test-support/purchase-fixtures'
import { startPathOf } from './workspace/useLastAddress'

const auth = vi.hoisted(() => ({ useSession: vi.fn(), signOut: vi.fn() }))
vi.mock('./auth/auth-client', () => ({
  authClient: { useSession: auth.useSession, signIn: { social: vi.fn() }, signOut: auth.signOut },
}))

// 메뉴 v7 옮기기는 새 자리를 그리는 조각이 켠다. 시험마다 켠 것을 바꾼다.
const live = vi.hoisted(() => ({ moves: ['purchases'] as string[] }))
vi.mock('./workspace/live-moves', () => ({
  get LIVE_MOVES() {
    return live.moves
  },
}))

const C1 = '0199d1a0-0000-7000-8000-0000000000c1'
const C2 = '0199d1a0-0000-7000-8000-0000000000c2'
const T1 = '3f2b8c1e-6a4d-4e0b-9c57-1a2b3c4d5e6f'
let api: ReturnType<typeof mockApi>
const listeners: ((event: { data: unknown }) => void)[] = []

beforeEach(() => {
  live.moves = ['purchases']
  listeners.length = 0
  window.localStorage.clear()
  window.history.replaceState(null, '', '/')
  api = mockApi()
  auth.useSession.mockReturnValue({
    data: { user: { id: 'u1', name: '김회장', email: 'kim@example.test' } },
    isPending: false,
    error: null,
    refetch: vi.fn(),
  })
  Object.defineProperty(navigator, 'serviceWorker', {
    configurable: true,
    value: {
      addEventListener: (_type: string, listener: (event: { data: unknown }) => void) =>
        listeners.push(listener),
      removeEventListener: () => undefined,
    },
  })
  api.on('GET', '/api/me/councils', () =>
    json({ councils: [myCouncil(C1), myCouncil(C2, '다른 학생회')] }),
  )
  for (const id of [C1, C2]) {
    api.on('GET', `/api/organizations/${id}`, () => json(councilView(id)))
    api.on('GET', `/api/organizations/${id}/members`, () => json(teamResponse()))
    api.on('GET', `/api/organizations/${id}/rooms`, () => json(roomList()))
    api.on('GET', `/api/organizations/${id}/home`, () => json(homeResponse()))
    onHomeExtras(api, {}, id)
    for (const taskScope of ['mine', 'all'])
      api.on(
        'GET',
        `/api/organizations/${id}/tasks?view=${taskScope}&status=open${taskScope === 'all' ? '&event=none' : ''}`,
        () => json({ tasks: [], truncated: false }),
      )
    api.on('GET', `/api/organizations/${id}/tasks/${T1}`, () =>
      json({ task: taskDetail({ title: '현수막 주문' }) }),
    )
  }
})
afterEach(async () => {
  cleanup()
  // 닫힌 창이 거두는 기록 이동(history.go)이 끝난 뒤에 다음 시험이 시작되게 한다.
  await windowHistoryIdle()
  resetWindowHistory()
  Reflect.deleteProperty(navigator, 'serviceWorker')
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

const aside = () => screen.getByRole('complementary', { name: '학생회 작업 공간', hidden: true })
const menu = (name: string | RegExp) => within(aside()).getByRole('button', { name, hidden: true })
const heading = (name: string) => screen.findByRole('heading', { level: 1, name, hidden: true })
const council = (id: string) => api.calls.filter(call => call.path === `/api/organizations/${id}`)
const pathNow = () => window.location.pathname + window.location.search
// 기록 칸 수는 history.length로 못 센다(뒤로 간 뒤 쌓으면 앞 칸이 지워진다). 쌓은 횟수를 센다.
const pushes = () => vi.spyOn(window.history, 'pushState')
const taskOpen = () =>
  waitFor(() => expect(screen.getByRole('dialog', { name: '현수막 주문' })).toBeTruthy())

test('주소가 없는 시작은 첫 학생회 홈 주소가 된다', async () => {
  await renderApp()
  expect(await heading('홈')).toBeTruthy()
  expect(pathNow()).toBe(`/home/${C1}`)
})

test('일정 기록 주소는 캘린더 메뉴를 열고 주소를 보존한다', async () => {
  live.moves = ['purchases', 'calendar']
  window.history.replaceState(null, '', `/schedule/${C1}/${T1}`)
  await renderApp()
  expect(await heading('캘린더')).toBeTruthy()
  expect(pathNow()).toBe(`/schedule/${C1}/${T1}`)
  expect(menu('캘린더').getAttribute('aria-current')).toBe('page')
})

const LAST = 'vada.last.address.u1'

test('/로 열면 이 기기가 마지막에 본 학생회 안 주소로 바꿔 쓴다', async () => {
  window.localStorage.setItem(LAST, `/tasks/${C2}?view=all`)
  const push = pushes()
  await renderApp()
  expect(await heading('학생회 업무')).toBeTruthy()
  expect(pathNow()).toBe(`/tasks/${C2}?view=all`)
  expect(push).not.toHaveBeenCalled()
  expect(council(C1)).toEqual([])
})

test('마지막 주소의 학생회를 잃었거나 기억이 없으면 첫 학생회 홈이 열린다', async () => {
  window.localStorage.setItem(LAST, '/tasks/0199d1a0-0000-7000-8000-0000000000c9?view=all')
  await renderApp()
  expect(await heading('홈')).toBeTruthy()
  expect(pathNow()).toBe(`/home/${C1}`)
})

test('/가 아닌 주소로 열면 마지막 주소를 쓰지 않는다', async () => {
  window.localStorage.setItem(LAST, `/tasks/${C2}`)
  window.history.replaceState(null, '', `/people/${C1}`)
  await renderApp()
  expect(await heading('조직')).toBeTruthy()
  expect(pathNow()).toBe(`/people/${C1}`)
})

test('보는 곳이 바뀔 때마다 마지막 주소를 기억한다', async () => {
  await renderApp()
  expect(await heading('홈')).toBeTruthy()
  expect(window.localStorage.getItem(LAST)).toBe(`/home/${C1}`)
  fireEvent.click(menu('조직'))
  expect(await heading('조직')).toBeTruthy()
  expect(window.localStorage.getItem(LAST)).toBe(`/people/${C1}`)
})

test('찾을 수 없는 주소와 다른 사람의 학생회 주소는 기억하지 않는다', async () => {
  window.localStorage.setItem(LAST, `/home/${C1}`)
  window.history.replaceState(null, '', '/tasks/0199d1a0-0000-7000-8000-0000000000c9')
  await renderApp()
  expect(await screen.findByText('찾을 수 없음')).toBeTruthy()
  expect(window.localStorage.getItem(LAST)).toBe(`/home/${C1}`)
})

test('메뉴를 누르면 주소가 바뀌고 브라우저 뒤로가 앞 메뉴로 간다', async () => {
  await renderApp()
  expect(await heading('홈')).toBeTruthy()
  fireEvent.click(menu('조직'))
  expect(await heading('조직')).toBeTruthy()
  expect(pathNow()).toBe(`/people/${C1}`)
  act(() => window.history.back())
  expect(await heading('홈')).toBeTruthy()
  expect(pathNow()).toBe(`/home/${C1}`)
})

test('새로 고침하면 주소의 학생회와 메뉴가 열린다', async () => {
  window.history.replaceState(null, '', `/departments/${C2}`)
  await renderApp()
  expect(await heading('조직')).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Vada 다른 학생회 학생회 메뉴' })).toBeTruthy()
  expect(council(C1)).toEqual([])
})

// 옛 부서 주소는 사람 주소와 같은 조직 화면이고, 옆 메뉴는 '조직' 한 칸이 켜진다(DEC-91, DEC-96).
test('옆 메뉴의 조직 한 칸은 사람 주소와 옛 부서 주소 모두에서 켜지고, 누르면 사람 주소로 간다', async () => {
  window.history.replaceState(null, '', `/departments/${C1}`)
  await renderApp()
  expect(await heading('조직')).toBeTruthy()
  expect(menu('조직').getAttribute('aria-current')).toBe('page')
  expect(within(aside()).queryByRole('button', { name: '사람', hidden: true })).toBeNull()
  expect(within(aside()).queryByRole('button', { name: '부서', hidden: true })).toBeNull()
  expect(within(aside()).queryByText('운영진')).toBeNull()
  fireEvent.click(menu('조직'))
  await waitFor(() => expect(pathNow()).toBe(`/people/${C1}`))
  expect(await heading('조직')).toBeTruthy()
  expect(menu('조직').getAttribute('aria-current')).toBe('page')
})

test('열린 메뉴를 다시 누르면 칸이 늘지 않고, 다른 메뉴를 누르면 늘어난다', async () => {
  await renderApp()
  expect(await heading('홈')).toBeTruthy()
  const push = pushes()
  fireEvent.click(menu('홈'))
  fireEvent.click(menu('홈'))
  expect(push).toHaveBeenCalledTimes(0)
  fireEvent.click(menu('조직'))
  expect(await heading('조직')).toBeTruthy()
  expect(push).toHaveBeenCalledTimes(1)
  fireEvent.click(menu('조직'))
  expect(push).toHaveBeenCalledTimes(1)
})

test('첫 화면이 아닌 메뉴 주소에서 그 메뉴를 다시 누르면 첫 화면으로 한 칸 쌓는다', async () => {
  window.history.replaceState(null, '', `/tasks/${C1}?view=all`)
  await renderApp()
  expect(await heading('학생회 업무')).toBeTruthy()
  const push = pushes()
  fireEvent.click(menu(/^업무/))
  expect(push).toHaveBeenCalledTimes(1)
  expect(pathNow()).toBe(`/tasks/${C1}`)
})

test('학생회를 바꾸면 그 학생회 홈 주소로 한 칸 쌓인다', async () => {
  window.history.replaceState(null, '', `/people/${C1}`)
  await renderApp()
  expect(await heading('조직')).toBeTruthy()
  const push = pushes()
  fireEvent.keyDown(screen.getByRole('button', { name: 'Vada 컴퓨터학부 학생회 학생회 메뉴' }), {
    key: 'Enter',
  })
  fireEvent.click(await screen.findByRole('menuitem', { name: '다른 학생회 한양대학교 ERICA' }))
  expect(await heading('홈')).toBeTruthy()
  expect(pathNow()).toBe(`/home/${C2}`)
  expect(push).toHaveBeenCalledTimes(1)
})

test('열린 창에서 알림을 누르면 그 주소로 한 칸 쌓이고 학생회를 다시 읽지 않는다', async () => {
  await renderApp()
  expect(await heading('홈')).toBeTruthy()
  const reads = council(C1).length
  const push = pushes()
  act(() => listeners[0]!({ data: { type: 'vada:open', url: `/tasks/${C1}/${T1}?x=1#y` } }))
  await taskOpen()
  expect(pathNow()).toBe(`/tasks/${C1}/${T1}`)
  expect(push).toHaveBeenCalledTimes(1)
  expect(council(C1).length).toBe(reads)
})

test('모르는 주소는 찾을 수 없음이고 상위 목록으로 가는 버튼이 있다', async () => {
  window.history.replaceState(null, '', `/tasks/${C1}/not-a-uuid`)
  await renderApp()
  expect(await screen.findByText('찾을 수 없음')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: '홈으로' }))
  expect(await heading('홈')).toBeTruthy()
  expect(pathNow()).toBe(`/home/${C1}`)
})

test.each([
  `/tasks/0199d1a0-0000-7000-8000-0000000000ee/${T1}`,
  '/council/0199d1a0-0000-7000-8000-0000000000ee',
])('다른 학생회 %s는 찾을 수 없음이고 홈으로 간 뒤 서랍을 닫아도 홈이다', async path => {
  window.history.replaceState(null, '', path)
  navigationWidth()
  await renderApp()
  fireEvent.click(await screen.findByRole('button', { name: '홈으로' }))
  expect(await heading('홈')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: '메뉴' }))
  const sheet = await screen.findByRole('dialog', { name: '학생회 작업 공간' })
  fireEvent.keyDown(sheet, { key: 'Escape' })
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  await windowHistoryIdle()
  expect(pathNow()).toBe(`/home/${C1}`)
})

test('기록 주소로 바로 들어오면 상위 목록 칸이 깔려 뒤로가 목록으로 간다', async () => {
  window.history.replaceState(null, '', `/tasks/${C1}/${T1}`)
  const push = pushes()
  await renderApp()
  await taskOpen()
  // 목록 칸으로 바꿔 쓰고 그 위에 기록 칸을 한 칸 쌓는다. 상세 창은 그 칸을 자기 칸으로 써서 더 쌓지 않는다.
  expect(push).toHaveBeenCalledTimes(1)
  expect(pathNow()).toBe(`/tasks/${C1}/${T1}`)
  act(() => window.history.back())
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  expect(pathNow()).toBe(`/tasks/${C1}`)
  expect(await heading('학생회 업무')).toBeTruthy()
})

test('/로 열었는데 마지막 주소가 기록이면 바로 들어온 기록처럼 목록 칸이 깔려 뒤로가 목록으로 간다', async () => {
  window.localStorage.setItem(LAST, `/tasks/${C1}/${T1}`)
  const push = pushes()
  await renderApp()
  await taskOpen()
  expect(push).toHaveBeenCalledTimes(1)
  expect(pathNow()).toBe(`/tasks/${C1}/${T1}`)
  act(() => window.history.back())
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  expect(pathNow()).toBe(`/tasks/${C1}`)
  expect(await heading('학생회 업무')).toBeTruthy()
  expect(window.localStorage.getItem(LAST)).toBe(`/tasks/${C1}`)
})

test('마지막 구매 상세를 /에서 복원하면 뒤로가 구매 목록으로 바로 돌아간다', async () => {
  window.localStorage.setItem(LAST, `/purchases/${C1}/${T1}`)
  api.on('GET', `/api/organizations/${C1}/purchase-requests/${T1}`, () =>
    json({ request: purchaseDetail(T1, { title: '테이프 구매' }) }),
  )
  api.on('GET', `/api/organizations/${C1}/purchase-requests?view=mine`, () =>
    json({ requests: [], truncated: false }),
  )
  const replace = vi.spyOn(window.history, 'replaceState')
  await renderApp()
  expect(await heading('테이프 구매')).toBeTruthy()
  const reads = council(C1).length
  replace.mockClear()
  act(() => window.history.back())
  expect(await heading('구매')).toBeTruthy()
  expect(pathNow()).toBe(`/purchases/${C1}`)
  expect(replace.mock.calls.some(([, , path]) => String(path).startsWith('/finance/'))).toBe(false)
  expect(council(C1).length).toBe(reads)
  expect(window.localStorage.getItem(LAST)).toBe(`/purchases/${C1}`)
})

test('새로 고침으로 되살린 창은 칸을 더 쌓지 않는다', async () => {
  window.history.replaceState(null, '', `/tasks/${C1}/${T1}`)
  await renderApp()
  await taskOpen()
  // 새로 고침: 문서가 새로 열려도 기록 칸과 그 상태는 그대로다. 이 칸은 이미 주소 층이 쌓은 칸이다.
  // 화면을 내리면 창이 자기 칸을 거두므로, 그 칸으로 다시 가서 새 문서처럼 연다.
  cleanup()
  await windowHistoryIdle()
  act(() => window.history.forward())
  await waitFor(() => expect(pathNow()).toBe(`/tasks/${C1}/${T1}`))
  const state: unknown = window.history.state
  const push = pushes()
  await renderApp()
  await taskOpen()
  expect(push).toHaveBeenCalledTimes(0)
  expect(window.history.state).toEqual(state)
})

test('창을 연 채 메뉴로 가도 뒤로가 두 번 걸리지 않는다', async () => {
  await renderApp()
  expect(await heading('홈')).toBeTruthy()
  act(() => listeners[0]!({ data: { type: 'vada:open', url: `/tasks/${C1}/${T1}` } }))
  await taskOpen()
  fireEvent.click(menu('조직'))
  expect(await heading('조직')).toBeTruthy()
  await windowHistoryIdle()
  expect(pathNow()).toBe(`/people/${C1}`)
  act(() => window.history.back())
  expect(await heading('홈')).toBeTruthy()
  expect(pathNow()).toBe(`/home/${C1}`)
})

// 메뉴 v7(설계 2.2): 옛 주소는 새 자리로 바꿔 쓰고(replace), 아직 그리지 않은 새 메뉴는 지금 그 일을 그리는 곳으로 바꿔 쓴다.
test('옮기기를 켜면 옛 주소는 칸을 쌓지 않고 새 주소로 바꿔 쓰여 뒤로가 옛 주소로 가지 않는다', async () => {
  live.moves = ['chat']
  await renderApp()
  expect(await heading('홈')).toBeTruthy()
  const push = pushes()
  act(() => window.history.pushState(null, '', `/council/${C1}`))
  act(() => {
    window.dispatchEvent(new PopStateEvent('popstate'))
  })
  await waitFor(() => expect(pathNow()).toBe(`/chat/${C1}`))
  expect(push).toHaveBeenCalledTimes(1)
  act(() => window.history.back())
  await waitFor(() => expect(pathNow()).toBe(`/home/${C1}`))
})

test('옮기기를 켜기 전에는 옛 주소가 지금 화면을 그대로 연다', async () => {
  window.history.replaceState(null, '', `/tasks/${C1}?view=all`)
  await renderApp()
  expect(await heading('학생회 업무')).toBeTruthy()
  expect(pathNow()).toBe(`/tasks/${C1}?view=all`)
})

test('마지막 주소가 옛 꼴이면 /로 열 때 새 주소로 연다', async () => {
  live.moves = ['tasks']
  window.localStorage.setItem(LAST, `/council/${C2}?tab=tasks&view=mine`)
  const push = pushes()
  await renderApp()
  expect(await heading('내 업무')).toBeTruthy()
  expect(pathNow()).toBe(`/tasks/${C2}?tab=mine`)
  expect(push).not.toHaveBeenCalled()
})

test('구매 옮기기를 켜도 마지막 주소의 내 요청 보기는 역할별 기본값으로 바뀌지 않는다', () => {
  live.moves = ['purchases']
  window.localStorage.setItem(LAST, `/finance/${C1}?tab=requests&view=mine`)
  expect(startPathOf('u1', [myCouncil(C1)])).toBe(`/purchases/${C1}?view=mine`)
})

test('아직 그리지 않은 캘린더 주소는 업무 달력으로 바꿔 쓴다', async () => {
  window.history.replaceState(null, '', `/calendar/${C1}`)
  const push = pushes()
  await renderApp()
  await waitFor(() => expect(pathNow()).toBe(`/tasks/${C1}?layout=calendar`))
  expect(await heading('학생회 업무')).toBeTruthy()
  expect(push).not.toHaveBeenCalled()
})

test.each([`/calendar/${C1}`, `/tasks/${C1}?layout=calendar`])(
  '캘린더를 켜면 %s는 캘린더 본문과 메뉴를 열고 옛 주소를 남기지 않는다',
  async path => {
    live.moves = ['calendar']
    const days = weeksOf(monthOf(koreanDateOf(new Date()))).flat()
    const calendarPath = `/api/organizations/${C1}/calendar?from=${days[0]}&to=${days[days.length - 1]}`
    api.on('GET', calendarPath, () => json({ items: [], truncated: false }))
    window.history.replaceState(null, '', path)
    const push = pushes()
    await renderApp()
    expect(await heading('캘린더')).toBeTruthy()
    expect(await screen.findByRole('group', { name: '일정 유형' })).toBeTruthy()
    expect(menu('캘린더').getAttribute('aria-current')).toBe('page')
    expect(pathNow()).toBe(`/calendar/${C1}`)
    expect(push).not.toHaveBeenCalled()
    await waitFor(() => expect(api.calls.some(call => call.path === calendarPath)).toBe(true))
    expect(
      api.calls.some(call =>
        [
          `/api/organizations/${C1}/tasks?view=all&status=open`,
          `/api/organizations/${C1}/events`,
        ].includes(call.path),
      ),
    ).toBe(false)
  },
)

test('캘린더의 목록·종류 선택 주소는 새로 열어도 유지된다', async () => {
  live.moves = ['calendar']
  const days = weeksOf(monthOf(koreanDateOf(new Date()))).flat()
  api.on(
    'GET',
    `/api/organizations/${C1}/calendar?from=${days[0]}&to=${days[days.length - 1]}`,
    () => json({ items: [], truncated: false }),
  )
  window.history.replaceState(null, '', `/calendar/${C1}?view=list&kind=deadline`)
  await renderApp()
  expect(await screen.findByText('이 달 일정 없음')).toBeTruthy()
  expect(pathNow()).toBe(`/calendar/${C1}?view=list&kind=deadline`)
  expect(screen.getByRole('button', { name: '목록' }).getAttribute('aria-pressed')).toBe('true')
  expect(
    within(screen.getByRole('group', { name: '일정 유형' }))
      .getByRole('button', { name: '마감' })
      .getAttribute('aria-pressed'),
  ).toBe('true')
})

test('구매 주소는 구매 목록을 열고 마지막 주소도 구매로 남긴다', async () => {
  window.localStorage.setItem(LAST, `/purchases/${C2}?view=all`)
  await renderApp()
  await waitFor(() => expect(pathNow()).toBe(`/purchases/${C2}?view=all`))
  expect(await heading('구매')).toBeTruthy()
})

test.each([
  ['?tab=requests&view=all', '?view=all'],
  ['?tab=requests', '?view=mine'],
])('옛 구매 목록 주소 %s는 새 구매 메뉴 %s로 바꿔 쓴다', async (oldQuery, newQuery) => {
  window.history.replaceState(null, '', `/finance/${C1}${oldQuery}`)
  const push = pushes()
  await renderApp()
  expect(await heading('구매')).toBeTruthy()
  expect(pathNow()).toBe(`/purchases/${C1}${newQuery}`)
  expect(push).not.toHaveBeenCalled()
})

test('옛 요청 작성 주소는 구매 작성으로 바꿔 쓴다', async () => {
  window.history.replaceState(null, '', `/finance/${C1}/requests/new`)
  const push = pushes()
  await renderApp()
  await screen.findByRole('form', { name: '구매 요청 내기' })
  expect(pathNow()).toBe(`/purchases/${C1}/new`)
  expect(push).not.toHaveBeenCalled()
})
