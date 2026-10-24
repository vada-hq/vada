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
import Departments from './Departments'
import { useTeam } from './useTeam'
import { asElement } from '@/test-support/elements'
import { settle } from '@/test-support/settle'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

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
      <Departments
        view={councilView('c1', { permissions: dropped ? MEMBER_PERMISSIONS : permissions })}
        team={team}
      />
      <button type="button" onClick={team.reload}>
        목록 다시 읽기
      </button>
    </>
  )
}
function serve() {
  const api = mockApi()
  api.on('GET', '/api/organizations/c1/members', () => json(teamResponse()))
  return api
}
const withDepartments = (change: (team: TeamResponse) => void) => {
  const team = teamResponse()
  change(team)
  return json(team)
}
async function openMenu(name: string) {
  fireEvent.keyDown(await screen.findByRole('button', { name: `${name} 동작` }), { key: 'Enter' })
  return screen.findByRole('menu')
}
const posts = (api: ReturnType<typeof mockApi>) => api.calls.filter(call => call.method === 'POST')
const noDialog = () => waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())

test('부서 목록은 이름, 재정 역할, 부서원 수를 보이고, 직급 없는 운영진에게는 동작이 없다', async () => {
  serve()
  render(<Harness permissions={MEMBER_PERMISSIONS} />)
  expect(await screen.findByText('부서 2개')).toBeTruthy()
  expect(
    within(screen.getByRole('list', { name: '부서' }))
      .getAllByRole('listitem')
      .map(item => item.textContent),
  ).toEqual(['재정부재정부서원 1명', '기획부부서원 0명'])
  expect(screen.queryByRole('form', { name: '부서 만들기' })).toBeNull()
  expect(screen.queryByRole('button', { name: /동작$/ })).toBeNull()
})

// DEC-38 근처 회귀: 만들기 칸에 적던 이름은 권한이 잠깐 빠져 칸이 사라졌다 돌아와도 남는다.
test('부서 만들기 칸에 적던 이름은 권한을 잃었다 되찾아도 남는다', async () => {
  serve()
  const view = render(<Harness permissions={LEADER_PERMISSIONS} />)
  const form = await screen.findByRole('form', { name: '부서 만들기' })
  fireEvent.change(within(form).getByLabelText('새 부서 이름'), { target: { value: '홍보부' } })
  view.rerender(<Harness permissions={MEMBER_PERMISSIONS} />)
  expect(screen.queryByRole('form', { name: '부서 만들기' })).toBeNull()
  view.rerender(<Harness permissions={LEADER_PERMISSIONS} />)
  const back = await screen.findByRole('form', { name: '부서 만들기' })
  expect(asElement(within(back).getByLabelText('새 부서 이름'), HTMLInputElement).value).toBe(
    '홍보부',
  )
})

test('부서를 불러오지 못하면 다시 시도할 수 있다', async () => {
  const api = mockApi()
  let calls = 0
  api.on('GET', '/api/organizations/c1/members', () =>
    calls++ === 0 ? json({ error: 'Internal server error' }, 500) : json(teamResponse()),
  )
  render(<Harness permissions={MEMBER_PERMISSIONS} />)
  fireEvent.click(await screen.findByRole('button', { name: '다시 시도' }))
  expect(await screen.findByText('부서 2개')).toBeTruthy()
})

