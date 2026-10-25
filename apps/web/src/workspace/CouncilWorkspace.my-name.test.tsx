// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { CouncilView, TeamResponse } from '@vada/contracts'
import { councilView, MEMBER_PERMISSIONS, teamResponse } from '@/test-support/council-fixtures'
import { roomList } from '@/test-support/chat-fixtures'
import { deferredResponse, json, mockApi } from '@/test-support/mock-api'
import { COUNCIL_ID, WorkspaceAt } from '@/test-support/workspace-at'

afterEach(() => {
  cleanup()
  window.history.replaceState(null, '', '/')
  vi.unstubAllGlobals()
})

const base = `/api/organizations/${COUNCIL_ID}`

// 옆 메뉴 아래 사용자 줄은 Google 이름(김회장)이 아니라 운영진 이름이다. 서버는 이름을 바꾼 뒤의 학생회와 운영진 목록을 돌려준다.
// demotedAfterRename이면 이름을 바꾸는 사이 다른 회장단이 내 직급을 거둔 것이다(바깥 변경).
function open({ demotedAfterRename = false } = {}) {
  const api = mockApi()
  let name = '김바다'
  let renamed = false
  const view = (): CouncilView => {
    const base =
      demotedAfterRename && renamed
        ? councilView(COUNCIL_ID, { councilRank: null, permissions: MEMBER_PERMISSIONS })
        : councilView(COUNCIL_ID)
    return { ...base, me: { ...base.me, name } }
  }
  const team = (): TeamResponse => {
    const base = teamResponse()
    return {
      ...base,
      members: base.members.map(member => (member.id === 'm1' ? { ...member, name } : member)),
    }
  }
  api.on('GET', base, () => json(view()))
  api.on('GET', `${base}/members`, () => json(team()))
  api.on('GET', `${base}/invite`, () => json({ code: 'ABCD2345' }))
  api.on('GET', `${base}/rooms`, () => json(roomList()))
  api.on('GET', `${base}/tasks?view=mine&status=open`, () => json({ tasks: [], truncated: false }))
  api.on('GET', `${base}/purchase-requests?view=pending`, () =>
    json({ requests: [], truncated: false }),
  )
  api.on('POST', '/api/me/profile', call => {
    name = (call.body as { name: string }).name.trim()
    renamed = true
    return json({ name })
  })
  render(<WorkspaceAt startPage="people" />)
  return api
}

// 옆 메뉴는 데스크톱 aside에 늘 있고, 휴대폰 시트는 열 때만 그린다.
const footer = () => screen.getByRole('complementary')

test('사용자 줄은 운영진 이름이고, 누르면 내 이름 창에서 고쳐 사용자 줄과 운영진 목록이 새 이름이다', async () => {
  const api = open()
  await within(await screen.findByRole('list', { name: '운영진' })).findByText('김바다')
  const button = await within(footer()).findByRole('button', { name: '내 이름: 김바다, 회장' })
  expect(within(footer()).queryByText('김회장')).toBeNull()
  fireEvent.click(button)
  const dialog = await screen.findByRole('dialog', { name: '내 이름' })
  const field = within(dialog).getByLabelText<HTMLInputElement>('내 이름')
  expect(field.value).toBe('김바다')
  fireEvent.change(field, { target: { value: '김새이름' } })
  fireEvent.click(within(dialog).getByRole('button', { name: '이름 저장' }))
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  expect(api.calls.find(call => call.method === 'POST')?.body).toEqual({ name: '김새이름' })
  expect(
    await within(footer()).findByRole('button', { name: '내 이름: 김새이름, 회장' }),
  ).toBeTruthy()
  await within(screen.getByRole('list', { name: '운영진' })).findByText('김새이름')
})

