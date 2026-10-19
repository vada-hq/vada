// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { Action, TeamResponse } from '@vada/contracts'
import { councilView, LEADER_PERMISSIONS, MEMBER_PERMISSIONS, PRESIDENT_PERMISSIONS, teamResponse } from '@/test-support/council-fixtures'
import { deferredResponse, json, mockApi } from '@/test-support/mock-api'
import People from './People'
import { useTeam } from './useTeam'

afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks() })
const titles = { president: '위원장', vicePresident: '부위원장', head: '국장', viceHead: '차장' }

// 실제 작업 공간처럼 useTeam의 onForbidden과 People의 onCouncilChanged는 둘 다 학생회를 다시 읽는 일이다. 시험에서는 따로 세어 본다.
// "목록 다시 읽기"는 다른 곳에서 목록이 바뀐 뒤 화면이 다시 읽는 일(404·403 뒤의 다시 읽기, 쪽 이동)을 대신한다.
function Harness({ permissions, memberId, onCouncilChanged = () => {}, onForbidden = () => {} }:
  { permissions: Action[]; memberId?: string; onCouncilChanged?: () => void; onForbidden?: () => void }) {
  const team = useTeam('c1', onForbidden)
  const base = councilView('c1', { permissions, memberId })
  return <>
    <People view={{ ...base, council: { ...base.council, titles } }} team={team} onCouncilChanged={onCouncilChanged} />
    <button type="button" onClick={team.reload}>목록 다시 읽기</button>
  </>
}
function serve(team: TeamResponse = teamResponse()) {
  const api = mockApi()
  api.on('GET', '/api/organizations/c1/members', () => json(team))
  api.on('GET', '/api/organizations/c1/invite', () => json({ code: 'ABCD2345' }))
  return api
}
const withoutMember = (id: string) => { const team = teamResponse(); team.members = team.members.filter(member => member.id !== id); return team }
// 대화상자가 열리면 뒤의 목록은 숨겨진다(aria-hidden). 그래도 줄의 글을 본다.
const row = (name: string) => screen.getAllByRole('listitem', { hidden: true }).find(item => item.textContent?.startsWith(name))!
async function openMenu(name: string) {
  fireEvent.keyDown(await screen.findByRole('button', { name: `${name} 동작` }), { key: 'Enter' })
  return screen.findByRole('menu')
}
const posts = (api: ReturnType<typeof mockApi>) => api.calls.filter(call => call.method === 'POST')
const noDialog = () => waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())

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

test('목록을 불러오지 못하면 다시 시도할 수 있고, 403이면 학생회를 다시 읽게 한다', async () => {
  const api = mockApi()
  let calls = 0
  api.on('GET', '/api/organizations/c1/members', () => calls++ === 0 ? json({ error: 'Internal server error' }, 500) : json(teamResponse()))
  render(<Harness permissions={MEMBER_PERMISSIONS} />)
  fireEvent.click(await screen.findByRole('button', { name: '다시 시도' }))
  expect(await screen.findByText('운영진 3명')).toBeTruthy()
  cleanup()
  const forbidden = vi.fn()
  api.on('GET', '/api/organizations/c1/members', () => json({ error: 'FORBIDDEN' }, 403))
  render(<Harness permissions={MEMBER_PERMISSIONS} onForbidden={forbidden} />)
  await screen.findByText('운영진을 불러오지 못했어요.')
  expect(forbidden).toHaveBeenCalled()
})

test('직급 없는 운영진은 초대 링크와 ⋯ 메뉴를 보지 않고 서버에 초대 코드를 묻지 않는다', async () => {
  const api = serve()
  render(<Harness permissions={MEMBER_PERMISSIONS} />)
  await screen.findByText('운영진 3명')
  expect(screen.queryByRole('region', { name: '초대 링크' })).toBeNull()
  expect(screen.queryByRole('button', { name: /동작$/ })).toBeNull()
  expect(api.calls.some(call => call.path.endsWith('/invite'))).toBe(false)
})

