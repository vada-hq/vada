// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { Action, TeamResponse } from '@vada/contracts'
import { councilView, LEADER_PERMISSIONS, MEMBER_PERMISSIONS, PRESIDENT_PERMISSIONS, teamResponse } from '@/test-support/council-fixtures'
import { json, mockApi } from '@/test-support/mock-api'
import People from './People'
import { useTeam } from './useTeam'

afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks() })
const titles = { president: '위원장', vicePresident: '부위원장', head: '국장', viceHead: '차장' }

function Harness({ permissions, onCouncilChanged = () => {} }: { permissions: Action[]; onCouncilChanged?: () => void }) {
  const team = useTeam('c1', () => {})
  const base = councilView('c1', { permissions })
  return <People view={{ ...base, council: { ...base.council, titles } }} team={team} onCouncilChanged={onCouncilChanged} />
}
function serve(team: TeamResponse = teamResponse()) {
  const api = mockApi()
  api.on('GET', '/api/organizations/c1/members', () => json(team))
  api.on('GET', '/api/organizations/c1/invite', () => json({ code: 'ABCD2345' }))
  return api
}
// 대화상자가 열리면 뒤의 목록은 숨겨진다(aria-hidden). 그래도 줄의 글을 본다.
const row = (name: string) => screen.getAllByRole('listitem', { hidden: true }).find(item => item.textContent?.startsWith(name))!
async function openMenu(name: string) {
  fireEvent.keyDown(await screen.findByRole('button', { name: `${name} 동작` }), { key: 'Enter' })
  return screen.findByRole('menu')
}

test('운영진 목록은 들어온 순서대로 이름, 학생회가 정한 직급 이름, 부서와 부서 직급, 들어온 날을 보이고 이메일은 없다', async () => {
  serve()
  render(<Harness permissions={MEMBER_PERMISSIONS} />)
  expect(await screen.findByText('운영진 3명')).toBeTruthy()
  expect(within(screen.getByRole('list', { name: '운영진' })).getAllByRole('listitem').map(item => item.textContent)).toEqual([
    '김회장위원장부서 없음 · 2026.10.01 들어옴',
    '이재정재정부 국장 · 2026.10.02 들어옴',
    '박새내부서 없음 · 2026.10.19 들어옴',
  ])
  expect(document.body.textContent).not.toContain('@')
})

test('직급 없는 운영진은 초대 링크와 ⋯ 메뉴를 보지 않고 서버에 초대 코드를 묻지 않는다', async () => {
  const api = serve()
  render(<Harness permissions={MEMBER_PERMISSIONS} />)
  await screen.findByText('운영진 3명')
  expect(screen.queryByRole('region', { name: '초대 링크' })).toBeNull()
  expect(screen.queryByRole('button', { name: /동작$/ })).toBeNull()
  expect(api.calls.some(call => call.path.endsWith('/invite'))).toBe(false)
})