test('회장단은 부서를 만든다. 이름 없이 누르면 보내지 않고 칸 아래에 알리며, 같은 이름이면 까닭을 만들기 칸 옆에 보인다', async () => {
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
  const form = await screen.findByRole('form', { name: '부서 만들기' })
  const submit = within(form).getByRole('button', { name: '부서 만들기' }) as HTMLButtonElement
  const input = within(form).getByLabelText('새 부서 이름')
  // 보이는 라벨이 있고, 칸 안에 예시 글은 없다.
  expect(within(form).getByText('새 부서 이름').tagName).toBe('LABEL')
  expect(input.getAttribute('placeholder')).toBeNull()
  expect(submit.disabled).toBe(false)
  fireEvent.click(submit)
  expect(within(form).getByText('부서 이름을 입력해 주세요')).toBeTruthy()
  expect(input.getAttribute('aria-invalid')).toBe('true')
  expect(api.calls.some(call => call.method === 'POST')).toBe(false)
  fireEvent.change(input, { target: { value: ' 홍보부 ' } })
  expect(within(form).queryByText('부서 이름을 입력해 주세요')).toBeNull()
  fireEvent.click(submit)
  expect(await screen.findByText('부서 3개')).toBeTruthy()
  expect(api.calls.find(call => call.method === 'POST')?.body).toEqual({ name: '홍보부' })
  expect(asElement(within(form).getByLabelText('새 부서 이름'), HTMLInputElement).value).toBe('')
  taken = true
  fireEvent.change(within(form).getByLabelText('새 부서 이름'), { target: { value: '재정부' } })
  fireEvent.click(submit)
  const reason = await screen.findByText('같은 이름의 부서가 있어요.')
  // 쪽 위가 아니라 만들기 칸과 같은 묶음 안, 칸 바로 아래에 보인다. 이름을 고치면 사라진다.
  expect(form.parentElement!.contains(reason)).toBe(true)
  expect(form.compareDocumentPosition(reason) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  expect(screen.getAllByText('같은 이름의 부서가 있어요.')).toHaveLength(1)
  fireEvent.change(within(form).getByLabelText('새 부서 이름'), { target: { value: '재정국' } })
  expect(screen.queryByText('같은 이름의 부서가 있어요.')).toBeNull()
})

test('같은 이름이라 만들지 못하면 만들기 칸이 틀렸다고 알려진다', async () => {
  const api = serve()
  api.on('POST', '/api/organizations/c1/departments', () =>
    json({ error: 'DEPARTMENT_NAME_TAKEN' }, 409),
  )
  render(<Harness permissions={LEADER_PERMISSIONS} />)
  const form = await screen.findByRole('form', { name: '부서 만들기' })
  fireEvent.change(within(form).getByLabelText('새 부서 이름'), { target: { value: '재정부' } })
  fireEvent.click(within(form).getByRole('button', { name: '부서 만들기' }))
  await screen.findByText('같은 이름의 부서가 있어요.')
  expect(within(form).getByLabelText('새 부서 이름').getAttribute('aria-invalid')).toBe('true')
})

// 검토 지적: 만들기 칸 아래 오류는 권한과 함께 칸이 사라지면 같이 사라진다. 권한이 바뀌었다는 답은 쪽 위에 보인다.
test('부서를 만들다 403으로 권한을 잃으면 만들기 칸이 사라져도 까닭이 쪽에 남는다', async () => {
  const api = serve()
  api.on('POST', '/api/organizations/c1/departments', () => json({ error: 'FORBIDDEN' }, 403))
  render(<Harness permissions={LEADER_PERMISSIONS} dropOnForbidden />)
  const form = await screen.findByRole('form', { name: '부서 만들기' })
  fireEvent.change(within(form).getByLabelText('새 부서 이름'), { target: { value: '홍보부' } })
  fireEvent.click(within(form).getByRole('button', { name: '부서 만들기' }))
  await waitFor(() => expect(screen.queryByRole('form', { name: '부서 만들기' })).toBeNull())
  expect(screen.getByText('권한이 바뀌었어요. 화면을 새로 불러왔어요.')).toBeTruthy()
  expect(posts(api)).toHaveLength(1)
})

test('회장단은 줄마다 이름 바꾸기, 재정 역할 주고 거두기, 없애기를 한다. 쓰인 부서는 없애지 못한 까닭을 보인다', async () => {
  const api = serve()
  api.on('POST', '/api/organizations/c1/departments/d2', () =>
    withDepartments(team => {
      team.departments[1] = { id: 'd2', name: '기획국', role: 'finance', memberCount: 0 }
    }),
  )
  api.on('POST', '/api/organizations/c1/departments/d1/delete', () =>
    json({ error: 'DEPARTMENT_IN_USE' }, 409),
  )
  api.on('POST', '/api/organizations/c1/departments/d2/delete', () =>
    withDepartments(team => {
      team.departments = team.departments.slice(0, 1)
    }),
  )
  render(<Harness permissions={LEADER_PERMISSIONS} />)
  fireEvent.click(within(await openMenu('기획부')).getByRole('menuitem', { name: '이름 바꾸기' }))
  const dialog = await screen.findByRole('dialog', { name: '부서 이름 바꾸기' })
  fireEvent.change(within(dialog).getByLabelText('부서 이름'), { target: { value: '기획국' } })
  fireEvent.click(within(dialog).getByRole('button', { name: '바꾸기' }))
  await noDialog()
  expect(api.calls.find(call => call.path.endsWith('/departments/d2'))?.body).toEqual({
    name: '기획국',
    role: null,
  })
  const finance = await openMenu('재정부')
  expect(within(finance).getByRole('menuitem', { name: '재정 역할 거두기' })).toBeTruthy()
  // 없애기는 되돌리기 어려워 한 번 묻는다. 취소하면 아무것도 보내지 않는다.
  const before = posts(api).length
  fireEvent.click(within(finance).getByRole('menuitem', { name: '없애기' }))
  let confirm = await screen.findByRole('dialog', { name: '재정부 부서를 없앨까요?' })
  fireEvent.click(within(confirm).getAllByRole('button', { name: '닫기' })[0]!)
  await noDialog()
  expect(posts(api)).toHaveLength(before)
  fireEvent.click(within(await openMenu('재정부')).getByRole('menuitem', { name: '없애기' }))
  confirm = await screen.findByRole('dialog', { name: '재정부 부서를 없앨까요?' })
  fireEvent.click(within(confirm).getByRole('button', { name: '없애기' }))
  // 쓰인 부서는 다시 눌러도 같으므로 대화상자를 닫고 까닭을 쪽에 보인다.
  expect(
    await screen.findByText('부서원이 있었던 부서는 없앨 수 없어요. 이름을 바꿔 쓰세요.'),
  ).toBeTruthy()
  await noDialog()
  fireEvent.click(within(await openMenu('기획국')).getByRole('menuitem', { name: '없애기' }))
  confirm = await screen.findByRole('dialog', { name: '기획국 부서를 없앨까요?' })
  fireEvent.click(within(confirm).getByRole('button', { name: '없애기' }))
  expect(await screen.findByText('부서 1개')).toBeTruthy()
  await noDialog()
  expect(
    posts(api)
      .filter(call => call.path.endsWith('/delete'))
      .map(call => call.path),
  ).toEqual([
    '/api/organizations/c1/departments/d1/delete',
    '/api/organizations/c1/departments/d2/delete',
  ])
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
  await waitFor(() =>
    expect(within(screen.getByRole('list', { name: '부서' })).getAllByText('재정')).toHaveLength(2),
  )
  fireEvent.click(
    within(await openMenu('재정부')).getByRole('menuitem', { name: '재정 역할 거두기' }),
  )
  await waitFor(() =>
    expect(within(screen.getByRole('list', { name: '부서' })).getAllByText('재정')).toHaveLength(1),
  )
  expect(posts(api).map(call => [call.path, call.body])).toEqual([
    ['/api/organizations/c1/departments/d2', { name: '기획부', role: 'finance' }],
    ['/api/organizations/c1/departments/d1', { name: '재정부', role: null }],
  ])
})

test('이름 바꾸기는 이름을 비우고 누르면 보내지 않고 칸 아래에 알리며, 대화상자를 닫으면 포커스가 그 줄의 ⋯ 버튼으로 돌아간다', async () => {
  const api = serve()
  render(<Harness permissions={LEADER_PERMISSIONS} />)
  fireEvent.click(within(await openMenu('기획부')).getByRole('menuitem', { name: '이름 바꾸기' }))
  const dialog = await screen.findByRole('dialog', { name: '부서 이름 바꾸기' })
  const input = within(dialog).getByLabelText('부서 이름')
  fireEvent.change(input, { target: { value: '  ' } })
  const rename = asElement(
    within(dialog).getByRole('button', { name: '바꾸기' }),
    HTMLButtonElement,
  )
  expect(rename.disabled).toBe(false)
  fireEvent.click(rename)
  expect(within(dialog).getByText('부서 이름을 입력해 주세요')).toBeTruthy()
  expect(input.getAttribute('aria-invalid')).toBe('true')
  await waitFor(() => expect(document.activeElement).toBe(input))
  // 버튼 줄의 [닫기]. 오른쪽 위 ×도 이름이 '닫기'라 첫째를 누른다.
  fireEvent.click(within(dialog).getAllByRole('button', { name: '닫기' })[0]!)
  await noDialog()
  await waitFor(() =>
    expect(document.activeElement).toBe(screen.getByRole('button', { name: '기획부 동작' })),
  )
  expect(posts(api)).toEqual([])
})

// 검토 지적: 이름 바꾸기 대화상자는 권한을 잃으면 열려 있지도, 다시 보내지도 못한다.
test('이름을 바꾸다 403이면 대화상자를 닫고 까닭을 쪽에 보이며, 같은 요청을 다시 보내지 않는다', async () => {
  const api = serve()
  api.on('POST', '/api/organizations/c1/departments/d2', () => json({ error: 'FORBIDDEN' }, 403))
  render(<Harness permissions={LEADER_PERMISSIONS} />)
  fireEvent.click(within(await openMenu('기획부')).getByRole('menuitem', { name: '이름 바꾸기' }))
  const dialog = await screen.findByRole('dialog', { name: '부서 이름 바꾸기' })
  fireEvent.change(within(dialog).getByLabelText('부서 이름'), { target: { value: '기획국' } })
  fireEvent.click(within(dialog).getByRole('button', { name: '바꾸기' }))
  await noDialog()
  expect(screen.getByText('권한이 바뀌었어요. 화면을 새로 불러왔어요.')).toBeTruthy()
  expect(posts(api)).toHaveLength(1)
})

test('이름 바꾸기 대화상자가 열린 채 권한을 잃으면 닫힌다', async () => {
  const api = serve()
  const view = render(<Harness permissions={LEADER_PERMISSIONS} />)
  fireEvent.click(within(await openMenu('기획부')).getByRole('menuitem', { name: '이름 바꾸기' }))
  await screen.findByRole('dialog', { name: '부서 이름 바꾸기' })
  view.rerender(<Harness permissions={MEMBER_PERMISSIONS} />)
  await noDialog()
  expect(screen.queryByRole('button', { name: /동작$/ })).toBeNull()
  expect(posts(api)).toEqual([])
})

test('이름 바꾸기 대화상자는 목록을 다시 읽으면 새 부서의 역할로 보낸다', async () => {
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
  fireEvent.click(within(await openMenu('기획부')).getByRole('menuitem', { name: '이름 바꾸기' }))
  const dialog = await screen.findByRole('dialog', { name: '부서 이름 바꾸기' })
  fireEvent.click(screen.getByText('목록 다시 읽기'))
  await waitFor(() => expect(reads).toBe(2))
  fireEvent.change(within(dialog).getByLabelText('부서 이름'), { target: { value: '기획국' } })
  fireEvent.click(within(dialog).getByRole('button', { name: '바꾸기' }))
  await waitFor(() => expect(posts(api)).toHaveLength(1))
  expect(posts(api)[0]!.body).toEqual({ name: '기획국', role: 'finance' })
})

test('이름 바꾸기 대화상자가 열린 채 그 부서가 목록에서 사라지면 닫힌다', async () => {
  const api = mockApi()
  let reads = 0
  api.on('GET', '/api/organizations/c1/members', () =>
    reads++ === 0
      ? json(teamResponse())
      : withDepartments(team => {
          team.departments = team.departments.slice(0, 1)
        }),
  )
  render(<Harness permissions={LEADER_PERMISSIONS} />)
  fireEvent.click(within(await openMenu('기획부')).getByRole('menuitem', { name: '이름 바꾸기' }))
  await screen.findByRole('dialog', { name: '부서 이름 바꾸기' })
  fireEvent.click(screen.getByText('목록 다시 읽기'))
  await noDialog()
  expect(screen.getByText('부서 1개')).toBeTruthy()
  expect(posts(api)).toEqual([])
})

// 사라짐 효과를 지우면 대상 id가 남아, 같은 부서가 목록에 다시 나타날 때 대화상자가 저절로 다시 열린다.
test('대화상자 대상 부서가 사라져 닫힌 뒤 목록에 다시 나타나도 대화상자는 다시 열리지 않는다', async () => {
  const api = mockApi()
  let reads = 0
  api.on('GET', '/api/organizations/c1/members', () =>
    reads++ === 1
      ? withDepartments(team => {
          team.departments = team.departments.slice(0, 1)
        })
      : json(teamResponse()),
  )
  render(<Harness permissions={LEADER_PERMISSIONS} />)
  fireEvent.click(within(await openMenu('기획부')).getByRole('menuitem', { name: '이름 바꾸기' }))
  await screen.findByRole('dialog', { name: '부서 이름 바꾸기' })
  fireEvent.click(screen.getByText('목록 다시 읽기'))
  await noDialog()
  expect(await screen.findByText('부서 1개')).toBeTruthy()
  fireEvent.click(screen.getByText('목록 다시 읽기'))
  expect(await screen.findByText('부서 2개')).toBeTruthy()
  expect(screen.queryByRole('dialog')).toBeNull()
})

test('없애기 확인 대화상자도 대상 부서가 사라져 닫힌 뒤 다시 나타나면 다시 열리지 않는다', async () => {
  const api = mockApi()
  let reads = 0
  api.on('GET', '/api/organizations/c1/members', () =>
    reads++ === 1
      ? withDepartments(team => {
          team.departments = team.departments.slice(0, 1)
        })
      : json(teamResponse()),
  )
  render(<Harness permissions={LEADER_PERMISSIONS} />)
  fireEvent.click(within(await openMenu('기획부')).getByRole('menuitem', { name: '없애기' }))
  await screen.findByRole('dialog', { name: '기획부 부서를 없앨까요?' })
  fireEvent.click(screen.getByText('목록 다시 읽기'))
  await noDialog()
  expect(await screen.findByText('부서 1개')).toBeTruthy()
  fireEvent.click(screen.getByText('목록 다시 읽기'))
  expect(await screen.findByText('부서 2개')).toBeTruthy()
  expect(screen.queryByRole('dialog')).toBeNull()
  expect(posts(api)).toEqual([])
})

test('재정 역할을 주는 동안에는 ⋯ 버튼이 막혀 요청이 두 번 나가지 않는다', async () => {
  const api = serve()
  const pending = deferredResponse()
  api.on('POST', '/api/organizations/c1/departments/d2', () => pending.promise)
  render(<Harness permissions={LEADER_PERMISSIONS} />)
  fireEvent.click(
    within(await openMenu('기획부')).getByRole('menuitem', { name: '재정 역할 주기' }),
  )
  const trigger = (await screen.findByRole('button', { name: '기획부 동작' })) as HTMLButtonElement
  await waitFor(() => expect(trigger.disabled).toBe(true))
  expect(posts(api)).toHaveLength(1)
  pending.resolve(json(teamResponse()))
  await waitFor(() => expect(trigger.disabled).toBe(false))
})

test('없애기 확인 대화상자는 보내는 동안 꺼져 한 번만 보내고, 권한을 잃거나 부서가 사라지면 닫힌다', async () => {
  const api = serve()
  const pending = deferredResponse()
  api.on('POST', '/api/organizations/c1/departments/d2/delete', () => pending.promise)
  const view = render(<Harness permissions={LEADER_PERMISSIONS} />)
  fireEvent.click(within(await openMenu('기획부')).getByRole('menuitem', { name: '없애기' }))
  const dialog = await screen.findByRole('dialog', { name: '기획부 부서를 없앨까요?' })
  const confirm = within(dialog).getByRole('button', { name: '없애기' }) as HTMLButtonElement
  fireEvent.click(confirm)
  await waitFor(() => expect(confirm.disabled).toBe(true))
  fireEvent.click(confirm)
  expect(posts(api)).toHaveLength(1)
  pending.resolve(
    withDepartments(team => {
      team.departments = team.departments.slice(0, 1)
    }),
  )
  expect(await screen.findByText('부서 1개')).toBeTruthy()
  await noDialog()
  // 권한을 잃으면 열려 있던 확인 대화상자도 닫힌다.
  fireEvent.click(within(await openMenu('재정부')).getByRole('menuitem', { name: '없애기' }))
  await screen.findByRole('dialog', { name: '재정부 부서를 없앨까요?' })
  view.rerender(<Harness permissions={MEMBER_PERMISSIONS} />)
  await noDialog()
  expect(posts(api)).toHaveLength(1)
})

test('줄에서 한 동작이 실패하면 휴대폰 화면에서도 보이도록 쪽의 오류 문구를 화면 안으로 스크롤한다', async () => {
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

test('이름 바꾸기·없애기 대화상자가 열린 채 대상 부서가 사라져 닫히면 까닭을 쪽에 보인다', async () => {
  for (const { item, title } of [
    { item: '이름 바꾸기', title: '부서 이름 바꾸기' },
    { item: '없애기', title: '기획부 부서를 없앨까요?' },
  ]) {
    const api = mockApi()
    let reads = 0
    api.on('GET', '/api/organizations/c1/members', () =>
      reads++ === 0
        ? json(teamResponse())
        : withDepartments(team => {
            team.departments = team.departments.slice(0, 1)
          }),
    )
    render(<Harness permissions={LEADER_PERMISSIONS} />)
    fireEvent.click(within(await openMenu('기획부')).getByRole('menuitem', { name: item }))
    await screen.findByRole('dialog', { name: title })
    fireEvent.click(screen.getByText('목록 다시 읽기'))
    await noDialog()
    expect(await screen.findByText(GONE), item).toBeTruthy()
    cleanup()
  }
})

test('이름 바꾸기·없애기 대화상자가 열린 채 권한을 잃어 닫히면 까닭을 쪽에 보인다', async () => {
  for (const { item, title } of [
    { item: '이름 바꾸기', title: '부서 이름 바꾸기' },
    { item: '없애기', title: '기획부 부서를 없앨까요?' },
  ]) {
    serve()
    const view = render(<Harness permissions={LEADER_PERMISSIONS} />)
    fireEvent.click(within(await openMenu('기획부')).getByRole('menuitem', { name: item }))
    await screen.findByRole('dialog', { name: title })
    view.rerender(<Harness permissions={MEMBER_PERMISSIONS} />)
    await noDialog()
    expect(await screen.findByText(LOST), item).toBeTruthy()
    cleanup()
  }
})

test('열려 있던 대화상자가 없어도 권한을 잃어 만들기 칸이 사라지면 까닭을 쪽에 보인다', async () => {
  serve()
  const view = render(<Harness permissions={LEADER_PERMISSIONS} />)
  await screen.findByRole('form', { name: '부서 만들기' })
  view.rerender(<Harness permissions={MEMBER_PERMISSIONS} />)
  expect(screen.queryByRole('form', { name: '부서 만들기' })).toBeNull()
  expect(await screen.findByText(LOST)).toBeTruthy()
})

test('까닭 문구는 다른 대화상자를 열면 사라진다', async () => {
  const api = mockApi()
  let reads = 0
  api.on('GET', '/api/organizations/c1/members', () =>
    reads++ === 0
      ? json(teamResponse())
      : withDepartments(team => {
          team.departments = team.departments.slice(0, 1)
        }),
  )
  render(<Harness permissions={LEADER_PERMISSIONS} />)
  fireEvent.click(within(await openMenu('기획부')).getByRole('menuitem', { name: '없애기' }))
  await screen.findByRole('dialog')
  fireEvent.click(screen.getByText('목록 다시 읽기'))
  await screen.findByText(GONE)
  fireEvent.click(within(await openMenu('재정부')).getByRole('menuitem', { name: '이름 바꾸기' }))
  await screen.findByRole('dialog', { name: '부서 이름 바꾸기' })
  expect(screen.queryByText(GONE)).toBeNull()
})

test('부서를 없애 확인 대화상자가 닫힐 때는 까닭 문구를 보이지 않는다', async () => {
  const api = serve()
  api.on('POST', '/api/organizations/c1/departments/d2/delete', () =>
    withDepartments(team => {
      team.departments = team.departments.slice(0, 1)
    }),
  )
  render(<Harness permissions={LEADER_PERMISSIONS} />)
  fireEvent.click(within(await openMenu('기획부')).getByRole('menuitem', { name: '없애기' }))
  const dialog = await screen.findByRole('dialog', { name: '기획부 부서를 없앨까요?' })
  fireEvent.click(within(dialog).getByRole('button', { name: '없애기' }))
  expect(await screen.findByText('부서 1개')).toBeTruthy()
  await noDialog()
  await settle()
  expect(screen.queryByText(GONE)).toBeNull()
  expect(screen.queryByText(LOST)).toBeNull()
})
