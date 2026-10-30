// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { menuPath } from '@vada/contracts'
import { resetAddress } from '@/test-support/address-reset'
import { councilView, myCouncil, teamResponse } from '@/test-support/council-fixtures'
import { homeResponse, onHomeExtras } from '@/test-support/home-fixtures'
import { deferredResponse, json, mockApi } from '@/test-support/mock-api'
import { settle } from '@/test-support/settle'
import { LEAVE_CONFIRM, LEAVE_TITLE } from '@/lib/messages'
import MyCouncils from './MyCouncils'

const FIRST = '0199d1a0-0000-7000-8000-0000000000c1'
const SECOND = '0199d1a0-0000-7000-8000-0000000000c2'
const first = myCouncil(FIRST, '총학생회')
const second = { ...myCouncil(SECOND, '총학생회'), schoolName: '다른대학교' }

afterEach(async () => {
  cleanup()
  await resetAddress()
  vi.unstubAllGlobals()
})

function open(councils = [first, second]) {
  window.history.replaceState(null, '', menuPath('home', FIRST))
  const api = mockApi()
  api.on('GET', '/api/me/councils', () => json({ councils }))
  api.on('GET', '/api/me/profile', () => json({ name: '김운영' }))
  for (const council of [first, second]) {
    const base = `/api/organizations/${council.id}`
    api.on('GET', base, () => json(councilView(council.id, { name: council.name })))
    api.on('GET', `${base}/members`, () => json(teamResponse()))
    api.on('GET', `${base}/home`, () => json(homeResponse()))
    api.on('GET', `${base}/rooms`, () =>
      json({ rooms: [], notices: [], unreadTotal: 0, mentionTotal: 0 }),
    )
    api.on('GET', `${base}/events/open`, () => json({ events: [], more: false }))
    api.on('GET', `${base}/tasks?view=mine&status=open`, () =>
      json({ tasks: [], truncated: false }),
    )
    api.on('GET', `${base}/invite`, () => json({ code: 'ABCD2345' }))
    onHomeExtras(api, {}, council.id)
  }
  render(
    <MyCouncils
      user={{ id: 'u1', name: '김운영', email: 'kim@example.test' }}
      userId="u1"
      card={content => <div>{content}</div>}
      onEnterCode={vi.fn()}
      logoutBusy={false}
      onLogout={vi.fn()}
    />,
  )
  return api
}

async function menu() {
  fireEvent.keyDown(await screen.findByRole('button', { name: 'Vada 총학생회 학생회 메뉴' }), {
    key: 'Enter',
  })
  return screen.findByRole('menu')
}

test('같은 이름의 학생회를 대표 범위로 가리고 추가 진입 두 길을 목록 아래에 둔다', async () => {
  open()
  const list = await menu()
  expect(within(list).getByRole('menuitem', { name: '총학생회 한양대학교 ERICA' })).toBeTruthy()
  expect(within(list).getByRole('menuitem', { name: '총학생회 다른대학교' })).toBeTruthy()
  expect(
    within(list)
      .getAllByRole('menuitem')
      .map(item => item.textContent),
  ).toEqual([
    '총학생회한양대학교 ERICA',
    '총학생회다른대학교',
    '초대 코드로 들어가기',
    '학생회 만들기',
    '설정',
  ])
})

test.each(['초대 코드로 들어가기', '학생회 만들기'])(
  '%s 카드와 닫기는 보던 학생회 주소를 유지한다',
  async label => {
    open()
    fireEvent.click(within(await menu()).getByRole('menuitem', { name: label }))
    expect(
      await screen.findByRole(label === '학생회 만들기' ? 'heading' : 'textbox', {
        name: label === '학생회 만들기' ? '기본 정보' : '초대 코드',
      }),
    ).toBeTruthy()
    expect(window.location.pathname).toBe(menuPath('home', FIRST))
    fireEvent.click(screen.getByRole('button', { name: '닫기' }))
    expect(await screen.findByRole('button', { name: 'Vada 총학생회 학생회 메뉴' })).toBeTruthy()
    expect(window.location.pathname).toBe(menuPath('home', FIRST))
  },
)

