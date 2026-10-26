// @vitest-environment jsdom
import { useRef, useState } from 'react'
import { afterEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { Action, TeamResponse } from '@vada/contracts'
import {
  councilView,
  LEADER_PERMISSIONS,
  MEMBER_PERMISSIONS,
  PRESIDENT_PERMISSIONS,
  teamResponse,
} from '@/test-support/council-fixtures'
import { deferredResponse, json, mockApi } from '@/test-support/mock-api'
import Organization from './Organization'
import { useTeam } from './useTeam'
import { asElement } from '@/test-support/elements'
import { settle } from '@/test-support/settle'
import type { Reading } from '@/lib/use-lost'

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})
const titles = { president: '위원장', vicePresident: '부위원장', head: '국장', viceHead: '차장' }

// 실제 작업 공간처럼 useTeam의 onForbidden, Organization의 onCouncilChanged·onOwnChange는 모두 학생회를 다시 읽는 일이다. 시험에서는 따로 세어 본다.
// "목록 다시 읽기"는 다른 곳에서 목록이 바뀐 뒤 화면이 다시 읽는 일(404·403 뒤의 다시 읽기, 쪽 이동)을 대신한다.
// 권한을 준 학생회 읽기. 따로 주지 않으면 바깥 변경을 읽은 것으로 본다.
const outside: Reading = { own: false }
function Harness({
  permissions,
  memberId,
  reading = outside,
  onCouncilChanged = () => {},
  onOwnChange = () => {},
  onForbidden = () => {},
}: {
  permissions: Action[]
  memberId?: string
  reading?: Reading
  onCouncilChanged?: () => void
  onOwnChange?: () => void
  onForbidden?: () => void
}) {
  const team = useTeam('c1', onForbidden)
  const base = councilView('c1', { permissions, memberId })
  return (
    <>
      <Organization
        view={{ ...base, council: { ...base.council, titles } }}
        reading={reading}
        team={team}
        onCouncilChanged={onCouncilChanged}
        onOwnChange={onOwnChange}
      />
      <button type="button" onClick={team.reload}>
        목록 다시 읽기
      </button>
    </>
  )
}
function serve(team: TeamResponse = teamResponse()) {
  const api = mockApi()
  api.on('GET', '/api/organizations/c1/members', () => json(team))
  api.on('GET', '/api/organizations/c1/invite', () => json(INVITE))
  return api
}
const INVITE = { code: 'ABCD2345', createdAt: '2026-10-25T05:00:00.000Z' }
const inviteReads = (api: ReturnType<typeof mockApi>) =>
  api.calls.filter(call => call.path.endsWith('/invite')).length
const withoutMember = (id: string) => {
  const team = teamResponse()
  team.members = team.members.filter(member => member.id !== id)
  return team
}
// 대화상자가 열리면 뒤의 목록은 숨겨진다(aria-hidden). 그래도 줄의 글을 본다.
const row = (name: string) =>
  screen
    .getAllByRole('listitem', { hidden: true })
    .find(item => item.textContent?.startsWith(name))!
async function openMenu(name: string) {
  fireEvent.keyDown(await screen.findByRole('button', { name: `${name} 동작` }), { key: 'Enter' })
  return screen.findByRole('menu')
}
// 조직 화면을 다 불러왔다(회장단 묶음은 늘 있다).
const loaded = () => screen.findByRole('heading', { name: '회장단' })
// 그 사람의 줄이 어느 묶음에든 있는가.
const shown = (name: string) =>
  screen
    .queryAllByRole('listitem', { hidden: true })
    .some(item => item.textContent?.startsWith(name))
const posts = (api: ReturnType<typeof mockApi>) => api.calls.filter(call => call.method === 'POST')
const noDialog = () => waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())

// 조직 화면의 사람 쪽(DEC-91): 사람 화면의 줄과 동작이 묶음 안에서 그대로다.
test('사람 줄은 들어온 순서대로 이름, 학생회가 정한 직급 이름(부서 묶음에서는 그 부서 직급), 다른 소속, 들어온 날짜와 시각을 보이고 이메일은 없다', async () => {
  // 올해가 아니면 연도가 붙으므로 오늘을 고정한다.
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-10-25T03:00:00Z'))
  serve()
  render(<Harness permissions={MEMBER_PERMISSIONS} />)
  await loaded()
  const rows = (group: string) =>
    within(screen.getByRole('list', { name: `${group} 구성원` }))
      .getAllByRole('listitem')
      .map(item => item.textContent)
  expect(rows('회장단')).toEqual(['김회장위원장10월 1일 (목) 10:00 들어옴'])
  expect(rows('재정부')).toEqual(['이재정국장10월 2일 (금) 10:00 들어옴'])
  expect(rows('미배정 구성원')).toEqual(['박새내10월 19일 (월) 00:30 들어옴'])
  // 회장은 노랑, 부서 직급은 회색 배지다.
  expect(
    within(screen.getByRole('list', { name: '회장단 구성원' })).getByText('위원장').className,
  ).toContain('yellow')
  expect(
    within(screen.getByRole('list', { name: '재정부 구성원' })).getByText('국장').className,
  ).toContain('gray')
  expect(document.body.textContent).not.toContain('@')
})

test('목록을 불러오지 못하면 다시 시도할 수 있고, 403이면 학생회를 다시 읽게 한다', async () => {
  const api = mockApi()
  let calls = 0
  api.on('GET', '/api/organizations/c1/members', () =>
    calls++ === 0 ? json({ error: 'Internal server error' }, 500) : json(teamResponse()),
  )
  render(<Harness permissions={MEMBER_PERMISSIONS} />)
  fireEvent.click(await screen.findByRole('button', { name: '다시 시도' }))
  await loaded()
  cleanup()
  const forbidden = vi.fn()
  api.on('GET', '/api/organizations/c1/members', () => json({ error: 'FORBIDDEN' }, 403))
  render(<Harness permissions={MEMBER_PERMISSIONS} onForbidden={forbidden} />)
  await screen.findByText('조직을 불러오지 못했어요.')
  expect(forbidden).toHaveBeenCalled()
})

