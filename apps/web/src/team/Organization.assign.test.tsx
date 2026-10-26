// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { Action, TeamMember, TeamResponse } from '@vada/contracts'
import {
  councilView,
  LEADER_PERMISSIONS,
  MEMBER_PERMISSIONS,
  teamResponse,
} from '@/test-support/council-fixtures'
import { json, mockApi } from '@/test-support/mock-api'
import type { Reading } from '@/lib/use-lost'
import Organization from './Organization'
import { useTeam } from './useTeam'

// 미배정 묶음, 부서 배정, 부장·부회장 지정(기능 023 조각 5, DEC-91).
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})
const titles = { president: '위원장', vicePresident: '부위원장', head: '국장', viceHead: '차장' }
const outside: Reading = { own: false }

function Harness({ permissions }: { permissions: Action[] }) {
  const team = useTeam('c1', () => {})
  const base = councilView('c1', { permissions })
  return (
    <Organization
      view={{ ...base, council: { ...base.council, titles } }}
      reading={outside}
      team={team}
      onCouncilChanged={() => {}}
      onOwnChange={() => {}}
    />
  )
}

const person = (
  id: string,
  name: string,
  departments: TeamMember['departments'] = [],
  councilRank: TeamMember['councilRank'] = null,
): TeamMember => ({ id, name, councilRank, departments, joinedAt: '2026-10-20T01:00:00.000Z' })

// 김회장(회장, 부서 없음), 이재정(재정부 국장), 박새내·최새내(미배정), 정기획(기획부, 직급 없음).
function team(): TeamResponse {
  const base = teamResponse()
  return {
    ...base,
    members: [
      ...base.members,
      person('m4', '최새내'),
      person('m5', '정기획', [{ id: 'd2', rank: null }]),
    ],
  }
}
function serve(data: TeamResponse = team()) {
  const api = mockApi()
  api.on('GET', '/api/organizations/c1/members', () => json(data))
  return api
}
const posts = (api: ReturnType<typeof mockApi>) =>
  api.calls.filter(call => call.method === 'POST').map(call => [call.path, call.body])
const groupNames = () =>
  screen.getAllByRole('heading', { level: 2 }).map(heading => heading.textContent)
const unassignedRows = () =>
  within(screen.getByRole('list', { name: '미배정 구성원 구성원' }))
    .getAllByRole('listitem')
    .map(item => item.textContent?.split('10월')[0])
const loaded = () => screen.findByRole('heading', { name: '회장단' })

test('회장단에게 미배정 묶음이 맨 위에 있고 이름으로 줄며, 부서 없는 회장은 미배정이 아니다', async () => {
  serve()
  render(<Harness permissions={LEADER_PERMISSIONS} />)
  await loaded()
  expect(groupNames()[0]).toBe('미배정 구성원')
  expect(unassignedRows()).toEqual(['박새내', '최새내'])
  fireEvent.change(screen.getByRole('textbox', { name: '이름으로 찾기' }), {
    target: { value: '최' },
  })
  expect(unassignedRows()).toEqual(['최새내'])
  expect(screen.getByRole('button', { name: '최새내 부서 배정' })).toBeTruthy()
  expect(screen.getByRole('button', { name: '최새내 내보내기' })).toBeTruthy()
})

test('다른 운영진에게는 미배정 묶음이 맨 아래에 동작과 찾기 없이 있고, 미배정이 없으면 묶음도 없다', async () => {
  serve()
  render(<Harness permissions={MEMBER_PERMISSIONS} />)
  await loaded()
  expect(groupNames().at(-1)).toBe('미배정 구성원')
  expect(screen.queryByRole('textbox', { name: '이름으로 찾기' })).toBeNull()
  expect(screen.queryByRole('button', { name: /부서 배정$/ })).toBeNull()
  expect(screen.queryByRole('button', { name: /내보내기$/ })).toBeNull()
  expect(screen.queryByRole('button', { name: /지정$/ })).toBeNull()
  cleanup()
  const none = teamResponse()
  none.members = none.members.filter(member => member.id !== 'm3')
  serve(none)
  render(<Harness permissions={LEADER_PERMISSIONS} />)
  await loaded()
  expect(groupNames()).not.toContain('미배정 구성원')
})

