// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { Action, TeamMember, TeamResponse } from '@vada/contracts'
import {
  councilView,
  LEADER_PERMISSIONS,
  MEMBER_PERMISSIONS,
  PRESIDENT_PERMISSIONS,
  teamResponse,
} from '@/test-support/council-fixtures'
import { deferredResponse, json, mockApi } from '@/test-support/mock-api'
import type { Reading } from '@/lib/use-lost'
import Organization from './Organization'
import { useTeam } from './useTeam'

// 사람 상세와 되돌리기(기능 023 조각 4, DEC-91, 정한 것 5). 줄을 누르면 상세가 열리고, 옮기기·빼기·더하기·직급·부회장은
// 확인 창 없이 저장한 뒤 토스트의 [되돌리기]로 이전 상태를 같은 편성 API로 보낸다.
afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})
const titles = { president: '위원장', vicePresident: '부위원장', head: '국장', viceHead: '차장' }
const outside: Reading = { own: false }

function Harness({
  permissions,
  memberId,
  onOwnChange = () => {},
}: {
  permissions: Action[]
  memberId?: string
  onOwnChange?: () => void
}) {
  const team = useTeam('c1', () => {})
  const base = councilView('c1', { permissions, memberId })
  return (
    <>
      <Organization
        view={{ ...base, council: { ...base.council, titles } }}
        reading={outside}
        team={team}
        onCouncilChanged={() => {}}
        onOwnChange={onOwnChange}
      />
      <button type="button" onClick={team.reload}>
        목록 다시 읽기
      </button>
    </>
  )
}

// 이재정(m2)의 소속만 바꾼 목록.
function withPlacements(
  departments: TeamMember['departments'],
  rank: TeamMember['councilRank'] = null,
) {
  const team = teamResponse()
  team.members = team.members.map(member =>
    member.id === 'm2' ? { ...member, departments, councilRank: rank } : member,
  )
  return team
}
const ORIGINAL = withPlacements([{ id: 'd1', rank: 'head' }])

function serve(team: TeamResponse = ORIGINAL) {
  const api = mockApi()
  api.on('GET', '/api/organizations/c1/members', () => json(team))
  return api
}
const posts = (api: ReturnType<typeof mockApi>) =>
  api.calls.filter(call => call.method === 'POST').map(call => [call.path, call.body])

async function openPerson(name: string) {
  await screen.findByRole('heading', { name: '회장단' })
  const rows = screen.getAllByRole('button', { name: new RegExp(`^${name}`) })
  fireEvent.click(rows[0]!)
  return screen.findByRole('dialog', { name })
}
async function pick(sheet: HTMLElement, menu: string, item: string) {
  fireEvent.keyDown(within(sheet).getByRole('button', { name: menu }), { key: 'Enter' })
  fireEvent.click(await screen.findByRole('menuitem', { name: item }))
}
const toast = () => screen.findByRole('status')
const undo = async () =>
  fireEvent.click(within(await toast()).getByRole('button', { name: '되돌리기' }))

test('줄을 누르면 상세에 이름, 들어온 때, 학생회 직급, 부서마다 직급 고르기(차장 포함)와 회장의 동작이 있다', async () => {
  serve()
  render(<Harness permissions={PRESIDENT_PERMISSIONS} />)
  const sheet = await openPerson('이재정')
  expect(within(sheet).getByText('10월 2일 (금) 10:00 들어옴')).toBeTruthy()
  expect(within(sheet).getByRole('region', { name: '학생회 직급' }).textContent).toContain('없음')
  const rank = within(sheet).getByRole('combobox', {
    name: '재정부 부서 직급',
  }) as HTMLSelectElement
  expect(rank.value).toBe('head')
  expect([...rank.options].map(option => option.textContent)).toEqual(['직급 없음', '국장', '차장'])
  for (const name of [
    '부위원장 지정',
    '재정부에서 옮기기',
    '재정부에서 빼기',
    '부서 더하기',
    '위원장 넘기기',
    '내보내기',
  ])
    expect(within(sheet).getByRole('button', { name }), name).toBeTruthy()
  // 사람 줄에 ⋯ 메뉴는 없다.
  for (const name of ['김회장', '이재정', '박새내'])
    expect(screen.queryByRole('button', { name: `${name} 동작`, hidden: true })).toBeNull()
})

test('직급 없는 운영진은 상세를 보기만 하고 동작이 없다', async () => {
  serve()
  render(<Harness permissions={MEMBER_PERMISSIONS} />)
  const sheet = await openPerson('이재정')
  expect(within(sheet).getByText('국장')).toBeTruthy()
  expect(within(sheet).queryByRole('combobox')).toBeNull()
  expect(
    within(sheet)
      .getAllByRole('button')
      .map(button => button.getAttribute('aria-label') ?? button.textContent),
  ).toEqual(['닫기'])
})

