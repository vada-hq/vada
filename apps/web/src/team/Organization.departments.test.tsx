// @vitest-environment jsdom
import { useState } from 'react'
import { afterEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { Action, TeamResponse } from '@vada/contracts'
import {
  councilView,
  LEADER_PERMISSIONS,
  MEMBER_PERMISSIONS,
  teamResponse,
} from '@/test-support/council-fixtures'
import { deferredResponse, json, mockApi } from '@/test-support/mock-api'
import Organization from './Organization'
import { useTeam } from './useTeam'
import { asElement } from '@/test-support/elements'
import { settle } from '@/test-support/settle'
import { navigate } from '@/lib/app-location'

afterEach(() => {
  cleanup()
  window.history.replaceState(null, '', '/')
  vi.unstubAllGlobals()
})

// 조직 화면의 부서 쪽(DEC-91, 기능 023 조각 2): 묶음 배치와 부서 머리에서 고치기.
// "목록 다시 읽기"는 다른 곳에서 부서가 바뀐 뒤 화면이 목록을 다시 읽는 일(404·403 뒤의 다시 읽기)을 대신한다.
// dropOnForbidden은 실제 작업 공간처럼 403을 받으면 학생회를 다시 읽어 권한이 회장단 밖으로 줄어드는 일을 대신한다.
function Harness({
  permissions,
  dropOnForbidden = false,
}: {
  permissions: Action[]
  dropOnForbidden?: boolean
}) {
  const [dropped, setDropped] = useState(false)
  const team = useTeam('c1', () => {
    if (dropOnForbidden) setDropped(true)
  })
  return (
    <>
      <Organization
        view={councilView('c1', { permissions: dropped ? MEMBER_PERMISSIONS : permissions })}
        reading={{ own: false }}
        team={team}
        onCouncilChanged={() => {}}
        onOwnChange={() => {}}
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
  api.on('GET', '/api/organizations/c1/invite', () => json({ code: 'ABCD2345' }))
  return api
}
const withDepartments = (change: (team: TeamResponse) => void) => {
  const team = teamResponse()
  change(team)
  return json(team)
}
// 기획부(쓰인 적 없는 부서)만 남기지 않고 재정부만 남긴 목록.
const financeOnly = () =>
  withDepartments(team => {
    team.departments = team.departments.slice(0, 1)
  })
async function openMenu(name: string) {
  fireEvent.keyDown(await screen.findByRole('button', { name: `${name} 동작` }), { key: 'Enter' })
  return screen.findByRole('menu')
}
const groups = () => screen.getAllByRole('heading', { level: 2 }).map(item => item.textContent)
const group = (name: string) => screen.getByRole('region', { name })
const loaded = () => screen.findByRole('heading', { name: '회장단' })
const gone = (name: string) =>
  waitFor(() => expect(screen.queryByRole('heading', { name })).toBeNull())
const posts = (api: ReturnType<typeof mockApi>) => api.calls.filter(call => call.method === 'POST')
const noDialog = () => waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())

test('홈에서 조직에서 정하기로 오면 재정 역할 부서가 로드된 뒤 그 부서로 스크롤하고 초점을 옮긴다', async () => {
  serve()
  navigate('/people/c1', { pageState: 'finance' })
  const scrollIntoView = vi.fn()
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
    value: scrollIntoView,
    configurable: true,
  })
  try {
    render(<Harness permissions={LEADER_PERMISSIONS} />)
    await loaded()
    await waitFor(() => expect(scrollIntoView).toHaveBeenCalledTimes(1))
    expect(scrollIntoView.mock.contexts[0]).toBe(group('재정부'))
    expect(document.activeElement).toBe(group('재정부'))
  } finally {
    delete (HTMLElement.prototype as unknown as Record<string, unknown>).scrollIntoView
  }
})
test('홈에서 부장 정하기로 오면 그 부서로 스크롤하고 초점을 옮긴다', async () => {
  serve()
  navigate('/people/c1', { pageState: { department: 'd2' } })
  const scrollIntoView = vi.fn()
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
    value: scrollIntoView,
    configurable: true,
  })
  try {
    render(<Harness permissions={LEADER_PERMISSIONS} />)
    await loaded()
    await waitFor(() => expect(scrollIntoView).toHaveBeenCalledTimes(1))
    expect(scrollIntoView.mock.contexts[0]).toBe(group('기획부'))
    expect(document.activeElement).toBe(group('기획부'))
  } finally {
    delete (HTMLElement.prototype as unknown as Record<string, unknown>).scrollIntoView
  }
})

async function openAdd() {
  fireEvent.click(await screen.findByRole('button', { name: '부서 추가' }))
  return screen.findByRole('form', { name: '부서 추가' })
}
async function openRename(name: string) {
  fireEvent.click(within(await openMenu(name)).getByRole('menuitem', { name: '이름 바꾸기' }))
  return screen.findByRole('form', { name: '부서 이름 바꾸기' })
}