// 동작 버튼은 서버가 준 권한 하나하나로 보이거나 숨는다(DEC-38). 회장단 전체 묶음이 아니라 권한 하나만 가진 사람으로 본다.
test('권한 하나만 있을 때 그 권한의 동작만 보인다', async () => {
  const cases: { permissions: Action[]; invite: boolean; menus: Record<string, string[]> }[] = [
    { permissions: ['council.view', 'invite.manage'], invite: true, menus: {} },
    { permissions: ['council.view', 'member.manage'], invite: false, menus: { 김회장: ['부서 배정'], 이재정: ['부서 배정', '내보내기'] } },
    { permissions: ['council.view', 'rank.manage'], invite: false, menus: { 김회장: [], 이재정: ['부위원장 직급 주기'] } },
    { permissions: ['council.view', 'president.transfer'], invite: false, menus: { 김회장: [], 이재정: ['위원장 넘기기'] } },
  ]
  for (const { permissions, invite, menus } of cases) {
    const api = serve()
    render(<Harness permissions={permissions} />)
    await screen.findByText('운영진 3명')
    expect(!!screen.queryByRole('region', { name: '초대 링크' }), `초대 링크 ${permissions}`).toBe(invite)
    expect(api.calls.some(call => call.path.endsWith('/invite')), `초대 코드 요청 ${permissions}`).toBe(invite)
    for (const [name, items] of Object.entries(menus)) {
      if (items.length === 0) { expect(screen.queryByRole('button', { name: `${name} 동작` }), `${name} ${permissions}`).toBeNull(); continue }
      const menu = await openMenu(name)
      expect(within(menu).getAllByRole('menuitem').map(item => item.textContent), `${name} ${permissions}`).toEqual(items)
      fireEvent.keyDown(menu, { key: 'Escape' })
      await waitFor(() => expect(screen.queryByRole('menu')).toBeNull())
    }
    if (Object.keys(menus).length === 0) expect(screen.queryByRole('button', { name: /동작$/ })).toBeNull()
    cleanup()
  }
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

test('초대 링크를 불러올 때 403이면 학생회를 다시 읽게 하고, 그 밖의 실패는 다시 시도할 수 있다', async () => {
  const api = mockApi()
  api.on('GET', '/api/organizations/c1/members', () => json(teamResponse()))
  let invites = 0
  api.on('GET', '/api/organizations/c1/invite', () => invites++ === 0 ? json({ error: 'FORBIDDEN' }, 403) : invites === 2 ? json({ error: 'Internal server error' }, 500) : json({ code: 'ABCD2345' }))
  const changed = vi.fn()
  render(<Harness permissions={LEADER_PERMISSIONS} onCouncilChanged={changed} />)
  expect(await screen.findByText('권한이 바뀌었어요. 화면을 새로 불러왔어요.')).toBeTruthy()
  expect(changed).toHaveBeenCalledTimes(1)
  fireEvent.click(screen.getByRole('button', { name: '다시 시도' }))
  expect(await screen.findByText('초대 링크를 불러오지 못했어요.')).toBeTruthy()
  expect(changed).toHaveBeenCalledTimes(1)
  fireEvent.click(screen.getByRole('button', { name: '다시 시도' }))
  const card = await screen.findByRole('region', { name: '초대 링크' })
  expect((within(card).getByLabelText('초대 링크') as HTMLInputElement).value).toBe(`${window.location.origin}/join/ABCD2345`)
  expect(invites).toBe(3)
})

test('코드를 바꿀 때 403이면 학생회를 다시 읽게 하고 까닭을 보이며, 그 밖의 실패는 다시 눌러 바꿀 수 있다', async () => {
  const api = serve()
  let rotations = 0
  api.on('POST', '/api/organizations/c1/invite/rotate', () => rotations++ === 0 ? json({ error: 'FORBIDDEN' }, 403)
    : rotations === 2 ? json({ error: 'Internal server error' }, 500) : json({ code: 'WXYZ6789' }))
  const changed = vi.fn()
  render(<Harness permissions={LEADER_PERMISSIONS} onCouncilChanged={changed} />)
  const card = await screen.findByRole('region', { name: '초대 링크' })
  fireEvent.click(within(card).getByRole('button', { name: '코드 바꾸기' }))
  expect(await within(card).findByText('권한이 바뀌었어요. 화면을 새로 불러왔어요.')).toBeTruthy()
  expect(changed).toHaveBeenCalledTimes(1)
  fireEvent.click(within(card).getByRole('button', { name: '코드 바꾸기' }))
  expect(await within(card).findByText('코드를 바꾸지 못했어요. 다시 시도해 주세요.')).toBeTruthy()
  expect(changed).toHaveBeenCalledTimes(1)
  fireEvent.click(within(card).getByRole('button', { name: '코드 바꾸기' }))
  expect(await within(card).findByText('코드를 바꿨어요. 옛 링크로는 이제 들어올 수 없어요.')).toBeTruthy()
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

// 부서 직급(부장·부부장)을 바꾸는 일은 member.manage에 더해 rank.manage도 본다(P19).
test('부서 직급 선택칸은 rank.manage가 있을 때만 켜진다', async () => {
  const withHead = teamResponse()
  serve(withHead)
  const view = render(<Harness permissions={LEADER_PERMISSIONS} />)
  fireEvent.click(within(await openMenu('이재정')).getByRole('menuitem', { name: '부서 배정' }))
  let dialog = await screen.findByRole('dialog', { name: '이재정의 부서' })
  expect((within(dialog).getByLabelText('재정부 부서 직급') as HTMLSelectElement).disabled).toBe(false)
  expect((within(dialog).getByLabelText('부서 직급') as HTMLSelectElement).disabled).toBe(false)
  view.rerender(<Harness permissions={LEADER_PERMISSIONS.filter(action => action !== 'rank.manage')} />)
  dialog = await screen.findByRole('dialog', { name: '이재정의 부서' })
  expect((within(dialog).getByLabelText('재정부 부서 직급') as HTMLSelectElement).disabled).toBe(true)
  expect((within(dialog).getByLabelText('부서 직급') as HTMLSelectElement).disabled).toBe(true)
  // 부서에 넣거나 빼는 일은 member.manage만으로 된다.
  expect((within(dialog).getByRole('button', { name: '부서에 넣기' }) as HTMLButtonElement).disabled).toBe(false)
  expect((within(dialog).getByRole('button', { name: '재정부에서 빼기' }) as HTMLButtonElement).disabled).toBe(false)
})

test('부서 직급 없이 부서에 넣을 때 rank.manage가 없으면 직급을 보내지 않는다', async () => {
  const api = serve()
  api.on('POST', '/api/organizations/c1/members/m3/departments', () => json(teamResponse()))
  render(<Harness permissions={['council.view', 'member.manage']} />)
  fireEvent.click(within(await openMenu('박새내')).getByRole('menuitem', { name: '부서 배정' }))
  const dialog = await screen.findByRole('dialog', { name: '박새내의 부서' })
  fireEvent.click(within(dialog).getByRole('button', { name: '부서에 넣기' }))
  await waitFor(() => expect(api.calls.find(call => call.path.endsWith('/members/m3/departments'))?.body).toEqual({ departmentId: 'd1', rank: null }))
})

test('부회장 직급은 확인 없이 바로 주고, 다른 사람의 직급을 바꾸면 학생회를 다시 읽지 않는다', async () => {
  const api = serve()
  const promoted = teamResponse()
  promoted.members[1]!.councilRank = 'vice_president'
  api.on('POST', '/api/organizations/c1/members/m2/rank', () => json(promoted))
  const changed = vi.fn()
  render(<Harness permissions={LEADER_PERMISSIONS} onCouncilChanged={changed} />)
  fireEvent.click(within(await openMenu('이재정')).getByRole('menuitem', { name: '부위원장 직급 주기' }))
  await waitFor(() => expect(row('이재정').textContent).toContain('부위원장'))
  expect(api.calls.find(call => call.path.endsWith('/rank'))?.body).toEqual({ rank: 'vice_president' })
  expect(changed).not.toHaveBeenCalled()
})

test('내 직급을 바꾸면 학생회를 다시 읽어 권한을 새로 받는다', async () => {
  const api = serve()
  const promoted = teamResponse()
  promoted.members[1]!.councilRank = 'vice_president'
  api.on('POST', '/api/organizations/c1/members/m2/rank', () => json(promoted))
  const changed = vi.fn()
  render(<Harness permissions={LEADER_PERMISSIONS} memberId="m2" onCouncilChanged={changed} />)
  fireEvent.click(within(await openMenu('이재정')).getByRole('menuitem', { name: '부위원장 직급 주기' }))
  await waitFor(() => expect(row('이재정').textContent).toContain('부위원장'))
  expect(changed).toHaveBeenCalledTimes(1)
})

test('내보내기는 확인 대화상자를 거치고, 취소하면 아무것도 보내지 않는다', async () => {
  const api = serve()
  const removed = withoutMember('m3')
  api.on('POST', '/api/organizations/c1/members/m3/remove', () => json(removed))
  render(<Harness permissions={LEADER_PERMISSIONS} />)
  fireEvent.click(within(await openMenu('박새내')).getByRole('menuitem', { name: '내보내기' }))
  let dialog = await screen.findByRole('dialog', { name: '박새내님을 내보낼까요?' })
  fireEvent.click(within(dialog).getByRole('button', { name: '취소' }))
  await noDialog()
  expect(posts(api)).toEqual([])
  fireEvent.click(within(await openMenu('박새내')).getByRole('menuitem', { name: '내보내기' }))
  dialog = await screen.findByRole('dialog', { name: '박새내님을 내보낼까요?' })
  fireEvent.click(within(dialog).getByRole('button', { name: '내보내기' }))
  expect(await screen.findByText('운영진 2명')).toBeTruthy()
  expect(screen.queryByRole('dialog')).toBeNull()
})

test('확인 대화상자는 보내는 동안 두 버튼이 꺼져, 연달아 눌러도 한 번만 보낸다', async () => {
  const api = serve()
  const pending = deferredResponse()
  api.on('POST', '/api/organizations/c1/members/m3/remove', () => pending.promise)
  render(<Harness permissions={LEADER_PERMISSIONS} />)
  fireEvent.click(within(await openMenu('박새내')).getByRole('menuitem', { name: '내보내기' }))
  const dialog = await screen.findByRole('dialog', { name: '박새내님을 내보낼까요?' })
  const confirm = within(dialog).getByRole('button', { name: '내보내기' }) as HTMLButtonElement
  fireEvent.click(confirm)
  await waitFor(() => expect(confirm.disabled).toBe(true))
  expect((within(dialog).getByRole('button', { name: '취소' }) as HTMLButtonElement).disabled).toBe(true)
  fireEvent.click(confirm)
  fireEvent.click(confirm)
  // 보내는 동안에는 Escape로도 닫히지 않는다.
  fireEvent.keyDown(dialog, { key: 'Escape' })
  expect(screen.getByRole('dialog', { name: '박새내님을 내보낼까요?' })).toBeTruthy()
  expect(posts(api)).toHaveLength(1)
  pending.resolve(json(withoutMember('m3')))
  expect(await screen.findByText('운영진 2명')).toBeTruthy()
  await noDialog()
  expect(posts(api)).toHaveLength(1)
})

test('회장 넘기기는 확인한 뒤 넘기고 학생회를 다시 읽는다. 이미 바뀌었다는 답이 오면 닫고 까닭을 쪽에 보이며 다시 보내지 않는다', async () => {
  const api = serve()
  let first = true
  api.on('POST', '/api/organizations/c1/president/transfer', () => {
    if (first) { first = false; return json({ error: 'NOT_FOUND' }, 404) }
    return json(teamResponse())
  })
  const changed = vi.fn()
  render(<Harness permissions={PRESIDENT_PERMISSIONS} onCouncilChanged={changed} />)
  fireEvent.click(within(await openMenu('이재정')).getByRole('menuitem', { name: '위원장 넘기기' }))
  let dialog = await screen.findByRole('dialog', { name: '이재정님에게 위원장 직급을 넘길까요?' })
  fireEvent.click(within(dialog).getByRole('button', { name: '넘기기' }))
  await noDialog()
  expect(screen.getByText('이미 바뀌었어요. 목록을 새로 불러왔어요.')).toBeTruthy()
  expect(posts(api)).toHaveLength(1)
  expect(changed).not.toHaveBeenCalled()
  // 목록을 새로 읽은 뒤에는 다시 열어 넘길 수 있다.
  fireEvent.click(within(await openMenu('이재정')).getByRole('menuitem', { name: '위원장 넘기기' }))
  dialog = await screen.findByRole('dialog', { name: '이재정님에게 위원장 직급을 넘길까요?' })
  fireEvent.click(within(dialog).getByRole('button', { name: '넘기기' }))
  await waitFor(() => expect(changed).toHaveBeenCalled())
  expect(posts(api).map(call => call.body)).toEqual([{ memberId: 'm2' }, { memberId: 'm2' }])
  await noDialog()
})

test('확인 대화상자는 서버가 잠시 실패하면 까닭을 안에 보이고 다시 눌러 보낼 수 있다', async () => {
  const api = serve()
  let first = true
  api.on('POST', '/api/organizations/c1/members/m3/remove', () => {
    if (first) { first = false; return json({ error: 'Internal server error' }, 500) }
    return json(withoutMember('m3'))
  })
  render(<Harness permissions={LEADER_PERMISSIONS} />)
  fireEvent.click(within(await openMenu('박새내')).getByRole('menuitem', { name: '내보내기' }))
  const dialog = await screen.findByRole('dialog', { name: '박새내님을 내보낼까요?' })
  fireEvent.click(within(dialog).getByRole('button', { name: '내보내기' }))
  expect(await within(dialog).findByText('저장하지 못했어요. 다시 시도해 주세요.')).toBeTruthy()
  fireEvent.click(within(dialog).getByRole('button', { name: '내보내기' }))
  expect(await screen.findByText('운영진 2명')).toBeTruthy()
  expect(posts(api)).toHaveLength(2)
})

test('확인 대화상자가 열린 채 대상이 목록에서 사라지면 닫히고, 아무것도 보내지 않는다', async () => {
  const api = mockApi()
  let reads = 0
  api.on('GET', '/api/organizations/c1/members', () => json(reads++ === 0 ? teamResponse() : withoutMember('m3')))
  api.on('GET', '/api/organizations/c1/invite', () => json({ code: 'ABCD2345' }))
  render(<Harness permissions={LEADER_PERMISSIONS} />)
  fireEvent.click(within(await openMenu('박새내')).getByRole('menuitem', { name: '내보내기' }))
  await screen.findByRole('dialog', { name: '박새내님을 내보낼까요?' })
  fireEvent.click(screen.getByText('목록 다시 읽기'))
  await noDialog()
  expect(screen.getByText('운영진 2명')).toBeTruthy()
  expect(posts(api)).toEqual([])
})

test('확인 대화상자가 열린 채 권한을 잃으면 닫히고, 다시 보낼 수 없다', async () => {
  for (const { permissions, lost, name, title, item } of [
    { permissions: LEADER_PERMISSIONS, lost: MEMBER_PERMISSIONS, name: '박새내', title: '박새내님을 내보낼까요?', item: '내보내기' },
    { permissions: PRESIDENT_PERMISSIONS, lost: LEADER_PERMISSIONS, name: '이재정', title: '이재정님에게 위원장 직급을 넘길까요?', item: '위원장 넘기기' },
  ]) {
    const api = serve()
    const view = render(<Harness permissions={permissions} />)
    fireEvent.click(within(await openMenu(name)).getByRole('menuitem', { name: item }))
    await screen.findByRole('dialog', { name: title })
    view.rerender(<Harness permissions={lost} />)
    await noDialog()
    expect(posts(api), `${item}`).toEqual([])
    cleanup()
  }
})

test('부서 배정 대화상자가 열린 채 member.manage를 잃으면 닫히고, 쪽의 다른 동작도 막힌다', async () => {
  const api = serve()
  const view = render(<Harness permissions={LEADER_PERMISSIONS} />)
  fireEvent.click(within(await openMenu('박새내')).getByRole('menuitem', { name: '부서 배정' }))
  await screen.findByRole('dialog', { name: '박새내의 부서' })
  view.rerender(<Harness permissions={MEMBER_PERMISSIONS} />)
  await noDialog()
  expect(screen.queryByRole('button', { name: /동작$/ })).toBeNull()
  expect(posts(api)).toEqual([])
})

// 검토 탐침 A: 고치던 운영진이 404로 사라져도 쪽 위의 오류 문구가 가려지지 않는다.
test('부서를 배정하다 404로 그 운영진이 사라지면 대화상자를 닫고 까닭을 쪽에 보이며, 이어지는 다른 실패도 보인다', async () => {
  const api = mockApi()
  let reads = 0
  api.on('GET', '/api/organizations/c1/members', () => json(reads++ === 0 ? teamResponse() : withoutMember('m3')))
  api.on('GET', '/api/organizations/c1/invite', () => json({ code: 'ABCD2345' }))
  api.on('POST', '/api/organizations/c1/members/m3/departments', () => json({ error: 'NOT_FOUND' }, 404))
  api.on('POST', '/api/organizations/c1/members/m2/rank', () => json({ error: 'Internal server error' }, 500))
  render(<Harness permissions={LEADER_PERMISSIONS} />)
  fireEvent.click(within(await openMenu('박새내')).getByRole('menuitem', { name: '부서 배정' }))
  const dialog = await screen.findByRole('dialog', { name: '박새내의 부서' })
  fireEvent.click(within(dialog).getByRole('button', { name: '부서에 넣기' }))
  await noDialog()
  expect(screen.getByText('운영진 2명')).toBeTruthy()
  expect(screen.getByText('이미 바뀌었어요. 목록을 새로 불러왔어요.')).toBeTruthy()
  fireEvent.click(within(await openMenu('이재정')).getByRole('menuitem', { name: '부위원장 직급 주기' }))
  expect(await screen.findByText('저장하지 못했어요. 다시 시도해 주세요.')).toBeTruthy()
  expect(screen.queryByText('이미 바뀌었어요. 목록을 새로 불러왔어요.')).toBeNull()
})

test('쪽에서 한 동작이 실패하면 휴대폰 화면에서도 보이도록 오류 문구를 화면 안으로 스크롤한다', async () => {
  const api = serve()
  api.on('POST', '/api/organizations/c1/members/m2/rank', () => json({ error: 'Internal server error' }, 500))
  const scrollIntoView = vi.fn()
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { value: scrollIntoView, configurable: true, writable: true })
  try {
    render(<Harness permissions={LEADER_PERMISSIONS} />)
    fireEvent.click(within(await openMenu('이재정')).getByRole('menuitem', { name: '부위원장 직급 주기' }))
    const alert = await screen.findByRole('alert')
    await waitFor(() => expect(scrollIntoView).toHaveBeenCalledTimes(1))
    expect(scrollIntoView).toHaveBeenCalledWith({ block: 'nearest' })
    expect((scrollIntoView.mock.contexts[0] as HTMLElement).contains(alert)).toBe(true)
  } finally {
    delete (HTMLElement.prototype as unknown as Record<string, unknown>).scrollIntoView
  }
  expect(posts(api)).toHaveLength(1)
})

// Radix는 Trigger로 연 대화상자만 닫을 때 포커스를 돌려준다. ⋯ 메뉴 항목으로 연 대화상자는 직접 돌려준다.
test('메뉴 항목으로 연 대화상자를 닫으면 포커스가 그 운영진의 ⋯ 버튼으로 돌아간다', async () => {
  serve()
  render(<Harness permissions={LEADER_PERMISSIONS} />)
  fireEvent.click(within(await openMenu('박새내')).getByRole('menuitem', { name: '내보내기' }))
  const confirm = await screen.findByRole('dialog', { name: '박새내님을 내보낼까요?' })
  fireEvent.click(within(confirm).getByRole('button', { name: '취소' }))
  await noDialog()
  await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('button', { name: '박새내 동작' })))
  fireEvent.click(within(await openMenu('이재정')).getByRole('menuitem', { name: '부서 배정' }))
  const assign = await screen.findByRole('dialog', { name: '이재정의 부서' })
  fireEvent.keyDown(assign, { key: 'Escape' })
  await noDialog()
  await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('button', { name: '이재정 동작' })))
  await new Promise(done => setTimeout(done, 50))
  expect(document.activeElement).toBe(screen.getByRole('button', { name: '이재정 동작' }))
})