test('직급 없는 운영진은 [구성원 초대]와 ⋯ 메뉴를 보지 않고 서버에 초대 코드를 묻지 않는다', async () => {
  const api = serve()
  render(<Harness permissions={MEMBER_PERMISSIONS} />)
  await loaded()
  expect(screen.queryByRole('button', { name: '구성원 초대' })).toBeNull()
  expect(screen.queryByRole('region', { name: '초대 링크' })).toBeNull()
  expect(screen.queryByRole('button', { name: /동작$/ })).toBeNull()
  expect(inviteReads(api)).toBe(0)
})

// 동작 버튼은 서버가 준 권한 하나하나로 보이거나 숨는다(DEC-38). 회장단 전체 묶음이 아니라 권한 하나만 가진 사람으로 본다.
test('권한 하나만 있을 때 그 권한의 동작만 보인다', async () => {
  const cases: { permissions: Action[]; invite: boolean; menus: Record<string, string[]> }[] = [
    { permissions: ['council.view', 'invite.manage'], invite: true, menus: {} },
    // 이재정은 부서 직급이 있어 내보내기에는 rank.manage도 필요하다.
    {
      permissions: ['council.view', 'member.manage'],
      invite: false,
      menus: { 김회장: ['부서 배정'], 이재정: ['부서 배정'], 박새내: ['부서 배정', '내보내기'] },
    },
    {
      permissions: ['council.view', 'member.manage', 'rank.manage'],
      invite: false,
      menus: { 김회장: ['부서 배정'], 이재정: ['부서 배정', '부위원장 직급 주기', '내보내기'] },
    },
    {
      permissions: ['council.view', 'rank.manage'],
      invite: false,
      menus: { 김회장: [], 이재정: ['부위원장 직급 주기'] },
    },
    {
      permissions: ['council.view', 'president.transfer'],
      invite: false,
      menus: { 김회장: [], 이재정: ['위원장 넘기기'] },
    },
  ]
  for (const { permissions, invite, menus } of cases) {
    const api = serve()
    render(<Harness permissions={permissions} />)
    await loaded()
    expect(
      !!screen.queryByRole('button', { name: '구성원 초대' }),
      `구성원 초대 ${permissions.join(',')}`,
    ).toBe(invite)
    // 창을 열기 전에는 누구도 초대 코드를 읽지 않는다.
    expect(inviteReads(api), `초대 코드 요청 ${permissions.join(',')}`).toBe(0)
    for (const [name, items] of Object.entries(menus)) {
      if (items.length === 0) {
        expect(
          screen.queryByRole('button', { name: `${name} 동작` }),
          `${name} ${permissions.join(',')}`,
        ).toBeNull()
        continue
      }
      const menu = await openMenu(name)
      expect(
        within(menu)
          .getAllByRole('menuitem')
          .map(item => item.textContent),
        `${name} ${permissions.join(',')}`,
      ).toEqual(items)
      fireEvent.keyDown(menu, { key: 'Escape' })
      await waitFor(() => expect(screen.queryByRole('menu')).toBeNull())
    }
    if (Object.keys(menus).length === 0)
      expect(screen.queryByRole('button', { name: /동작$/ })).toBeNull()
    cleanup()
  }
})

// 구성원 초대 창(기능 023 조각 6). 창 안의 복사·코드 바꾸기는 InviteSheet.test.tsx가 본다. 여기서는 조직 화면과 이은 곳을 본다.
async function openInvite() {
  await loaded()
  fireEvent.click(screen.getByRole('button', { name: '구성원 초대' }))
  return screen.findByRole('dialog', { name: '구성원 초대' })
}

test('회장단이 머리의 [구성원 초대]를 누르면 그때 코드를 읽어 링크·코드·만든 시각을 창에 보이고, 닫으면 조직 화면이다', async () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-10-25T06:00:00Z'))
  const api = serve()
  render(<Harness permissions={LEADER_PERMISSIONS} />)
  const sheet = await openInvite()
  const link = await within(sheet).findByRole('textbox', { name: '초대 링크' })
  expect(asElement(link, HTMLInputElement).value).toBe(`${window.location.origin}/join/ABCD2345`)
  expect(
    asElement(within(sheet).getByRole('textbox', { name: '초대 코드' }), HTMLInputElement).value,
  ).toBe('ABCD2345')
  expect(within(sheet).getByText('만든 시각 10월 25일 (일) 14:00')).toBeTruthy()
  expect(inviteReads(api)).toBe(1)
  // 조직 화면에는 옛 초대 링크 카드가 없다.
  fireEvent.click(within(sheet).getByRole('button', { name: '닫기' }))
  await noDialog()
  expect(screen.queryByRole('region', { name: '초대 링크' })).toBeNull()
  expect(inviteReads(api)).toBe(1)
})

test('초대 코드를 읽을 때 403이면 학생회를 다시 읽게 하고 창에 까닭을 보인다', async () => {
  const api = mockApi()
  api.on('GET', '/api/organizations/c1/members', () => json(teamResponse()))
  api.on('GET', '/api/organizations/c1/invite', () => json({ error: 'FORBIDDEN' }, 403))
  const changed = vi.fn()
  render(<Harness permissions={LEADER_PERMISSIONS} onCouncilChanged={changed} />)
  const sheet = await openInvite()
  expect(await within(sheet).findByText('권한이 바뀌었어요. 화면을 새로 불러왔어요.')).toBeTruthy()
  expect(changed).toHaveBeenCalledTimes(1)
})

test('코드를 바꿀 때 403이면 학생회를 다시 읽게 한다', async () => {
  const api = serve()
  api.on('POST', '/api/organizations/c1/invite/rotate', () => json({ error: 'FORBIDDEN' }, 403))
  const changed = vi.fn()
  render(<Harness permissions={LEADER_PERMISSIONS} onCouncilChanged={changed} />)
  const sheet = await openInvite()
  fireEvent.click(await within(sheet).findByRole('button', { name: '코드 바꾸기' }))
  const dialog = screen.getByRole('dialog', { name: '초대 코드를 바꿀까요?' })
  fireEvent.click(within(dialog).getByRole('button', { name: '코드 바꾸기' }))
  expect(await within(dialog).findByText('권한이 바뀌었어요. 화면을 새로 불러왔어요.')).toBeTruthy()
  expect(changed).toHaveBeenCalledTimes(1)
})