test('둘째 학생회를 만들다 쓴 값이 있으면 [닫기]가 먼저 묻고, 나가면 보던 학생회로 돌아간다', async () => {
  open()
  fireEvent.click(within(await menu()).getByRole('menuitem', { name: '학생회 만들기' }))
  const form = await screen.findByRole('form', { name: '학생회 만들기' })
  fireEvent.change(within(form).getByLabelText('학교'), { target: { value: '한양대학교' } })
  fireEvent.click(screen.getByRole('button', { name: '닫기' }))
  const asked = await screen.findByRole('dialog', { name: LEAVE_TITLE })
  fireEvent.click(within(asked).getAllByRole('button', { name: '닫기' })[0]!)
  await waitFor(() => expect(screen.queryByRole('dialog', { name: LEAVE_TITLE })).toBeNull())
  expect(screen.getByRole('form', { name: '학생회 만들기' })).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: '닫기' }))
  fireEvent.click(await screen.findByRole('button', { name: LEAVE_CONFIRM }))
  await waitFor(() => expect(screen.queryByRole('form', { name: '학생회 만들기' })).toBeNull())
  expect(window.location.pathname).toBe(menuPath('home', FIRST))
})

test.each([false, true])('코드 참여 뒤 그 학생회를 연다(이미 참여: %s)', async joined => {
  const api = open(joined ? [first, second] : [first])
  api.on('GET', '/api/invites/ABCD2345', () =>
    json({
      council: { ...second, cohortName: '2026' },
      joined,
    }),
  )
  api.on('POST', '/api/organizations/join', () => json({ council: second }))
  fireEvent.click(within(await menu()).getByRole('menuitem', { name: '초대 코드로 들어가기' }))
  fireEvent.change(await screen.findByRole('textbox', { name: '초대 코드' }), {
    target: { value: 'ABCD2345' },
  })
  fireEvent.click(screen.getByRole('button', { name: '초대 코드로 들어가기' }))
  if (!joined) fireEvent.click(await screen.findByRole('button', { name: '들어가기' }))
  await screen.findByRole('button', { name: 'Vada 총학생회 학생회 메뉴' })
  expect(window.location.pathname).toBe(menuPath('home', SECOND))
  expect(api.calls.filter(call => call.method === 'POST')).toHaveLength(joined ? 0 : 1)
})

test('둘째 학생회를 만들면 초대 링크 뒤 목록에 더하고 그 홈을 연다', async () => {
  const api = open([first])
  api.on('POST', '/api/organizations/create', () => json({ council: second }, 201))
  fireEvent.click(within(await menu()).getByRole('menuitem', { name: '학생회 만들기' }))
  fireEvent.change(await screen.findByLabelText('학교'), { target: { value: second.schoolName } })
  fireEvent.change(screen.getByLabelText('학생회 이름'), { target: { value: second.name } })
  fireEvent.click(screen.getByRole('button', { name: '다음: 조직 구조' }))
  fireEvent.click(await screen.findByRole('button', { name: '학생회 만들기' }))
  await screen.findByRole('heading', { name: '초대 링크' })
  expect(window.location.pathname).toBe(menuPath('home', FIRST))
  fireEvent.click(screen.getByRole('button', { name: '홈으로' }))
  await screen.findByRole('button', { name: 'Vada 총학생회 학생회 메뉴' })
  // 만들기 화면이 쓴 기록 칸을 거둔 뒤에 주소를 쌓는다.
  await waitFor(() => expect(window.location.pathname).toBe(menuPath('home', SECOND)))
})