test('위에서부터 회장단, 부서마다 이름·재정 배지·인원(부장이 없으면 부장 없음)과 그 부서 사람이 있고, 직급 없는 운영진에게는 미배정이 맨 아래이며 부서 동작이 없다', async () => {
  serve()
  render(<Harness permissions={MEMBER_PERMISSIONS} />)
  await loaded()
  expect(groups()).toEqual(['회장단', '재정부', '기획부', '미배정 구성원'])
  expect(group('회장단').textContent).toContain('김회장')
  expect(within(group('재정부')).getByText('재정')).toBeTruthy()
  expect(within(group('재정부')).getByText('1명')).toBeTruthy()
  expect(within(group('기획부')).getByText('부장 없음 · 0명')).toBeTruthy()
  expect(within(group('기획부')).getByText('부원 0명')).toBeTruthy()
  expect(screen.queryByRole('button', { name: '부서 추가' })).toBeNull()
  expect(screen.queryByRole('button', { name: /동작$/ })).toBeNull()
})

test('회장단에게는 미배정 구성원이 맨 위이고 부서 목록 끝에 [부서 추가]가 있다', async () => {
  serve()
  render(<Harness permissions={LEADER_PERMISSIONS} />)
  await loaded()
  expect(groups()).toEqual(['미배정 구성원', '회장단', '재정부', '기획부'])
  const add = screen.getByRole('button', { name: '부서 추가' })
  expect(
    group('기획부').compareDocumentPosition(add) & Node.DOCUMENT_POSITION_FOLLOWING,
  ).toBeTruthy()
  expect(screen.getByRole('button', { name: '재정부 동작' })).toBeTruthy()
})

test('부회장이 둘이면 회장단에 둘 다, 두 부서에 든 사람은 두 묶음에, 부장이 둘이면 둘 다 부장 배지가 붙는다', async () => {
  const team = teamResponse()
  team.members.push(
    {
      id: 'm4',
      name: '최부회',
      councilRank: 'vice_president',
      departments: [{ id: 'd2', rank: 'head', actions: [] }],
      joinedAt: '2026-10-03T01:00:00.000Z',
      actions: [],
    },
    {
      id: 'm5',
      name: '정부회',
      councilRank: 'vice_president',
      departments: [],
      joinedAt: '2026-10-04T01:00:00.000Z',
      actions: [],
    },
    {
      id: 'm6',
      name: '한겸직',
      councilRank: null,
      departments: [
        { id: 'd1', rank: 'head', actions: [] },
        { id: 'd2', rank: null, actions: [] },
      ],
      joinedAt: '2026-10-05T01:00:00.000Z',
      actions: [],
    },
  )
  serve(team)
  render(<Harness permissions={MEMBER_PERMISSIONS} />)
  await loaded()
  // 이름은 모두 세 글자다.
  // 부서 카드는 부장 칸과 부원 칸이라 카드 안의 사람 카드를 차례로 본다.
  const names = (name: string) =>
    within(group(name))
      .getAllByRole('listitem')
      .map(item => item.textContent?.slice(0, 3))
  // 묶음 안은 직급 순, 같은 직급은 이름 가나다순이다(최부회가 먼저 들어왔어도 정부회가 앞).
  expect(names('회장단')).toEqual(['김회장', '정부회', '최부회'])
  expect(names('재정부')).toEqual(['이재정', '한겸직'])
  expect(names('기획부')).toEqual(['최부회', '한겸직'])
  expect(within(group('재정부')).getByText('2명')).toBeTruthy()
  // 부서 묶음의 줄은 그 부서를 빼고 다른 소속만 적는다.
  const rowText = (name: string) =>
    within(group(name))
      .getAllByRole('listitem')
      .map(item => item.textContent?.replace(/\d+월.*$/, ''))
  expect(rowText('재정부')).toEqual(['이재정부장', '한겸직부장기획부'])
  // 부서 묶음에서도 학생회 직급 배지를 붙여 회장단이 부장보다 앞인 까닭이 보인다.
  expect(rowText('기획부')).toEqual(['최부회부회장부장', '한겸직재정부 부장'])
})

test('부서가 없으면 부서 없음이고, 회장단에게만 [부서 추가]가 있다', async () => {
  serve({ members: teamResponse().members, departments: [] })
  const view = render(<Harness permissions={LEADER_PERMISSIONS} />)
  expect(await screen.findByText('부서 없음')).toBeTruthy()
  expect(screen.getByRole('button', { name: '부서 추가' })).toBeTruthy()
  view.rerender(<Harness permissions={MEMBER_PERMISSIONS} />)
  expect(screen.getByText('부서 없음')).toBeTruthy()
  expect(screen.queryByRole('button', { name: '부서 추가' })).toBeNull()
})