test('회장단의 ⋯ 메뉴: 회장 줄에는 직급과 내보내기가 없고, 내 줄에는 내보내기가 없고, 회장 넘기기는 회장에게만 있다', async () => {
  serve()
  render(<Harness permissions={LEADER_PERMISSIONS} />)
  let menu = await openMenu('김회장')
  expect(
    within(menu)
      .getAllByRole('menuitem')
      .map(item => item.textContent),
  ).toEqual(['부서 배정'])
  fireEvent.keyDown(menu, { key: 'Escape' })
  menu = await openMenu('이재정')
  expect(
    within(menu)
      .getAllByRole('menuitem')
      .map(item => item.textContent),
  ).toEqual(['부서 배정', '부위원장 직급 주기', '내보내기'])
  cleanup()
  serve()
  render(<Harness permissions={PRESIDENT_PERMISSIONS} />)
  menu = await openMenu('이재정')
  expect(
    within(menu)
      .getAllByRole('menuitem')
      .map(item => item.textContent),
  ).toEqual(['부서 배정', '부위원장 직급 주기', '위원장 넘기기', '내보내기'])
})

// 서버는 학생회 직급이나 부서 직급이 붙은 사람을 내보낼 때 member.manage에 더해 rank.manage도 본다.
test('직급이 붙은 사람은 member.manage와 rank.manage가 둘 다 있어야 내보내기가 보인다', async () => {
  const team = teamResponse()
  team.members.push(
    {
      id: 'm4',
      name: '최부회장',
      councilRank: 'vice_president',
      departments: [],
      joinedAt: '2026-10-19T01:00:00.000Z',
    },
    {
      id: 'm5',
      name: '정부원',
      councilRank: null,
      departments: [{ id: 'd2', rank: null }],
      joinedAt: '2026-10-19T02:00:00.000Z',
    },
  )
  const cases: { permissions: Action[]; menus: Record<string, string[]> }[] = [
    {
      permissions: ['council.view', 'member.manage'],
      menus: {
        이재정: ['부서 배정'],
        최부회장: ['부서 배정'],
        박새내: ['부서 배정', '내보내기'],
        정부원: ['부서 배정', '내보내기'],
      },
    },
    {
      permissions: ['council.view', 'member.manage', 'rank.manage'],
      menus: {
        이재정: ['부서 배정', '부위원장 직급 주기', '내보내기'],
        최부회장: ['부서 배정', '부위원장 직급 거두기', '내보내기'],
        박새내: ['부서 배정', '부위원장 직급 주기', '내보내기'],
        정부원: ['부서 배정', '부위원장 직급 주기', '내보내기'],
      },
    },
  ]
  for (const { permissions, menus } of cases) {
    serve(team)
    render(<Harness permissions={permissions} />)
    for (const [name, items] of Object.entries(menus)) {
      const menu = await openMenu(name)
      expect(
        within(menu)
          .getAllByRole('menuitem')
          .map(item => item.textContent),
        `${name} ${permissions.join(',')}`,
      ).toEqual(items)
      fireEvent.keyDown(menu, { key: 'Escape' })
      await waitFor(() => expect(screen.queryByRole('menu')).toBeNull())
    }
    cleanup()
  }
})

test('부서 배정 대화상자에서 부서와 부서 직급을 정하고, 부서에서 뺀다', async () => {
  const api = serve()
  const assigned = teamResponse()
  assigned.members[2]!.departments = [{ id: 'd2', rank: 'vice_head' }]
  api.on('POST', '/api/organizations/c1/members/m3/departments', () => json(assigned))
  api.on('POST', '/api/organizations/c1/members/m3/departments/d2/remove', () =>
    json(teamResponse()),
  )
  render(<Harness permissions={LEADER_PERMISSIONS} />)
  fireEvent.click(within(await openMenu('박새내')).getByRole('menuitem', { name: '부서 배정' }))
  const dialog = await screen.findByRole('dialog', { name: '박새내의 부서' })
  fireEvent.change(within(dialog).getByLabelText('부서'), { target: { value: 'd2' } })
  fireEvent.change(within(dialog).getByLabelText('부서 직급'), { target: { value: 'vice_head' } })
  fireEvent.click(within(dialog).getByRole('button', { name: '부서에 넣기' }))
  expect(await within(dialog).findByLabelText('기획부 부서 직급')).toBeTruthy()
  expect(api.calls.find(call => call.path.endsWith('/members/m3/departments'))?.body).toEqual({
    departmentId: 'd2',
    rank: 'vice_head',
  })
  // 기획부 묶음에 차장 배지로 나온다.
  expect(row('박새내').textContent).toContain('박새내차장')
  expect(
    screen.getByRole('list', { name: '기획부 구성원', hidden: true }).contains(row('박새내')),
  ).toBe(true)
  fireEvent.click(within(dialog).getByRole('button', { name: '기획부에서 빼기' }))
  await waitFor(() => expect(within(dialog).getByText('아직 어느 부서에도 없어요.')).toBeTruthy())
})