test('같은 이름으로 저장하면 요청 없이 닫고, 닫기는 바꾸지 않는다', async () => {
  const api = open()
  fireEvent.click(await within(footer()).findByRole('button', { name: '내 이름: 김바다, 회장' }))
  let dialog = await screen.findByRole('dialog', { name: '내 이름' })
  fireEvent.change(within(dialog).getByLabelText('내 이름'), { target: { value: ' 김바다 ' } })
  fireEvent.click(within(dialog).getByRole('button', { name: '이름 저장' }))
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  fireEvent.click(within(footer()).getByRole('button', { name: '내 이름: 김바다, 회장' }))
  dialog = await screen.findByRole('dialog', { name: '내 이름' })
  fireEvent.change(within(dialog).getByLabelText('내 이름'), { target: { value: '다른 이름' } })
  fireEvent.click(within(dialog).getAllByRole('button', { name: '닫기' })[0]!)
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  expect(within(footer()).getByRole('button', { name: '내 이름: 김바다, 회장' })).toBeTruthy()
  expect(api.calls.some(call => call.method === 'POST')).toBe(false)
})

test('내 이름을 비우면 칸 아래에 알리고 보내지 않는다', async () => {
  const api = open()
  fireEvent.click(await within(footer()).findByRole('button', { name: '내 이름: 김바다, 회장' }))
  const dialog = await screen.findByRole('dialog', { name: '내 이름' })
  fireEvent.change(within(dialog).getByLabelText('내 이름'), { target: { value: '' } })
  fireEvent.click(within(dialog).getByRole('button', { name: '이름 저장' }))
  expect(await within(dialog).findByText('이름을 입력해 주세요')).toBeTruthy()
  expect(api.calls.some(call => call.method === 'POST')).toBe(false)
})

test('저장하지 못하면 창 안에 알리고 창은 그대로다', async () => {
  const api = open()
  api.on('POST', '/api/me/profile', () => json({ error: 'x' }, 500))
  fireEvent.click(await within(footer()).findByRole('button', { name: '내 이름: 김바다, 회장' }))
  const dialog = await screen.findByRole('dialog', { name: '내 이름' })
  fireEvent.change(within(dialog).getByLabelText('내 이름'), { target: { value: '김새이름' } })
  fireEvent.click(within(dialog).getByRole('button', { name: '이름 저장' }))
  expect(await within(dialog).findByText('저장하지 못했어요. 다시 시도해 주세요.')).toBeTruthy()
})

test('이름을 바꾸는 사이 다른 사람이 내 권한을 바꿨으면 권한이 바뀌었다고 알린다', async () => {
  open({ demotedAfterRename: true })
  await screen.findByRole('button', { name: '코드 바꾸기' })
  fireEvent.click(await within(footer()).findByRole('button', { name: '내 이름: 김바다, 회장' }))
  const dialog = await screen.findByRole('dialog', { name: '내 이름' })
  fireEvent.change(within(dialog).getByLabelText('내 이름'), { target: { value: '김새이름' } })
  fireEvent.click(within(dialog).getByRole('button', { name: '이름 저장' }))
  expect(await screen.findByText('권한이 바뀌었어요. 화면을 새로 불러왔어요.')).toBeTruthy()
})

test('창에서 Enter로도 저장한다', async () => {
  const api = open()
  fireEvent.click(await within(footer()).findByRole('button', { name: '내 이름: 김바다, 회장' }))
  const dialog = await screen.findByRole('dialog', { name: '내 이름' })
  fireEvent.change(within(dialog).getByLabelText('내 이름'), { target: { value: '김새이름' } })
  fireEvent.submit(within(dialog).getByRole('form', { name: '내 이름 고치기' }))
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  expect(api.calls.find(call => call.method === 'POST')?.body).toEqual({ name: '김새이름' })
})

test('학생회를 읽기 전에는 사용자 줄이 로그인 이름 글이고 누르는 버튼이 없다', async () => {
  const api = mockApi()
  api.on('GET', base, () => deferredResponse().promise)
  api.on('GET', `${base}/members`, () => deferredResponse().promise)
  api.on('GET', `${base}/rooms`, () => json(roomList()))
  api.on('GET', `${base}/tasks?view=mine&status=open`, () => json({ tasks: [], truncated: false }))
  api.on('GET', `${base}/purchase-requests?view=pending`, () =>
    json({ requests: [], truncated: false }),
  )
  render(<WorkspaceAt startPage="people" />)
  expect(await within(footer()).findByText('김회장')).toBeTruthy()
  expect(within(footer()).queryByRole('button', { name: /^내 이름/ })).toBeNull()
})