test('부서를 불러오지 못하면 다시 시도할 수 있다', async () => {
  const api = mockApi()
  let calls = 0
  api.on('GET', '/api/organizations/c1/members', () =>
    calls++ === 0 ? json({ error: 'Internal server error' }, 500) : json(teamResponse()),
  )
  render(<Harness permissions={MEMBER_PERMISSIONS} />)
  expect(await screen.findByText('조직을 불러오지 못했어요.')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: '다시 시도' }))
  await loaded()
})

test('[부서 추가]를 누르면 이름 칸이 펼쳐진다. 이름 없이 누르면 보내지 않고 칸 아래에 알리며, 같은 이름이면 까닭을 칸 옆에 보인다', async () => {
  const api = serve()
  let taken = false
  api.on('POST', '/api/organizations/c1/departments', () =>
    taken
      ? json({ error: 'DEPARTMENT_NAME_TAKEN' }, 409)
      : withDepartments(team =>
          team.departments.push({ id: 'd3', name: '홍보부', role: null, memberCount: 0 }),
        ),
  )
  render(<Harness permissions={LEADER_PERMISSIONS} />)
  const form = await openAdd()
  const submit = asElement(
    within(form).getByRole('button', { name: '부서 추가' }),
    HTMLButtonElement,
  )
  const input = within(form).getByLabelText('새 부서 이름')
  await waitFor(() => expect(document.activeElement).toBe(input))
  // 보이는 라벨이 있고, 칸 안에 예시 글은 없다.
  expect(within(form).getByText('새 부서 이름').tagName).toBe('LABEL')
  expect(input.getAttribute('placeholder')).toBeNull()
  expect(submit.disabled).toBe(false)
  fireEvent.click(submit)
  expect(within(form).getByText('부서 이름을 입력해 주세요')).toBeTruthy()
  expect(input.getAttribute('aria-invalid')).toBe('true')
  expect(posts(api)).toEqual([])
  fireEvent.change(input, { target: { value: ' 홍보부 ' } })
  expect(within(form).queryByText('부서 이름을 입력해 주세요')).toBeNull()
  fireEvent.click(submit)
  expect(await screen.findByRole('heading', { name: '홍보부' })).toBeTruthy()
  expect(posts(api)[0]?.body).toEqual({ name: '홍보부' })
  // 만든 뒤에도 칸이 열려 있어 이어 만든다. 칸은 비었다.
  expect(asElement(within(form).getByLabelText('새 부서 이름'), HTMLInputElement).value).toBe('')
  taken = true
  fireEvent.change(within(form).getByLabelText('새 부서 이름'), { target: { value: '재정부' } })
  fireEvent.click(submit)
  const reason = await screen.findByText('같은 이름의 부서가 있어요.')
  // 쪽 위가 아니라 추가 칸과 같은 묶음 안, 칸 바로 아래에 보인다. 이름을 고치면 사라진다.
  expect(form.parentElement!.contains(reason)).toBe(true)
  expect(form.compareDocumentPosition(reason) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  expect(screen.getAllByText('같은 이름의 부서가 있어요.')).toHaveLength(1)
  expect(within(form).getByLabelText('새 부서 이름').getAttribute('aria-invalid')).toBe('true')
  fireEvent.change(within(form).getByLabelText('새 부서 이름'), { target: { value: '재정국' } })
  expect(screen.queryByText('같은 이름의 부서가 있어요.')).toBeNull()
})

test('부서 추가 칸은 [닫기]나 Esc로 접히고 초점이 [부서 추가]로 돌아온다', async () => {
  const api = serve()
  render(<Harness permissions={LEADER_PERMISSIONS} />)
  let form = await openAdd()
  fireEvent.click(within(form).getByRole('button', { name: '닫기' }))
  await waitFor(() =>
    expect(document.activeElement).toBe(screen.getByRole('button', { name: '부서 추가' })),
  )
  form = await openAdd()
  fireEvent.keyDown(within(form).getByLabelText('새 부서 이름'), { key: 'Escape' })
  await waitFor(() => expect(screen.queryByRole('form', { name: '부서 추가' })).toBeNull())
  expect(document.activeElement).toBe(screen.getByRole('button', { name: '부서 추가' }))
  expect(posts(api)).toEqual([])
})

// DEC-38 근처 회귀: 추가 칸에 적던 이름은 권한이 잠깐 빠져 칸이 사라졌다 돌아와도 남는다.
test('부서 추가 칸에 적던 이름은 권한을 잃었다 되찾아도 남는다', async () => {
  serve()
  const view = render(<Harness permissions={LEADER_PERMISSIONS} />)
  const form = await openAdd()
  fireEvent.change(within(form).getByLabelText('새 부서 이름'), { target: { value: '홍보부' } })
  view.rerender(<Harness permissions={MEMBER_PERMISSIONS} />)
  expect(screen.queryByRole('form', { name: '부서 추가' })).toBeNull()
  view.rerender(<Harness permissions={LEADER_PERMISSIONS} />)
  const back = await screen.findByRole('form', { name: '부서 추가' })
  expect(asElement(within(back).getByLabelText('새 부서 이름'), HTMLInputElement).value).toBe(
    '홍보부',
  )
})

// 검토 지적: 추가 칸 아래 오류는 권한과 함께 칸이 사라지면 같이 사라진다. 권한이 바뀌었다는 답은 쪽 위에 보인다.
test('부서를 만들다 403으로 권한을 잃으면 추가 칸이 사라져도 까닭이 쪽에 남는다', async () => {
  const api = serve()
  api.on('POST', '/api/organizations/c1/departments', () => json({ error: 'FORBIDDEN' }, 403))
  render(<Harness permissions={LEADER_PERMISSIONS} dropOnForbidden />)
  const form = await openAdd()
  fireEvent.change(within(form).getByLabelText('새 부서 이름'), { target: { value: '홍보부' } })
  fireEvent.click(within(form).getByRole('button', { name: '부서 추가' }))
  await waitFor(() => expect(screen.queryByRole('form', { name: '부서 추가' })).toBeNull())
  expect(screen.getByText('권한이 바뀌었어요. 화면을 새로 불러왔어요.')).toBeTruthy()
  expect(posts(api)).toHaveLength(1)
})

test('이름 바꾸기는 부서 머리의 제자리 편집이다. Enter로 저장하면 이름과 역할을 보내고 초점이 그 부서의 ⋯ 버튼으로 돌아온다', async () => {
  const api = serve()
  api.on('POST', '/api/organizations/c1/departments/d2', () =>
    withDepartments(team => {
      team.departments[1] = { id: 'd2', name: '기획국', role: null, memberCount: 0 }
    }),
  )
  render(<Harness permissions={LEADER_PERMISSIONS} />)
  const form = await openRename('기획부')
  // 편집 칸은 그 부서 묶음의 머리 자리에 있고, 지금 이름이 골라져 있다.
  expect(group('기획부').contains(form)).toBe(true)
  const input = asElement(within(form).getByLabelText('부서 이름'), HTMLInputElement)
  expect(input.value).toBe('기획부')
  await waitFor(() => expect(document.activeElement).toBe(input))
  fireEvent.change(input, { target: { value: '기획국' } })
  fireEvent.submit(form)
  await gone('기획부')
  expect(screen.getByRole('heading', { name: '기획국' })).toBeTruthy()
  expect(screen.queryByRole('form', { name: '부서 이름 바꾸기' })).toBeNull()
  expect(posts(api).map(call => [call.path, call.body])).toEqual([
    ['/api/organizations/c1/departments/d2', { name: '기획국', role: null }],
  ])
  await waitFor(() =>
    expect(document.activeElement).toBe(screen.getByRole('button', { name: '기획국 동작' })),
  )
})

test('이름 바꾸기는 빈 이름과 지금 이름을 보내지 않고 칸 아래에 알리며, Esc나 [닫기]로 보내지 않고 닫는다', async () => {
  const api = serve()
  render(<Harness permissions={LEADER_PERMISSIONS} />)
  let form = await openRename('기획부')
  const input = within(form).getByLabelText('부서 이름')
  fireEvent.change(input, { target: { value: '  ' } })
  fireEvent.click(within(form).getByRole('button', { name: '바꾸기' }))
  expect(within(form).getByText('부서 이름을 입력해 주세요')).toBeTruthy()
  expect(input.getAttribute('aria-invalid')).toBe('true')
  fireEvent.change(input, { target: { value: '기획부' } })
  expect(within(form).getByText('지금과 다른 이름을 입력해 주세요')).toBeTruthy()
  fireEvent.keyDown(input, { key: 'Escape' })
  await waitFor(() => expect(screen.queryByRole('form', { name: '부서 이름 바꾸기' })).toBeNull())
  await waitFor(() =>
    expect(document.activeElement).toBe(screen.getByRole('button', { name: '기획부 동작' })),
  )
  form = await openRename('기획부')
  fireEvent.click(within(form).getByRole('button', { name: '닫기' }))
  await waitFor(() => expect(screen.queryByRole('form', { name: '부서 이름 바꾸기' })).toBeNull())
  expect(posts(api)).toEqual([])
})

test('한글을 조합하는 중의 Esc는 이름 바꾸기를 닫지 않는다', async () => {
  serve()
  render(<Harness permissions={LEADER_PERMISSIONS} />)
  const form = await openRename('기획부')
  fireEvent.keyDown(within(form).getByLabelText('부서 이름'), { key: 'Escape', keyCode: 229 })
  expect(screen.getByRole('form', { name: '부서 이름 바꾸기' })).toBeTruthy()
})

test('같은 이름의 부서가 있으면 이름 칸 아래에 까닭을 보이고 칸이 틀렸다고 알린다', async () => {
  const api = serve()
  api.on('POST', '/api/organizations/c1/departments/d2', () =>
    json({ error: 'DEPARTMENT_NAME_TAKEN' }, 409),
  )
  render(<Harness permissions={LEADER_PERMISSIONS} />)
  const form = await openRename('기획부')
  const input = within(form).getByLabelText('부서 이름')
  fireEvent.change(input, { target: { value: '재정부' } })
  fireEvent.submit(form)
  expect(await within(form).findByText('같은 이름의 부서가 있어요.')).toBeTruthy()
  expect(input.getAttribute('aria-invalid')).toBe('true')
  fireEvent.change(input, { target: { value: '재정국' } })
  expect(within(form).queryByText('같은 이름의 부서가 있어요.')).toBeNull()
})

// 검토 지적: 이름 바꾸기는 권한을 잃으면 열려 있지도, 다시 보내지도 못한다.
test('이름을 바꾸다 403이면 편집을 닫고 까닭을 쪽에 보이며, 같은 요청을 다시 보내지 않는다', async () => {
  const api = serve()
  api.on('POST', '/api/organizations/c1/departments/d2', () => json({ error: 'FORBIDDEN' }, 403))
  render(<Harness permissions={LEADER_PERMISSIONS} />)
  const form = await openRename('기획부')
  fireEvent.change(within(form).getByLabelText('부서 이름'), { target: { value: '기획국' } })
  fireEvent.submit(form)
  await waitFor(() => expect(screen.queryByRole('form', { name: '부서 이름 바꾸기' })).toBeNull())
  expect(screen.getByText('권한이 바뀌었어요. 화면을 새로 불러왔어요.')).toBeTruthy()
  expect(posts(api)).toHaveLength(1)
})

test('이름 바꾸기는 목록을 다시 읽으면 새 부서의 역할로 보낸다', async () => {
  const api = mockApi()
  let reads = 0
  api.on('GET', '/api/organizations/c1/members', () =>
    reads++ === 0
      ? json(teamResponse())
      : withDepartments(team => {
          team.departments[1] = { id: 'd2', name: '기획부', role: 'finance', memberCount: 0 }
        }),
  )
  api.on('POST', '/api/organizations/c1/departments/d2', () => withDepartments(() => {}))
  render(<Harness permissions={LEADER_PERMISSIONS} />)
  await openRename('기획부')
  fireEvent.click(screen.getByText('목록 다시 읽기'))
  await waitFor(() => expect(reads).toBe(2))
  const form = screen.getByRole('form', { name: '부서 이름 바꾸기' })
  fireEvent.change(within(form).getByLabelText('부서 이름'), { target: { value: '기획국' } })
  fireEvent.submit(form)
  await waitFor(() => expect(posts(api)).toHaveLength(1))
  expect(posts(api)[0]!.body).toEqual({ name: '기획국', role: 'finance' })
})

// 사라짐 효과를 지우면 대상 id가 남아, 같은 부서가 목록에 다시 나타날 때 편집이나 확인 창이 저절로 다시 열린다.
test('이름 바꾸기·없애기 대상 부서가 사라져 닫힌 뒤 목록에 다시 나타나도 다시 열리지 않는다', async () => {
  for (const item of ['이름 바꾸기', '없애기']) {
    const api = mockApi()
    let reads = 0
    api.on('GET', '/api/organizations/c1/members', () =>
      reads++ === 1 ? financeOnly() : json(teamResponse()),
    )
    render(<Harness permissions={LEADER_PERMISSIONS} />)
    fireEvent.click(within(await openMenu('기획부')).getByRole('menuitem', { name: item }))
    if (item === '없애기') await screen.findByRole('dialog', { name: '기획부 부서를 없앨까요?' })
    else await screen.findByRole('form', { name: '부서 이름 바꾸기' })
    fireEvent.click(screen.getByText('목록 다시 읽기'))
    await gone('기획부')
    await noDialog()
    fireEvent.click(screen.getByText('목록 다시 읽기'))
    expect(await screen.findByRole('heading', { name: '기획부' })).toBeTruthy()
    expect(screen.queryByRole('dialog'), item).toBeNull()
    expect(screen.queryByRole('form', { name: '부서 이름 바꾸기' }), item).toBeNull()
    expect(posts(api), item).toEqual([])
    cleanup()
  }
})

test('재정 역할을 주면 이름과 함께 role finance를, 거두면 role null을 보낸다', async () => {
  const api = serve()
  api.on('POST', '/api/organizations/c1/departments/d2', () =>
    withDepartments(team => {
      team.departments[1] = { id: 'd2', name: '기획부', role: 'finance', memberCount: 0 }
    }),
  )
  api.on('POST', '/api/organizations/c1/departments/d1', () =>
    withDepartments(team => {
      team.departments[0] = { id: 'd1', name: '재정부', role: null, memberCount: 1 }
      team.departments[1] = { id: 'd2', name: '기획부', role: 'finance', memberCount: 0 }
    }),
  )
  render(<Harness permissions={LEADER_PERMISSIONS} />)
  fireEvent.click(
    within(await openMenu('기획부')).getByRole('menuitem', { name: '재정 역할 주기' }),
  )
  await waitFor(() => expect(screen.getAllByText('재정')).toHaveLength(2))
  fireEvent.click(
    within(await openMenu('재정부')).getByRole('menuitem', { name: '재정 역할 거두기' }),
  )
  await waitFor(() => expect(within(group('재정부')).queryByText('재정')).toBeNull())
  expect(within(group('기획부')).getByText('재정')).toBeTruthy()
  expect(posts(api).map(call => [call.path, call.body])).toEqual([
    ['/api/organizations/c1/departments/d2', { name: '기획부', role: 'finance' }],
    ['/api/organizations/c1/departments/d1', { name: '재정부', role: null }],
  ])
})

test('지금 사람이 있는 부서의 없애기는 확인 창 없이 까닭을 보이고 보내지 않는다', async () => {
  const api = serve()
  render(<Harness permissions={LEADER_PERMISSIONS} />)
  fireEvent.click(within(await openMenu('재정부')).getByRole('menuitem', { name: '없애기' }))
  expect(
    await screen.findByText('부서원이 있었던 부서는 없앨 수 없어요. 이름을 바꿔 쓰세요.'),
  ).toBeTruthy()
  expect(screen.queryByRole('dialog')).toBeNull()
  expect(posts(api)).toEqual([])
})

test('사람이 없는 부서의 없애기는 확인 창을 거친다. 닫으면 보내지 않고, 예전에 쓰였으면 까닭을 쪽에 보인다', async () => {
  const api = serve()
  let used = true
  api.on('POST', '/api/organizations/c1/departments/d2/delete', () =>
    used ? json({ error: 'DEPARTMENT_IN_USE' }, 409) : financeOnly(),
  )
  render(<Harness permissions={LEADER_PERMISSIONS} />)
  fireEvent.click(within(await openMenu('기획부')).getByRole('menuitem', { name: '없애기' }))
  let confirm = await screen.findByRole('dialog', { name: '기획부 부서를 없앨까요?' })
  fireEvent.click(within(confirm).getAllByRole('button', { name: '닫기' })[0]!)
  await noDialog()
  expect(posts(api)).toEqual([])
  fireEvent.click(within(await openMenu('기획부')).getByRole('menuitem', { name: '없애기' }))
  confirm = await screen.findByRole('dialog', { name: '기획부 부서를 없앨까요?' })
  fireEvent.click(within(confirm).getByRole('button', { name: '없애기' }))
  // 쓰인 부서는 다시 눌러도 같으므로 확인 창을 닫고 까닭을 쪽에 보인다.
  expect(
    await screen.findByText('부서원이 있었던 부서는 없앨 수 없어요. 이름을 바꿔 쓰세요.'),
  ).toBeTruthy()
  await noDialog()
  used = false
  fireEvent.click(within(await openMenu('기획부')).getByRole('menuitem', { name: '없애기' }))
  confirm = await screen.findByRole('dialog', { name: '기획부 부서를 없앨까요?' })
  fireEvent.click(within(confirm).getByRole('button', { name: '없애기' }))
  await gone('기획부')
  await noDialog()
  expect(posts(api).map(call => call.path)).toEqual([
    '/api/organizations/c1/departments/d2/delete',
    '/api/organizations/c1/departments/d2/delete',
  ])
})

test('재정 역할을 주는 동안에는 ⋯ 버튼이 막혀 요청이 두 번 나가지 않는다', async () => {
  const api = serve()
  const pending = deferredResponse()
  api.on('POST', '/api/organizations/c1/departments/d2', () => pending.promise)
  render(<Harness permissions={LEADER_PERMISSIONS} />)
  fireEvent.click(
    within(await openMenu('기획부')).getByRole('menuitem', { name: '재정 역할 주기' }),
  )
  const trigger = asElement(
    await screen.findByRole('button', { name: '기획부 동작' }),
    HTMLButtonElement,
  )
  await waitFor(() => expect(trigger.disabled).toBe(true))
  expect(posts(api)).toHaveLength(1)
  pending.resolve(json(teamResponse()))
  await waitFor(() => expect(trigger.disabled).toBe(false))
})

test('없애기 확인 창은 보내는 동안 꺼져 한 번만 보내고, 권한을 잃으면 닫힌다', async () => {
  const api = serve()
  const pending = deferredResponse()
  api.on('POST', '/api/organizations/c1/departments/d2/delete', () => pending.promise)
  render(<Harness permissions={LEADER_PERMISSIONS} />)
  fireEvent.click(within(await openMenu('기획부')).getByRole('menuitem', { name: '없애기' }))
  const dialog = await screen.findByRole('dialog', { name: '기획부 부서를 없앨까요?' })
  const confirm = asElement(
    within(dialog).getByRole('button', { name: '없애기' }),
    HTMLButtonElement,
  )
  fireEvent.click(confirm)
  await waitFor(() => expect(confirm.disabled).toBe(true))
  fireEvent.click(confirm)
  expect(posts(api)).toHaveLength(1)
  pending.resolve(financeOnly())
  await gone('기획부')
  await noDialog()
  cleanup()
  // 권한을 잃으면 열려 있던 확인 창도 닫힌다.
  const again = serve()
  const view = render(<Harness permissions={LEADER_PERMISSIONS} />)
  fireEvent.click(within(await openMenu('기획부')).getByRole('menuitem', { name: '없애기' }))
  await screen.findByRole('dialog', { name: '기획부 부서를 없앨까요?' })
  view.rerender(<Harness permissions={MEMBER_PERMISSIONS} />)
  await noDialog()
  expect(posts(again)).toEqual([])
})

test('부서 머리에서 한 동작이 실패하면 휴대폰 화면에서도 보이도록 쪽의 오류 문구를 화면 안으로 스크롤한다', async () => {
  const api = serve()
  api.on('POST', '/api/organizations/c1/departments/d2', () =>
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
      within(await openMenu('기획부')).getByRole('menuitem', { name: '재정 역할 주기' }),
    )
    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toBe('저장하지 못했어요. 다시 시도해 주세요.')
    await waitFor(() => expect(scrollIntoView).toHaveBeenCalledTimes(1))
    expect(scrollIntoView).toHaveBeenCalledWith({ block: 'nearest' })
    expect((scrollIntoView.mock.contexts[0] as HTMLElement).contains(alert)).toBe(true)
  } finally {
    delete (HTMLElement.prototype as unknown as Record<string, unknown>).scrollIntoView
  }
})