test('옮기기는 확인 없이 저장하고 토스트의 [되돌리기]가 옛 부서와 옛 직급으로 돌린다. 옮긴 사람은 새 부서 묶음에 직급 없이 나온다', async () => {
  const api = serve()
  const moved = withPlacements([{ id: 'd2', rank: null }])
  api.on('POST', '/api/organizations/c1/members/m2/departments/move', () => json(moved))
  render(<Harness permissions={LEADER_PERMISSIONS} />)
  const sheet = await openPerson('이재정')
  await pick(sheet, '재정부에서 옮기기', '기획부')
  expect((await toast()).textContent).toContain('이재정 옮기기 완료')
  expect(screen.queryByRole('dialog', { name: /옮길까요/ })).toBeNull()
  const planning = screen.getByRole('list', { name: '기획부 구성원', hidden: true })
  expect(within(planning).getByText('이재정')).toBeTruthy()
  expect(within(planning).queryByText('국장')).toBeNull()
  api.on('POST', '/api/organizations/c1/members/m2/departments/move', () => json(ORIGINAL))
  await undo()
  await waitFor(() => expect(screen.queryByRole('status')).toBeNull())
  expect(posts(api)).toEqual([
    [
      '/api/organizations/c1/members/m2/departments/move',
      { fromDepartmentId: 'd1', toDepartmentId: 'd2', rank: null },
    ],
    [
      '/api/organizations/c1/members/m2/departments/move',
      { fromDepartmentId: 'd2', toDepartmentId: 'd1', rank: 'head' },
    ],
  ])
  expect(
    within(screen.getByRole('list', { name: '재정부 구성원', hidden: true })).getByText('국장'),
  ).toBeTruthy()
})

test('빼기·더하기·부서 직급·부위원장 지정의 되돌리기는 이전 상태를 보낸다', async () => {
  const api = serve()
  const cases: [string, () => Promise<unknown>, string, TeamResponse, [string, unknown]][] = [
    [
      '빼기',
      async () =>
        fireEvent.click(
          within(await openPerson('이재정')).getByRole('button', { name: '재정부에서 빼기' }),
        ),
      '/departments/d1/remove',
      withPlacements([]),
      ['/departments', { departmentId: 'd1', rank: 'head' }],
    ],
    [
      '더하기',
      async () => pick(await openPerson('이재정'), '부서 더하기', '기획부'),
      '/departments',
      withPlacements([
        { id: 'd1', rank: 'head' },
        { id: 'd2', rank: null },
      ]),
      ['/departments/d2/remove', {}],
    ],
    [
      '직급',
      async () =>
        fireEvent.change(
          within(await openPerson('이재정')).getByRole('combobox', { name: '재정부 부서 직급' }),
          { target: { value: 'vice_head' } },
        ),
      '/departments',
      withPlacements([{ id: 'd1', rank: 'vice_head' }]),
      ['/departments', { departmentId: 'd1', rank: 'head' }],
    ],
    [
      '부위원장',
      async () =>
        fireEvent.click(
          within(await openPerson('이재정')).getByRole('button', { name: '부위원장 지정' }),
        ),
      '/rank',
      withPlacements([{ id: 'd1', rank: 'head' }], 'vice_president'),
      ['/rank', { rank: null }],
    ],
  ]
  const base = '/api/organizations/c1/members/m2'
  for (const [label, act, path, after, [undoPath, undoBody]] of cases) {
    api.calls.length = 0
    api.on('POST', `${base}${path}`, () => json(after))
    render(<Harness permissions={LEADER_PERMISSIONS} />)
    await act()
    await toast()
    api.on('POST', `${base}${undoPath}`, () => json(ORIGINAL))
    await undo()
    await waitFor(() => expect(posts(api), label).toHaveLength(2))
    expect(posts(api)[1], label).toEqual([`${base}${undoPath}`, undoBody])
    cleanup()
  }
})

test('되돌리기가 실패하면 토스트 자리에 오류를 보인다', async () => {
  const api = serve()
  api.on('POST', '/api/organizations/c1/members/m2/departments/d1/remove', () =>
    json(withPlacements([])),
  )
  api.on('POST', '/api/organizations/c1/members/m2/departments', () => json({ error: 'x' }, 500))
  render(<Harness permissions={LEADER_PERMISSIONS} />)
  fireEvent.click(
    within(await openPerson('이재정')).getByRole('button', { name: '재정부에서 빼기' }),
  )
  await undo()
  expect(
    await within(screen.getByRole('status')).findByText('저장하지 못했어요. 다시 시도해 주세요.'),
  ).toBeTruthy()
})