test('회장단은 초대 링크를 복사하고 코드를 바꾼다. 바꾸면 새 링크를 보여 주고 옛 링크는 막혔다고 알린다', async () => {
  const api = serve()
  api.on('POST', '/api/organizations/c1/invite/rotate', () => json({ code: 'WXYZ6789' }))
  const writeText = vi.fn(async (_text: string) => {})
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
  render(<Harness permissions={LEADER_PERMISSIONS} />)
  const card = await screen.findByRole('region', { name: '초대 링크' })
  expect((within(card).getByLabelText('초대 링크') as HTMLInputElement).value).toBe(`${window.location.origin}/join/ABCD2345`)
  fireEvent.click(within(card).getByRole('button', { name: '링크 복사' }))
  expect(await within(card).findByText('초대 링크를 복사했어요. 단톡방에 붙여 넣어 주세요.')).toBeTruthy()
  expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/join/ABCD2345`)
  fireEvent.click(within(card).getByRole('button', { name: '코드 바꾸기' }))
  expect(await within(card).findByText('코드를 바꿨어요. 옛 링크로는 이제 들어올 수 없어요.')).toBeTruthy()
  expect((within(card).getByLabelText('초대 링크') as HTMLInputElement).value).toBe(`${window.location.origin}/join/WXYZ6789`)
})

test('회장단의 ⋯ 메뉴: 회장 줄에는 직급과 내보내기가 없고, 내 줄에는 내보내기가 없고, 회장 넘기기는 회장에게만 있다', async () => {
  serve()
  render(<Harness permissions={LEADER_PERMISSIONS} />)
  let menu = await openMenu('김회장')
  expect(within(menu).getAllByRole('menuitem').map(item => item.textContent)).toEqual(['부서 배정'])
  fireEvent.keyDown(menu, { key: 'Escape' })
  menu = await openMenu('이재정')
  expect(within(menu).getAllByRole('menuitem').map(item => item.textContent)).toEqual(['부서 배정', '부위원장 직급 주기', '내보내기'])
  cleanup()
  serve()
  render(<Harness permissions={PRESIDENT_PERMISSIONS} />)
  menu = await openMenu('이재정')
  expect(within(menu).getAllByRole('menuitem').map(item => item.textContent)).toEqual(['부서 배정', '부위원장 직급 주기', '위원장 넘기기', '내보내기'])
})

test('부서 배정 대화상자에서 부서와 부서 직급을 정하고, 부서에서 뺀다', async () => {
  const api = serve()
  const assigned = teamResponse()
  assigned.members[2]!.departments = [{ id: 'd2', rank: 'vice_head' }]
  api.on('POST', '/api/organizations/c1/members/m3/departments', () => json(assigned))
  api.on('POST', '/api/organizations/c1/members/m3/departments/d2/remove', () => json(teamResponse()))
  render(<Harness permissions={LEADER_PERMISSIONS} />)
  fireEvent.click(within(await openMenu('박새내')).getByRole('menuitem', { name: '부서 배정' }))
  const dialog = await screen.findByRole('dialog', { name: '박새내의 부서' })
  fireEvent.change(within(dialog).getByLabelText('부서'), { target: { value: 'd2' } })
  fireEvent.change(within(dialog).getByLabelText('부서 직급'), { target: { value: 'vice_head' } })
  fireEvent.click(within(dialog).getByRole('button', { name: '부서에 넣기' }))
  expect(await within(dialog).findByLabelText('기획부 부서 직급')).toBeTruthy()
  expect(api.calls.find(call => call.path.endsWith('/members/m3/departments'))?.body).toEqual({ departmentId: 'd2', rank: 'vice_head' })
  expect(row('박새내').textContent).toContain('기획부 차장')
  fireEvent.click(within(dialog).getByRole('button', { name: '기획부에서 빼기' }))
  await waitFor(() => expect(within(dialog).getByText('아직 부서가 없어요.')).toBeTruthy())
})

test('부회장 직급은 확인 없이 바로 주고, 내 직급을 바꾸면 학생회를 다시 읽는다', async () => {
  const api = serve()
  const promoted = teamResponse()
  promoted.members[1]!.councilRank = 'vice_president'
  api.on('POST', '/api/organizations/c1/members/m2/rank', () => json(promoted))
  render(<Harness permissions={LEADER_PERMISSIONS} />)
  fireEvent.click(within(await openMenu('이재정')).getByRole('menuitem', { name: '부위원장 직급 주기' }))
  await waitFor(() => expect(row('이재정').textContent).toContain('부위원장'))
  expect(api.calls.find(call => call.path.endsWith('/rank'))?.body).toEqual({ rank: 'vice_president' })
})

test('내보내기는 확인 대화상자를 거치고, 취소하면 아무것도 보내지 않는다', async () => {
  const api = serve()
  const removed = teamResponse()
  removed.members = removed.members.filter(member => member.id !== 'm3')
  api.on('POST', '/api/organizations/c1/members/m3/remove', () => json(removed))
  render(<Harness permissions={LEADER_PERMISSIONS} />)
  fireEvent.click(within(await openMenu('박새내')).getByRole('menuitem', { name: '내보내기' }))
  let dialog = await screen.findByRole('dialog', { name: '박새내님을 내보낼까요?' })
  fireEvent.click(within(dialog).getByRole('button', { name: '취소' }))
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  expect(api.calls.some(call => call.method === 'POST')).toBe(false)
  fireEvent.click(within(await openMenu('박새내')).getByRole('menuitem', { name: '내보내기' }))
  dialog = await screen.findByRole('dialog', { name: '박새내님을 내보낼까요?' })
  fireEvent.click(within(dialog).getByRole('button', { name: '내보내기' }))
  expect(await screen.findByText('운영진 2명')).toBeTruthy()
  expect(screen.queryByRole('dialog')).toBeNull()
})

test('회장 넘기기는 확인한 뒤 넘기고 학생회를 다시 읽는다. 서버가 거절하면 대화상자에 까닭을 보인다', async () => {
  const api = serve()
  let first = true
  api.on('POST', '/api/organizations/c1/president/transfer', () => {
    if (first) { first = false; return json({ error: 'NOT_FOUND' }, 404) }
    return json(teamResponse())
  })
  const changed = vi.fn()
  render(<Harness permissions={PRESIDENT_PERMISSIONS} onCouncilChanged={changed} />)
  fireEvent.click(within(await openMenu('이재정')).getByRole('menuitem', { name: '위원장 넘기기' }))
  const dialog = await screen.findByRole('dialog', { name: '이재정님에게 위원장 직급을 넘길까요?' })
  fireEvent.click(within(dialog).getByRole('button', { name: '넘기기' }))
  expect(await within(dialog).findByText('이미 바뀌었어요. 목록을 새로 불러왔어요.')).toBeTruthy()
  fireEvent.click(within(dialog).getByRole('button', { name: '넘기기' }))
  await waitFor(() => expect(changed).toHaveBeenCalled())
  expect(api.calls.filter(call => call.path.endsWith('/president/transfer')).map(call => call.body)).toEqual([{ memberId: 'm2' }, { memberId: 'm2' }])
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
})