// 닫힌 까닭을 쪽 위에 보인다(자주 잡힌 것 1번, vada-docs#24).
const GONE = '이미 바뀌었어요. 목록을 새로 불러왔어요.'
const LOST = '권한이 바뀌었어요. 화면을 새로 불러왔어요.'

test('이름 바꾸기·없애기가 열린 채 대상 부서가 사라져 닫히면 까닭을 쪽에 보인다', async () => {
  for (const item of ['이름 바꾸기', '없애기']) {
    const api = mockApi()
    let reads = 0
    api.on('GET', '/api/organizations/c1/members', () =>
      reads++ === 0 ? json(teamResponse()) : financeOnly(),
    )
    render(<Harness permissions={LEADER_PERMISSIONS} />)
    fireEvent.click(within(await openMenu('기획부')).getByRole('menuitem', { name: item }))
    fireEvent.click(screen.getByText('목록 다시 읽기'))
    await gone('기획부')
    await noDialog()
    expect(await screen.findByText(GONE), item).toBeTruthy()
    cleanup()
  }
})

test('이름 바꾸기·없애기가 열린 채 권한을 잃어 닫히면 까닭을 쪽에 보이고 아무것도 보내지 않는다', async () => {
  for (const item of ['이름 바꾸기', '없애기']) {
    const api = serve()
    const view = render(<Harness permissions={LEADER_PERMISSIONS} />)
    fireEvent.click(within(await openMenu('기획부')).getByRole('menuitem', { name: item }))
    view.rerender(<Harness permissions={MEMBER_PERMISSIONS} />)
    await noDialog()
    expect(screen.queryByRole('form', { name: '부서 이름 바꾸기' }), item).toBeNull()
    expect(screen.queryByRole('button', { name: /동작$/ }), item).toBeNull()
    expect(await screen.findByText(LOST), item).toBeTruthy()
    // 같은 까닭은 한 번만 보인다(사람 쪽과 부서 쪽이 함께 알린다).
    expect(screen.getAllByText(LOST), item).toHaveLength(1)
    expect(posts(api), item).toEqual([])
    cleanup()
  }
})