test('다른 창에서 이미 참여해 목록에 없던 학생회도 목록을 확인해 연다', async () => {
  const api = open([first])
  const list = await menu()
  api.on('GET', '/api/me/councils', () => json({ councils: [first, second] }))
  api.on('GET', '/api/invites/ABCD2345', () =>
    json({ council: { ...second, cohortName: '2026' }, joined: true }),
  )
  fireEvent.click(within(list).getByRole('menuitem', { name: '초대 코드로 들어가기' }))
  fireEvent.change(await screen.findByLabelText('초대 코드'), { target: { value: 'ABCD2345' } })
  fireEvent.click(screen.getByRole('button', { name: '초대 코드로 들어가기' }))
  await screen.findByRole('button', { name: 'Vada 총학생회 학생회 메뉴' })
  expect(window.location.pathname).toBe(menuPath('home', SECOND))
  expect(api.calls.some(call => call.method === 'POST')).toBe(false)
})

test('참여 응답을 기다리다 닫으면 늦은 응답으로 화면을 옮기지 않는다', async () => {
  const api = open([first])
  const pending = deferredResponse()
  api.on('GET', '/api/invites/ABCD2345', () =>
    json({ council: { ...second, cohortName: '2026' }, joined: false }),
  )
  api.on('POST', '/api/organizations/join', () => pending.promise)
  fireEvent.click(within(await menu()).getByRole('menuitem', { name: '초대 코드로 들어가기' }))
  fireEvent.change(await screen.findByLabelText('초대 코드'), { target: { value: 'ABCD2345' } })
  fireEvent.click(screen.getByRole('button', { name: '초대 코드로 들어가기' }))
  fireEvent.click(await screen.findByRole('button', { name: '들어가기' }))
  fireEvent.click(screen.getByRole('button', { name: '닫기' }))
  pending.resolve(json({ council: second }))
  await settle()
  expect(await screen.findByRole('button', { name: 'Vada 총학생회 학생회 메뉴' })).toBeTruthy()
  expect(window.location.pathname).toBe(menuPath('home', FIRST))
})

test('만든 뒤 초대 링크 카드에서 닫아도 새 학생회가 고르기 목록에 남는다', async () => {
  const api = open([first])
  api.on('POST', '/api/organizations/create', () => json({ council: second }, 201))
  fireEvent.click(within(await menu()).getByRole('menuitem', { name: '학생회 만들기' }))
  fireEvent.change(await screen.findByLabelText('학교'), { target: { value: second.schoolName } })
  fireEvent.change(screen.getByLabelText('학생회 이름'), { target: { value: second.name } })
  fireEvent.click(screen.getByRole('button', { name: '다음: 조직 구조' }))
  fireEvent.click(await screen.findByRole('button', { name: '학생회 만들기' }))
  await screen.findByRole('heading', { name: '초대 링크' })
  api.on('GET', '/api/me/councils', () => json({ councils: [first, second] }))
  fireEvent.click(screen.getByRole('button', { name: '닫기' }))
  expect(window.location.pathname).toBe(menuPath('home', FIRST))
  const list = await menu()
  expect(await within(list).findByRole('menuitem', { name: '총학생회 다른대학교' })).toBeTruthy()
})

test('만들기를 취소한 뒤 코드 확인에서 돌아오면 코드 입력으로 간다', async () => {
  const api = open()
  api.on('GET', '/api/invites/ABCD2345', () => json({ error: 'NOT_FOUND' }, 404))
  fireEvent.click(within(await menu()).getByRole('menuitem', { name: '학생회 만들기' }))
  await screen.findByRole('heading', { name: '기본 정보' })
  fireEvent.click(screen.getByRole('button', { name: '이전' }))
  fireEvent.change(await screen.findByLabelText('초대 코드'), { target: { value: 'ABCD2345' } })
  fireEvent.click(screen.getByRole('button', { name: '초대 코드로 들어가기' }))
  fireEvent.click(await screen.findByRole('button', { name: '다시 입력' }))
  expect(await screen.findByLabelText('초대 코드')).toBeTruthy()
  expect(screen.queryByRole('heading', { name: '기본 정보' })).toBeNull()
})