test('보내는 동안 다시 눌러도 한 번만 보낸다', async () => {
  const api = serve()
  const pending = deferredResponse()
  api.on('POST', '/api/organizations/c1/members/m2/rank', () => pending.promise)
  render(<Harness permissions={LEADER_PERMISSIONS} />)
  const sheet = await openPerson('이재정')
  fireEvent.click(within(sheet).getByRole('button', { name: '부위원장 지정' }))
  fireEvent.click(within(sheet).getByRole('button', { name: '부위원장 지정' }))
  // 직급 선택칸도 보내는 동안 꺼진다. 꺼진 칸에 바뀜이 와도(이미 열린 목록) 다시 보내지 않는다.
  const rank = within(sheet).getByRole('combobox', {
    name: '재정부 부서 직급',
  }) as HTMLSelectElement
  expect(rank.disabled).toBe(true)
  fireEvent.change(rank, { target: { value: 'vice_head' } })
  expect(posts(api)).toHaveLength(1)
  pending.resolve(json(withPlacements([{ id: 'd1', rank: 'head' }], 'vice_president')))
  expect(await within(sheet).findByRole('button', { name: '부위원장 해제' })).toBeTruthy()
})

test('내 소속을 바꾸거나 되돌리면 학생회를 다시 읽는다', async () => {
  const api = serve()
  api.on('POST', '/api/organizations/c1/members/m2/rank', () => json(ORIGINAL))
  const own = vi.fn()
  render(<Harness permissions={LEADER_PERMISSIONS} memberId="m2" onOwnChange={own} />)
  fireEvent.click(within(await openPerson('이재정')).getByRole('button', { name: '부위원장 지정' }))
  await toast()
  expect(own).toHaveBeenCalledTimes(1)
  await undo()
  await waitFor(() => expect(own).toHaveBeenCalledTimes(2))
})

test('상세는 Esc로 닫히고, 열린 채 대상이 목록에서 사라지면 닫고 까닭을 쪽에 보인다', async () => {
  let team = ORIGINAL
  const api = mockApi()
  api.on('GET', '/api/organizations/c1/members', () => json(team))
  render(<Harness permissions={LEADER_PERMISSIONS} />)
  let sheet = await openPerson('이재정')
  fireEvent.keyDown(sheet, { key: 'Escape' })
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  sheet = await openPerson('이재정')
  team = { ...ORIGINAL, members: ORIGINAL.members.filter(member => member.id !== 'm2') }
  fireEvent.click(screen.getByText('목록 다시 읽기'))
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  expect(await screen.findByText('이미 바뀌었어요. 목록을 새로 불러왔어요.')).toBeTruthy()
})

test('상세에서 내보내면 확인 창 뒤에 보내고, 상세도 함께 닫히며 까닭 문구는 없다', async () => {
  const api = serve()
  api.on('POST', '/api/organizations/c1/members/m3/remove', () =>
    json({
      ...teamResponse(),
      members: teamResponse().members.filter(member => member.id !== 'm3'),
    }),
  )
  render(<Harness permissions={PRESIDENT_PERMISSIONS} />)
  fireEvent.click(within(await openPerson('박새내')).getByRole('button', { name: '내보내기' }))
  const dialog = await screen.findByRole('dialog', { name: '박새내님을 내보낼까요?' })
  fireEvent.click(within(dialog).getByRole('button', { name: '내보내기' }))
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  expect(screen.queryByText('이미 바뀌었어요. 목록을 새로 불러왔어요.')).toBeNull()
  expect(posts(api)).toEqual([['/api/organizations/c1/members/m3/remove', {}]])
})

test('회장 넘기기가 실패하면 확인 창이 남아 오류를 보인다', async () => {
  const api = serve()
  api.on('POST', '/api/organizations/c1/president/transfer', () => json({ error: 'x' }, 500))
  render(<Harness permissions={PRESIDENT_PERMISSIONS} />)
  fireEvent.click(within(await openPerson('이재정')).getByRole('button', { name: '위원장 넘기기' }))
  const dialog = await screen.findByRole('dialog', { name: '이재정님에게 위원장 직급을 넘길까요?' })
  fireEvent.click(within(dialog).getByRole('button', { name: '넘기기' }))
  expect(await within(dialog).findByText('저장하지 못했어요. 다시 시도해 주세요.')).toBeTruthy()
  expect(screen.getByRole('dialog', { name: '이재정님에게 위원장 직급을 넘길까요?' })).toBeTruthy()
})