test('열려 있던 것이 없어도 권한을 잃어 [부서 추가]가 사라지면 까닭을 쪽에 보인다', async () => {
  serve()
  const view = render(<Harness permissions={LEADER_PERMISSIONS} />)
  await screen.findByRole('button', { name: '부서 추가' })
  view.rerender(<Harness permissions={MEMBER_PERMISSIONS} />)
  expect(screen.queryByRole('button', { name: '부서 추가' })).toBeNull()
  expect(await screen.findByText(LOST)).toBeTruthy()
})

test('까닭 문구는 다른 동작을 열면 사라진다', async () => {
  const api = mockApi()
  let reads = 0
  api.on('GET', '/api/organizations/c1/members', () =>
    reads++ === 0 ? json(teamResponse()) : financeOnly(),
  )
  render(<Harness permissions={LEADER_PERMISSIONS} />)
  fireEvent.click(within(await openMenu('기획부')).getByRole('menuitem', { name: '없애기' }))
  await screen.findByRole('dialog')
  fireEvent.click(screen.getByText('목록 다시 읽기'))
  await screen.findByText(GONE)
  await openRename('재정부')
  expect(screen.queryByText(GONE)).toBeNull()
})

test('부서를 없애 확인 창이 닫힐 때는 까닭 문구를 보이지 않는다', async () => {
  const api = serve()
  api.on('POST', '/api/organizations/c1/departments/d2/delete', () => financeOnly())
  render(<Harness permissions={LEADER_PERMISSIONS} />)
  fireEvent.click(within(await openMenu('기획부')).getByRole('menuitem', { name: '없애기' }))
  const dialog = await screen.findByRole('dialog', { name: '기획부 부서를 없앨까요?' })
  fireEvent.click(within(dialog).getByRole('button', { name: '없애기' }))
  await gone('기획부')
  await noDialog()
  await settle()
  expect(screen.queryByText(GONE)).toBeNull()
  expect(screen.queryByText(LOST)).toBeNull()
})