// 부서 직급(부장·부부장)을 바꾸는 일은 member.manage에 더해 rank.manage도 본다(P19).
// 직급이 붙은 소속을 끝내는 것은 그 직급을 거두는 일이기도 해서 서버는 빼기에도 rank.manage를 본다.
test('부서 직급 선택칸과 직급이 붙은 소속 빼기는 rank.manage가 있을 때만 켜진다', async () => {
  const withHead = teamResponse()
  serve(withHead)
  const view = render(<Harness permissions={LEADER_PERMISSIONS} />)
  fireEvent.click(within(await openMenu('이재정')).getByRole('menuitem', { name: '부서 배정' }))
  let dialog = await screen.findByRole('dialog', { name: '이재정의 부서' })
  expect(
    asElement(within(dialog).getByLabelText('재정부 부서 직급'), HTMLSelectElement).disabled,
  ).toBe(false)
  expect(asElement(within(dialog).getByLabelText('부서 직급'), HTMLSelectElement).disabled).toBe(
    false,
  )
  expect(
    asElement(within(dialog).getByRole('button', { name: '재정부에서 빼기' }), HTMLButtonElement)
      .disabled,
  ).toBe(false)
  view.rerender(
    <Harness permissions={LEADER_PERMISSIONS.filter(action => action !== 'rank.manage')} />,
  )
  dialog = await screen.findByRole('dialog', { name: '이재정의 부서' })
  expect(
    asElement(within(dialog).getByLabelText('재정부 부서 직급'), HTMLSelectElement).disabled,
  ).toBe(true)
  expect(asElement(within(dialog).getByLabelText('부서 직급'), HTMLSelectElement).disabled).toBe(
    true,
  )
  // 부서에 직급 없이 넣는 일은 member.manage만으로 된다. 직급이 붙은 소속은 빼지 못한다.
  expect(
    asElement(within(dialog).getByRole('button', { name: '부서에 넣기' }), HTMLButtonElement)
      .disabled,
  ).toBe(false)
  expect(within(dialog).queryByRole('button', { name: '재정부에서 빼기' })).toBeNull()
})

test('직급 없는 부서 소속은 member.manage만으로 뺀다', async () => {
  const placed = teamResponse()
  placed.members[2]!.departments = [{ id: 'd2', rank: null }]
  const api = serve(placed)
  api.on('POST', '/api/organizations/c1/members/m3/departments/d2/remove', () =>
    json(teamResponse()),
  )
  render(<Harness permissions={['council.view', 'member.manage']} />)
  fireEvent.click(within(await openMenu('박새내')).getByRole('menuitem', { name: '부서 배정' }))
  const dialog = await screen.findByRole('dialog', { name: '박새내의 부서' })
  const remove = within(dialog).getByRole('button', {
    name: '기획부에서 빼기',
  }) as HTMLButtonElement
  expect(remove.disabled).toBe(false)
  fireEvent.click(remove)
  await waitFor(() => expect(within(dialog).getByText('아직 어느 부서에도 없어요.')).toBeTruthy())
  expect(posts(api)).toHaveLength(1)
})

// 직급을 골라 둔 채 rank.manage를 잃으면 칸은 꺼지고 비어 보이지만 고른 값은 남아 있다. 그 값을 보내면 안 된다.
test('부서 직급을 골라 둔 채 rank.manage를 잃으면 부서에 넣어도 직급을 보내지 않는다', async () => {
  const api = serve()
  api.on('POST', '/api/organizations/c1/members/m3/departments', () => json(teamResponse()))
  const view = render(<Harness permissions={LEADER_PERMISSIONS} />)
  fireEvent.click(within(await openMenu('박새내')).getByRole('menuitem', { name: '부서 배정' }))
  let dialog = await screen.findByRole('dialog', { name: '박새내의 부서' })
  fireEvent.change(within(dialog).getByLabelText('부서 직급'), { target: { value: 'vice_head' } })
  expect(asElement(within(dialog).getByLabelText('부서 직급'), HTMLSelectElement).value).toBe(
    'vice_head',
  )
  view.rerender(
    <Harness permissions={LEADER_PERMISSIONS.filter(action => action !== 'rank.manage')} />,
  )
  dialog = await screen.findByRole('dialog', { name: '박새내의 부서' })
  expect(asElement(within(dialog).getByLabelText('부서 직급'), HTMLSelectElement).disabled).toBe(
    true,
  )
  fireEvent.click(within(dialog).getByRole('button', { name: '부서에 넣기' }))
  await waitFor(() => expect(posts(api)).toHaveLength(1))
  expect(posts(api)[0]!.body).toEqual({ departmentId: 'd1', rank: null })
})

test('부회장 직급은 확인 없이 바로 주고, 다른 사람의 직급을 바꾸면 학생회를 다시 읽지 않는다', async () => {
  const api = serve()
  const promoted = teamResponse()
  promoted.members[1]!.councilRank = 'vice_president'
  api.on('POST', '/api/organizations/c1/members/m2/rank', () => json(promoted))
  const changed = vi.fn()
  render(<Harness permissions={LEADER_PERMISSIONS} onOwnChange={changed} />)
  fireEvent.click(
    within(await openMenu('이재정')).getByRole('menuitem', { name: '부위원장 직급 주기' }),
  )
  await waitFor(() => expect(row('이재정').textContent).toContain('부위원장'))
  expect(api.calls.find(call => call.path.endsWith('/rank'))?.body).toEqual({
    rank: 'vice_president',
  })
  expect(changed).not.toHaveBeenCalled()
})

test('내 직급을 바꾸면 학생회를 다시 읽어 권한을 새로 받는다', async () => {
  const api = serve()
  const promoted = teamResponse()
  promoted.members[1]!.councilRank = 'vice_president'
  api.on('POST', '/api/organizations/c1/members/m2/rank', () => json(promoted))
  const changed = vi.fn()
  render(<Harness permissions={LEADER_PERMISSIONS} memberId="m2" onOwnChange={changed} />)
  fireEvent.click(
    within(await openMenu('이재정')).getByRole('menuitem', { name: '부위원장 직급 주기' }),
  )
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
  fireEvent.click(within(dialog).getAllByRole('button', { name: '닫기' })[0]!)
  await noDialog()
  expect(posts(api)).toEqual([])
  fireEvent.click(within(await openMenu('박새내')).getByRole('menuitem', { name: '내보내기' }))
  dialog = await screen.findByRole('dialog', { name: '박새내님을 내보낼까요?' })
  fireEvent.click(within(dialog).getByRole('button', { name: '내보내기' }))
  await waitFor(() => expect(shown('박새내')).toBe(false))
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
  expect(
    asElement(within(dialog).getAllByRole('button', { name: '닫기' })[0]!, HTMLButtonElement)
      .disabled,
  ).toBe(true)
  fireEvent.click(confirm)
  fireEvent.click(confirm)
  // 보내는 동안에는 Escape로도 닫히지 않는다.
  fireEvent.keyDown(dialog, { key: 'Escape' })
  expect(screen.getByRole('dialog', { name: '박새내님을 내보낼까요?' })).toBeTruthy()
  expect(posts(api)).toHaveLength(1)
  pending.resolve(json(withoutMember('m3')))
  await waitFor(() => expect(shown('박새내')).toBe(false))
  await noDialog()
  expect(posts(api)).toHaveLength(1)
})