test("미배정 줄의 '부서 배정'으로 넣으면 묶음에서 빠지고 부서 묶음에 나온다. '내보내기'는 확인 창 뒤에 보낸다", async () => {
  const api = serve()
  const assigned = team()
  assigned.members = assigned.members.map(member =>
    member.id === 'm3' ? { ...member, departments: [{ id: 'd2', rank: null }] } : member,
  )
  api.on('POST', '/api/organizations/c1/members/m3/departments', () => json(assigned))
  render(<Harness permissions={LEADER_PERMISSIONS} />)
  await loaded()
  fireEvent.click(screen.getByRole('button', { name: '박새내 부서 배정' }))
  const dialog = await screen.findByRole('dialog', { name: '박새내의 부서' })
  fireEvent.change(within(dialog).getByLabelText('부서'), { target: { value: 'd2' } })
  fireEvent.click(within(dialog).getByRole('button', { name: '부서에 넣기' }))
  await waitFor(() =>
    expect(
      within(screen.getByRole('list', { name: '기획부 구성원', hidden: true })).getByText('박새내'),
    ).toBeTruthy(),
  )
  expect(posts(api)).toEqual([
    ['/api/organizations/c1/members/m3/departments', { departmentId: 'd2', rank: null }],
  ])
  fireEvent.keyDown(dialog, { key: 'Escape' })
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  expect(unassignedRows()).toEqual(['최새내'])
  fireEvent.click(screen.getByRole('button', { name: '최새내 내보내기' }))
  expect(await screen.findByRole('dialog', { name: '최새내님을 내보낼까요?' })).toBeTruthy()
  expect(posts(api)).toHaveLength(1)
})

test("부서 머리의 '{부장} 지정'은 그 부서 사람을 기본값 없이 골라 바로 저장하고 되돌리기를 준다", async () => {
  const api = serve()
  const headed = team()
  headed.members = headed.members.map(member =>
    member.id === 'm5' ? { ...member, departments: [{ id: 'd2', rank: 'head' }] } : member,
  )
  api.on('POST', '/api/organizations/c1/members/m5/departments', () => json(headed))
  render(<Harness permissions={LEADER_PERMISSIONS} />)
  await loaded()
  // 재정부는 국장 말고 사람이 없어 고를 사람이 없다.
  expect(screen.queryByRole('button', { name: '재정부 국장 지정' })).toBeNull()
  fireEvent.keyDown(screen.getByRole('button', { name: '기획부 국장 지정' }), { key: 'Enter' })
  const menu = await screen.findByRole('menu')
  expect(
    within(menu)
      .getAllByRole('menuitem')
      .map(item => item.textContent),
  ).toEqual(['정기획'])
  fireEvent.click(within(menu).getByRole('menuitem', { name: '정기획' }))
  expect((await screen.findByRole('status')).textContent).toContain('정기획 국장 지정 완료')
  api.on('POST', '/api/organizations/c1/members/m5/departments', () => json(team()))
  fireEvent.click(within(screen.getByRole('status')).getByRole('button', { name: '되돌리기' }))
  await waitFor(() => expect(posts(api)).toHaveLength(2))
  expect(posts(api)).toEqual([
    ['/api/organizations/c1/members/m5/departments', { departmentId: 'd2', rank: 'head' }],
    ['/api/organizations/c1/members/m5/departments', { departmentId: 'd2', rank: null }],
  ])
})

test("회장단 머리의 '{부회장} 지정'은 부회장이 있어도 보이고, 회장단이 아닌 사람을 골라 바로 저장한다", async () => {
  const data = team()
  data.members = data.members.map(member =>
    member.id === 'm5' ? { ...member, councilRank: 'vice_president' } : member,
  )
  const api = serve(data)
  api.on('POST', '/api/organizations/c1/members/m3/rank', () => json(data))
  render(<Harness permissions={LEADER_PERMISSIONS} />)
  await loaded()
  fireEvent.keyDown(screen.getByRole('button', { name: '회장단에 부위원장 지정' }), {
    key: 'Enter',
  })
  const menu = await screen.findByRole('menu')
  expect(
    within(menu)
      .getAllByRole('menuitem')
      .map(item => item.textContent),
  ).toEqual(['이재정', '박새내', '최새내'])
  fireEvent.click(within(menu).getByRole('menuitem', { name: '박새내' }))
  expect((await screen.findByRole('status')).textContent).toContain('박새내 부위원장 지정 완료')
  expect(posts(api)).toEqual([
    ['/api/organizations/c1/members/m3/rank', { rank: 'vice_president' }],
  ])
})

test('지정 버튼은 권한대로 보인다: 부장 지정은 member.manage와 rank.manage, 부회장 지정은 rank.manage', async () => {
  for (const [permissions, head, vice] of [
    [['council.view', 'member.manage'], false, false],
    [['council.view', 'rank.manage'], false, true],
    [['council.view', 'member.manage', 'rank.manage'], true, true],
  ] as [Action[], boolean, boolean][]) {
    serve()
    render(<Harness permissions={permissions} />)
    await loaded()
    const label = permissions.join(',')
    expect(!!screen.queryByRole('button', { name: '기획부 국장 지정' }), label).toBe(head)
    expect(!!screen.queryByRole('button', { name: '회장단에 부위원장 지정' }), label).toBe(vice)
    cleanup()
  }
})