// 조직도 모양(ORG-03A): 회장단 카드 안에 [구성원 초대], 부서 카드 안은 부장 칸과 부원 칸이다.
test('부서 카드는 부장 칸과 부원 칸으로 나뉘고, 부장이 없으면 [부장 지정]으로 고른 사람의 부서 창을 연다', async () => {
  serve()
  render(<Harness permissions={LEADER_PERMISSIONS} />)
  await loaded()
  expect(within(group('회장단')).getByRole('button', { name: '구성원 초대' })).toBeTruthy()
  expect(within(group('재정부')).getByRole('list', { name: '재정부 부장' }).textContent).toContain(
    '이재정',
  )
  expect(within(group('재정부')).getByText('부원 0명')).toBeTruthy()
  expect(within(group('재정부')).queryByRole('button', { name: '재정부 부장 지정' })).toBeNull()
  fireEvent.keyDown(within(group('기획부')).getByRole('button', { name: '기획부 부장 지정' }), {
    key: 'Enter',
  })
  fireEvent.click(within(await screen.findByRole('menu')).getByRole('menuitem', { name: '박새내' }))
  expect(await screen.findByRole('dialog', { name: '박새내의 부서' })).toBeTruthy()
})

test('직급 없는 운영진도 부서 카드의 부장·부원을 다 보고, [부장 지정]과 [구성원 초대]는 없다', async () => {
  serve()
  render(<Harness permissions={MEMBER_PERMISSIONS} />)
  await loaded()
  expect(within(group('재정부')).getByRole('list', { name: '재정부 부장' }).textContent).toContain(
    '이재정',
  )
  expect(within(group('기획부')).getByText('부원 0명')).toBeTruthy()
  expect(screen.queryByRole('button', { name: '기획부 부장 지정' })).toBeNull()
  expect(screen.queryByRole('button', { name: '구성원 초대' })).toBeNull()
})