test('회장 넘기기는 확인한 뒤 넘기고 학생회를 다시 읽는다. 이미 바뀌었다는 답이 오면 닫고 까닭을 쪽에 보이며 다시 보내지 않는다', async () => {
  const api = serve()
  let first = true
  api.on('POST', '/api/organizations/c1/president/transfer', () => {
    if (first) {
      first = false
      return json({ error: 'NOT_FOUND' }, 404)
    }
    return json(teamResponse())
  })
  const changed = vi.fn()
  render(<Harness permissions={PRESIDENT_PERMISSIONS} onOwnChange={changed} />)
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

// 오래된 화면 때문에 막힌 409는 같은 요청을 다시 보내도 같은 답이므로, 대화상자를 닫고 목록을 다시 읽고 까닭을 쪽에 보인다.
test('내보내기나 회장 넘기기가 오래된 화면 때문에 409로 막히면 대화상자를 닫고 목록을 다시 읽고 까닭을 쪽에 보인다', async () => {
  for (const { permissions, name, item, title, confirm, path, code, text } of [
    {
      permissions: LEADER_PERMISSIONS,
      name: '박새내',
      item: '내보내기',
      title: '박새내님을 내보낼까요?',
      confirm: '내보내기',
      path: '/members/m3/remove',
      code: 'PRESIDENT_CANNOT_LEAVE',
      text: '회장은 내보낼 수 없어요. 먼저 회장을 넘겨 주세요.',
    },
    {
      permissions: LEADER_PERMISSIONS,
      name: '박새내',
      item: '내보내기',
      title: '박새내님을 내보낼까요?',
      confirm: '내보내기',
      path: '/members/m3/remove',
      code: 'CANNOT_REMOVE_SELF',
      text: '나를 내보낼 수는 없어요.',
    },
    {
      permissions: PRESIDENT_PERMISSIONS,
      name: '이재정',
      item: '위원장 넘기기',
      title: '이재정님에게 위원장 직급을 넘길까요?',
      confirm: '넘기기',
      path: '/president/transfer',
      code: 'ALREADY_PRESIDENT',
      text: '이미 회장이에요.',
    },
  ]) {
    const api = mockApi()
    let reads = 0
    api.on('GET', '/api/organizations/c1/members', () => {
      reads++
      return json(teamResponse())
    })
    api.on('POST', `/api/organizations/c1${path}`, () => json({ error: code }, 409))
    render(<Harness permissions={permissions} />)
    fireEvent.click(within(await openMenu(name)).getByRole('menuitem', { name: item }))
    const dialog = await screen.findByRole('dialog', { name: title })
    fireEvent.click(within(dialog).getByRole('button', { name: confirm }))
    await noDialog()
    expect(screen.getByText(text), code).toBeTruthy()
    await waitFor(() => expect(reads, `${code} 목록 다시 읽기`).toBe(2))
    expect(posts(api), code).toHaveLength(1)
    cleanup()
  }
})

test('확인 대화상자는 서버가 잠시 실패하면 까닭을 안에 보이고 다시 눌러 보낼 수 있다', async () => {
  const api = serve()
  let first = true
  api.on('POST', '/api/organizations/c1/members/m3/remove', () => {
    if (first) {
      first = false
      return json({ error: 'Internal server error' }, 500)
    }
    return json(withoutMember('m3'))
  })
  render(<Harness permissions={LEADER_PERMISSIONS} />)
  fireEvent.click(within(await openMenu('박새내')).getByRole('menuitem', { name: '내보내기' }))
  const dialog = await screen.findByRole('dialog', { name: '박새내님을 내보낼까요?' })
  fireEvent.click(within(dialog).getByRole('button', { name: '내보내기' }))
  expect(await within(dialog).findByText('저장하지 못했어요. 다시 시도해 주세요.')).toBeTruthy()
  fireEvent.click(within(dialog).getByRole('button', { name: '내보내기' }))
  await waitFor(() => expect(shown('박새내')).toBe(false))
  expect(posts(api)).toHaveLength(2)
})

test('확인 대화상자가 열린 채 대상이 목록에서 사라지면 닫히고, 아무것도 보내지 않는다', async () => {
  const api = mockApi()
  let reads = 0
  api.on('GET', '/api/organizations/c1/members', () =>
    json(reads++ === 0 ? teamResponse() : withoutMember('m3')),
  )
  api.on('GET', '/api/organizations/c1/invite', () => json({ code: 'ABCD2345' }))
  render(<Harness permissions={LEADER_PERMISSIONS} />)
  fireEvent.click(within(await openMenu('박새내')).getByRole('menuitem', { name: '내보내기' }))
  await screen.findByRole('dialog', { name: '박새내님을 내보낼까요?' })
  fireEvent.click(screen.getByText('목록 다시 읽기'))
  await noDialog()
  expect(shown('박새내')).toBe(false)
  expect(posts(api)).toEqual([])
})

test('확인 대화상자가 열린 채 권한을 잃으면 닫히고, 다시 보낼 수 없다', async () => {
  for (const { permissions, lost, name, title, item } of [
    {
      permissions: LEADER_PERMISSIONS,
      lost: MEMBER_PERMISSIONS,
      name: '박새내',
      title: '박새내님을 내보낼까요?',
      item: '내보내기',
    },
    {
      permissions: PRESIDENT_PERMISSIONS,
      lost: LEADER_PERMISSIONS,
      name: '이재정',
      title: '이재정님에게 위원장 직급을 넘길까요?',
      item: '위원장 넘기기',
    },
    // 부서 직급이 있는 사람을 내보내는 확인은 rank.manage를 잃어도 닫힌다.
    {
      permissions: LEADER_PERMISSIONS,
      lost: ['council.view', 'member.manage'] as Action[],
      name: '이재정',
      title: '이재정님을 내보낼까요?',
      item: '내보내기',
    },
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
  api.on('GET', '/api/organizations/c1/members', () =>
    json(reads++ === 0 ? teamResponse() : withoutMember('m3')),
  )
  api.on('GET', '/api/organizations/c1/invite', () => json({ code: 'ABCD2345' }))
  api.on('POST', '/api/organizations/c1/members/m3/departments', () =>
    json({ error: 'NOT_FOUND' }, 404),
  )
  api.on('POST', '/api/organizations/c1/members/m2/rank', () =>
    json({ error: 'Internal server error' }, 500),
  )
  render(<Harness permissions={LEADER_PERMISSIONS} />)
  fireEvent.click(within(await openMenu('박새내')).getByRole('menuitem', { name: '부서 배정' }))
  const dialog = await screen.findByRole('dialog', { name: '박새내의 부서' })
  fireEvent.click(within(dialog).getByRole('button', { name: '부서에 넣기' }))
  await noDialog()
  expect(shown('박새내')).toBe(false)
  expect(screen.getByText('이미 바뀌었어요. 목록을 새로 불러왔어요.')).toBeTruthy()
  fireEvent.click(
    within(await openMenu('이재정')).getByRole('menuitem', { name: '부위원장 직급 주기' }),
  )
  expect(await screen.findByText('저장하지 못했어요. 다시 시도해 주세요.')).toBeTruthy()
  expect(screen.queryByText('이미 바뀌었어요. 목록을 새로 불러왔어요.')).toBeNull()
})

test('쪽에서 한 동작이 실패하면 휴대폰 화면에서도 보이도록 오류 문구를 화면 안으로 스크롤한다', async () => {
  const api = serve()
  api.on('POST', '/api/organizations/c1/members/m2/rank', () =>
    json({ error: 'Internal server error' }, 500),
  )
  const scrollIntoView = vi.fn()
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
    value: scrollIntoView,
    configurable: true,
    writable: true,
  })
  try {
    render(<Harness permissions={LEADER_PERMISSIONS} />)
    fireEvent.click(
      within(await openMenu('이재정')).getByRole('menuitem', { name: '부위원장 직급 주기' }),
    )
    const alert = await screen.findByRole('alert')
    await waitFor(() => expect(scrollIntoView).toHaveBeenCalledTimes(1))
    expect(scrollIntoView).toHaveBeenCalledWith({ block: 'nearest' })
    expect((scrollIntoView.mock.contexts[0] as HTMLElement).contains(alert)).toBe(true)
  } finally {
    delete (HTMLElement.prototype as unknown as Record<string, unknown>).scrollIntoView
  }
  expect(posts(api)).toHaveLength(1)
})

// 겸직자는 두 묶음에 줄이 있다. 연 묶음의 줄로 돌아가야 화면이 다른 묶음으로 뛰지 않는다.
test('두 묶음에 든 사람의 ⋯ 메뉴로 연 대화상자를 닫으면 포커스가 연 묶음의 그 줄로 돌아간다', async () => {
  const team = teamResponse()
  team.members[1] = {
    ...team.members[1]!,
    departments: [
      { id: 'd1', rank: 'head' },
      { id: 'd2', rank: null },
    ],
  }
  serve(team)
  render(<Harness permissions={LEADER_PERMISSIONS} />)
  for (const group of ['재정부', '기획부']) {
    const list = within(await screen.findByRole('list', { name: `${group} 구성원` }))
    const trigger = list.getByRole('button', { name: '이재정 동작' })
    fireEvent.keyDown(trigger, { key: 'Enter' })
    fireEvent.click(
      within(await screen.findByRole('menu')).getByRole('menuitem', { name: '부서 배정' }),
    )
    fireEvent.keyDown(await screen.findByRole('dialog', { name: '이재정의 부서' }), {
      key: 'Escape',
    })
    await noDialog()
    await waitFor(() => expect(document.activeElement, group).toBe(trigger))
    await settle()
    expect(document.activeElement, group).toBe(trigger)
  }
})

// Radix는 Trigger로 연 대화상자만 닫을 때 포커스를 돌려준다. ⋯ 메뉴 항목으로 연 대화상자는 직접 돌려준다.
test('메뉴 항목으로 연 대화상자를 닫으면 포커스가 그 운영진의 ⋯ 버튼으로 돌아간다', async () => {
  serve()
  render(<Harness permissions={LEADER_PERMISSIONS} />)
  fireEvent.click(within(await openMenu('박새내')).getByRole('menuitem', { name: '내보내기' }))
  const confirm = await screen.findByRole('dialog', { name: '박새내님을 내보낼까요?' })
  fireEvent.click(within(confirm).getAllByRole('button', { name: '닫기' })[0]!)
  await noDialog()
  await waitFor(() =>
    expect(document.activeElement).toBe(screen.getByRole('button', { name: '박새내 동작' })),
  )
  fireEvent.click(within(await openMenu('이재정')).getByRole('menuitem', { name: '부서 배정' }))
  const assign = await screen.findByRole('dialog', { name: '이재정의 부서' })
  fireEvent.keyDown(assign, { key: 'Escape' })
  await noDialog()
  await waitFor(() =>
    expect(document.activeElement).toBe(screen.getByRole('button', { name: '이재정 동작' })),
  )
  // 대화상자를 닫을 때 Radix가 거는 지연 작업이 끝난 뒤에도 포커스가 그대로다.
  await settle()
  expect(document.activeElement).toBe(screen.getByRole('button', { name: '이재정 동작' }))
})

// 닫힌 까닭을 쪽 위에 보인다(자주 잡힌 것 1번, vada-docs#24). 서버 답이 아니라 목록·권한을 다시 읽어 닫힐 때도 같다.
const GONE = '이미 바뀌었어요. 목록을 새로 불러왔어요.'
const LOST = '권한이 바뀌었어요. 화면을 새로 불러왔어요.'

test('부서 배정·확인 대화상자가 열린 채 대상이 목록에서 사라져 닫히면 까닭을 쪽에 보인다', async () => {
  for (const { item, title } of [
    { item: '부서 배정', title: '박새내의 부서' },
    { item: '내보내기', title: '박새내님을 내보낼까요?' },
  ]) {
    const api = mockApi()
    let reads = 0
    api.on('GET', '/api/organizations/c1/members', () =>
      json(reads++ === 0 ? teamResponse() : withoutMember('m3')),
    )
    api.on('GET', '/api/organizations/c1/invite', () => json({ code: 'ABCD2345' }))
    render(<Harness permissions={LEADER_PERMISSIONS} />)
    fireEvent.click(within(await openMenu('박새내')).getByRole('menuitem', { name: item }))
    await screen.findByRole('dialog', { name: title })
    fireEvent.click(screen.getByText('목록 다시 읽기'))
    await noDialog()
    expect(await screen.findByText(GONE), item).toBeTruthy()
    cleanup()
  }
})

test('부서 배정·확인 대화상자가 열린 채 권한을 잃어 닫히면 까닭을 쪽에 보인다', async () => {
  for (const { item, title } of [
    { item: '부서 배정', title: '박새내의 부서' },
    { item: '내보내기', title: '박새내님을 내보낼까요?' },
  ]) {
    serve()
    const view = render(<Harness permissions={LEADER_PERMISSIONS} />)
    fireEvent.click(within(await openMenu('박새내')).getByRole('menuitem', { name: item }))
    await screen.findByRole('dialog', { name: title })
    view.rerender(<Harness permissions={MEMBER_PERMISSIONS} />)
    await noDialog()
    expect(await screen.findByText(LOST), item).toBeTruthy()
    cleanup()
  }
})

test('열린 초대 창은 초대 권한을 잃으면 닫히고 까닭을 쪽에 보인다', async () => {
  serve()
  const view = render(<Harness permissions={LEADER_PERMISSIONS} />)
  const sheet = await openInvite()
  await within(sheet).findByRole('region', { name: '초대 링크' })
  view.rerender(<Harness permissions={MEMBER_PERMISSIONS} />)
  await noDialog()
  expect(screen.queryByRole('button', { name: '구성원 초대' })).toBeNull()
  expect(await screen.findByText(LOST)).toBeTruthy()
})

test('내보내기가 성공해 확인 대화상자가 닫힐 때는 까닭 문구를 보이지 않는다', async () => {
  const api = serve()
  api.on('POST', '/api/organizations/c1/members/m3/remove', () => json(withoutMember('m3')))
  render(<Harness permissions={LEADER_PERMISSIONS} />)
  fireEvent.click(within(await openMenu('박새내')).getByRole('menuitem', { name: '내보내기' }))
  const dialog = await screen.findByRole('dialog', { name: '박새내님을 내보낼까요?' })
  fireEvent.click(within(dialog).getByRole('button', { name: '내보내기' }))
  await waitFor(() => expect(shown('박새내')).toBe(false))
  await noDialog()
  await settle()
  expect(screen.queryByText(GONE)).toBeNull()
  expect(screen.queryByText(LOST)).toBeNull()
})

// 내 요청이 성공해 내 권한이 줄고 학생회를 다시 읽은 결과는 바깥 변경이 아니므로 경고하지 않는다.
function SelfChanging({ from, memberId }: { from: Action[]; memberId: string }) {
  const [read, setRead] = useState({ permissions: from, reading: outside })
  return (
    <Harness
      permissions={read.permissions}
      reading={read.reading}
      memberId={memberId}
      onOwnChange={() => setRead({ permissions: MEMBER_PERMISSIONS, reading: { own: true } })}
    />
  )
}

test('회장 넘기기가 성공해 내 권한이 줄어도 권한이 바뀌었다는 경고를 보이지 않는다', async () => {
  const api = serve()
  api.on('POST', '/api/organizations/c1/president/transfer', () => json(teamResponse()))
  render(<SelfChanging from={PRESIDENT_PERMISSIONS} memberId="m1" />)
  fireEvent.click(within(await openMenu('이재정')).getByRole('menuitem', { name: '위원장 넘기기' }))
  const dialog = await screen.findByRole('dialog', { name: '이재정님에게 위원장 직급을 넘길까요?' })
  fireEvent.click(within(dialog).getByRole('button', { name: '넘기기' }))
  await waitFor(() => expect(screen.queryByRole('region', { name: '초대 링크' })).toBeNull())
  await settle()
  expect(screen.queryByText(LOST)).toBeNull()
})

test('내 부서 배정을 고쳐 내 권한이 줄어 대화상자가 닫혀도 권한이 바뀌었다는 경고를 보이지 않는다', async () => {
  const api = serve()
  api.on('POST', '/api/organizations/c1/members/m2/departments/d1/remove', () =>
    json(teamResponse()),
  )
  render(<SelfChanging from={LEADER_PERMISSIONS} memberId="m2" />)
  fireEvent.click(within(await openMenu('이재정')).getByRole('menuitem', { name: '부서 배정' }))
  const dialog = await screen.findByRole('dialog', { name: '이재정의 부서' })
  fireEvent.click(within(dialog).getByRole('button', { name: '재정부에서 빼기' }))
  await noDialog()
  await settle()
  expect(screen.queryByText(LOST)).toBeNull()
  expect(screen.queryByText(GONE)).toBeNull()
})

// 내 변경 뒤 학생회를 다시 읽어 화면에 반영된 다음에 바깥에서 생긴 변화는 알린다.
function SelfThenOutside({ memberId }: { memberId: string }) {
  const [read, setRead] = useState({ permissions: LEADER_PERMISSIONS, reading: outside })
  return (
    <>
      <Harness
        permissions={read.permissions}
        reading={read.reading}
        memberId={memberId}
        onOwnChange={() =>
          setRead({ permissions: [...LEADER_PERMISSIONS], reading: { own: true } })
        }
      />
      <button
        type="button"
        onClick={() => setRead({ permissions: MEMBER_PERMISSIONS, reading: { own: false } })}
      >
        바깥에서 권한 빼기
      </button>
    </>
  )
}

test('내 변경 뒤 다시 읽기가 끝난 다음 바깥에서 권한이 줄면 경고를 보인다', async () => {
  const api = serve()
  api.on('POST', '/api/organizations/c1/members/m2/departments/d1/remove', () =>
    json(teamResponse()),
  )
  render(<SelfThenOutside memberId="m2" />)
  fireEvent.click(within(await openMenu('이재정')).getByRole('menuitem', { name: '부서 배정' }))
  const dialog = await screen.findByRole('dialog', { name: '이재정의 부서' })
  fireEvent.click(within(dialog).getByRole('button', { name: '재정부에서 빼기' }))
  await waitFor(() => expect(posts(api)).toHaveLength(1))
  await settle()
  fireEvent.click(screen.getByText('바깥에서 권한 빼기'))
  await noDialog()
  expect(await screen.findByText(LOST)).toBeTruthy()
})

test('내 변경 뒤 다시 읽기가 끝난 다음 열려 있던 대화상자의 대상이 바깥에서 사라지면 경고를 보인다', async () => {
  const api = mockApi()
  let reads = 0
  api.on('GET', '/api/organizations/c1/members', () =>
    json(reads++ === 0 ? teamResponse() : withoutMember('m2')),
  )
  api.on('GET', '/api/organizations/c1/invite', () => json({ code: 'ABCD2345' }))
  api.on('POST', '/api/organizations/c1/members/m2/departments/d1/remove', () =>
    json(teamResponse()),
  )
  render(<SelfThenOutside memberId="m2" />)
  fireEvent.click(within(await openMenu('이재정')).getByRole('menuitem', { name: '부서 배정' }))
  const dialog = await screen.findByRole('dialog', { name: '이재정의 부서' })
  fireEvent.click(within(dialog).getByRole('button', { name: '재정부에서 빼기' }))
  await waitFor(() => expect(posts(api)).toHaveLength(1))
  await settle()
  fireEvent.click(screen.getByText('목록 다시 읽기'))
  await noDialog()
  expect(await screen.findByText(GONE)).toBeTruthy()
})

// 내 변경 뒤 학생회 다시 읽기가 실패하면 보던 값이 그대로라 억제할 것이 없다. 그 뒤의 바깥 변경은 어느 길로 와도 알린다.
// 첫 다시 읽기(내 변경 뒤)는 실패하고, 그다음 다시 읽기(바깥 변경)는 권한이 줄어든 값을 가져온다.
function OwnReadFails({ memberId }: { memberId: string }) {
  const [read, setRead] = useState({ permissions: LEADER_PERMISSIONS, reading: outside })
  const reads = useRef(0)
  const outsideDrop = () => setRead({ permissions: MEMBER_PERMISSIONS, reading: { own: false } })
  const reread = () => {
    if (reads.current++ > 0) outsideDrop()
  }
  return (
    <>
      <Harness
        permissions={read.permissions}
        reading={read.reading}
        memberId={memberId}
        onOwnChange={reread}
        onCouncilChanged={reread}
      />
      <button type="button" onClick={outsideDrop}>
        바깥에서 권한 빼기
      </button>
    </>
  )
}
const removeOwnDepartment = async (api: ReturnType<typeof mockApi>) => {
  api.on('POST', '/api/organizations/c1/members/m2/departments/d1/remove', () =>
    json(teamResponse()),
  )
  render(<OwnReadFails memberId="m2" />)
  fireEvent.click(within(await openMenu('이재정')).getByRole('menuitem', { name: '부서 배정' }))
  const dialog = await screen.findByRole('dialog', { name: '이재정의 부서' })
  fireEvent.click(within(dialog).getByRole('button', { name: '재정부에서 빼기' }))
  await waitFor(() => expect(posts(api)).toHaveLength(1))
  await settle()
  fireEvent.click(within(dialog).getByRole('button', { name: '닫기' }))
  await noDialog()
}

test('내 변경 뒤 다시 읽기가 실패하고 대화상자를 닫은 다음 코드 바꾸기가 403이면 초대 창이 닫히고 까닭을 보인다', async () => {
  const api = serve()
  api.on('POST', '/api/organizations/c1/invite/rotate', () => json({ error: 'FORBIDDEN' }, 403))
  await removeOwnDepartment(api)
  const sheet = await openInvite()
  fireEvent.click(await within(sheet).findByRole('button', { name: '코드 바꾸기' }))
  const dialog = screen.getByRole('dialog', { name: '초대 코드를 바꿀까요?' })
  fireEvent.click(within(dialog).getByRole('button', { name: '코드 바꾸기' }))
  await noDialog()
  expect(screen.queryByRole('button', { name: '구성원 초대' })).toBeNull()
  expect(await screen.findByText(LOST)).toBeTruthy()
})

test('내 변경 뒤 다시 읽기가 실패하고 대화상자를 닫은 다음 바깥에서 권한이 줄면 까닭을 보인다', async () => {
  await removeOwnDepartment(serve())
  fireEvent.click(screen.getByText('바깥에서 권한 빼기'))
  expect(await screen.findByText(LOST)).toBeTruthy()
})

test('대화상자 없는 내 변경(내 부위원장 직급) 뒤 다시 읽기가 실패한 다음 바깥에서 권한이 줄면 까닭을 보인다', async () => {
  const api = serve()
  api.on('POST', '/api/organizations/c1/members/m2/rank', () => json(teamResponse()))
  render(<OwnReadFails memberId="m2" />)
  fireEvent.click(
    within(await openMenu('이재정')).getByRole('menuitem', { name: '부위원장 직급 주기' }),
  )
  await waitFor(() => expect(posts(api)).toHaveLength(1))
  await settle()
  fireEvent.click(screen.getByText('바깥에서 권한 빼기'))
  expect(await screen.findByText(LOST)).toBeTruthy()
})