test('[부장 지정]으로 부장을 정하고 창을 닫으면 초점이 부장 칸의 그 사람 카드로 간다', async () => {
  const api = serve()
  const assigned = teamResponse()
  assigned.members[2]!.departments = [{ id: 'd2', rank: 'head', actions: ['placement.remove'] }]
  api.on('POST', '/api/organizations/c1/members/m3/departments', () => json(assigned))
  render(<Harness permissions={LEADER_PERMISSIONS} />)
  await loaded()
  fireEvent.keyDown(within(group('기획부')).getByRole('button', { name: '기획부 부장 지정' }), {
    key: 'Enter',
  })
  fireEvent.click(within(await screen.findByRole('menu')).getByRole('menuitem', { name: '박새내' }))
  const dialog = await screen.findByRole('dialog', { name: '박새내의 부서' })
  fireEvent.change(within(dialog).getByLabelText('부서'), { target: { value: 'd2' } })
  fireEvent.change(within(dialog).getByLabelText('부서 직급'), { target: { value: 'head' } })
  fireEvent.click(within(dialog).getByRole('button', { name: '부서에 넣기' }))
  expect(await within(dialog).findByLabelText('기획부 부서 직급')).toBeTruthy()
  fireEvent.keyDown(dialog, { key: 'Escape' })
  await noDialog()
  const head = within(screen.getByRole('list', { name: '기획부 부장' }))
  await waitFor(() =>
    expect(document.activeElement).toBe(head.getByRole('button', { name: '박새내 동작' })),
  )
})
