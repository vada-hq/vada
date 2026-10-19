// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { Action, TeamResponse } from '@vada/contracts'
import { councilView, LEADER_PERMISSIONS, MEMBER_PERMISSIONS, teamResponse } from '@/test-support/council-fixtures'
import { json, mockApi } from '@/test-support/mock-api'
import Departments from './Departments'
import { useTeam } from './useTeam'

afterEach(() => { cleanup(); vi.unstubAllGlobals() })

function Harness({ permissions }: { permissions: Action[] }) {
  const team = useTeam('c1', () => {})
  return <Departments view={councilView('c1', { permissions })} team={team} />
}
function serve() {
  const api = mockApi()
  api.on('GET', '/api/organizations/c1/members', () => json(teamResponse()))
  return api
}
const withDepartments = (change: (team: TeamResponse) => void) => { const team = teamResponse(); change(team); return json(team) }
async function openMenu(name: string) {
  fireEvent.keyDown(await screen.findByRole('button', { name: `${name} 동작` }), { key: 'Enter' })
  return screen.findByRole('menu')
}

test('부서 목록은 이름, 재정 역할, 부서원 수를 보이고, 직급 없는 운영진에게는 동작이 없다', async () => {
  serve()
  render(<Harness permissions={MEMBER_PERMISSIONS} />)
  expect(await screen.findByText('부서 2개')).toBeTruthy()
  expect(within(screen.getByRole('list', { name: '부서' })).getAllByRole('listitem').map(item => item.textContent))
    .toEqual(['재정부재정부서원 1명', '기획부부서원 0명'])
  expect(screen.queryByRole('form', { name: '부서 만들기' })).toBeNull()
  expect(screen.queryByRole('button', { name: /동작$/ })).toBeNull()
})

test('회장단은 부서를 만든다. 이름이 맞을 때만 버튼이 켜지고, 같은 이름이면 까닭을 보인다', async () => {
  const api = serve()
  let taken = false
  api.on('POST', '/api/organizations/c1/departments', () => taken
    ? json({ error: 'DEPARTMENT_NAME_TAKEN' }, 409)
    : withDepartments(team => team.departments.push({ id: 'd3', name: '홍보부', role: null, memberCount: 0 })))
  render(<Harness permissions={LEADER_PERMISSIONS} />)
  const form = await screen.findByRole('form', { name: '부서 만들기' })
  const submit = within(form).getByRole('button', { name: '부서 만들기' }) as HTMLButtonElement
  expect(submit.disabled).toBe(true)
  fireEvent.change(within(form).getByLabelText('새 부서 이름'), { target: { value: ' 홍보부 ' } })
  expect(submit.disabled).toBe(false)
  fireEvent.click(submit)
  expect(await screen.findByText('부서 3개')).toBeTruthy()
  expect(api.calls.find(call => call.method === 'POST')?.body).toEqual({ name: '홍보부' })
  expect((within(form).getByLabelText('새 부서 이름') as HTMLInputElement).value).toBe('')
  taken = true
  fireEvent.change(within(form).getByLabelText('새 부서 이름'), { target: { value: '재정부' } })
  fireEvent.click(submit)
  expect(await screen.findByText('같은 이름의 부서가 있어요.')).toBeTruthy()
})

test('회장단은 줄마다 이름 바꾸기, 재정 역할 주고 거두기, 없애기를 한다. 쓰인 부서는 없애지 못한 까닭을 보인다', async () => {
  const api = serve()
  api.on('POST', '/api/organizations/c1/departments/d2', () => withDepartments(team => { team.departments[1] = { id: 'd2', name: '기획국', role: 'finance', memberCount: 0 } }))
  api.on('POST', '/api/organizations/c1/departments/d1/delete', () => json({ error: 'DEPARTMENT_IN_USE' }, 409))
  api.on('POST', '/api/organizations/c1/departments/d2/delete', () => withDepartments(team => { team.departments = team.departments.slice(0, 1) }))
  render(<Harness permissions={LEADER_PERMISSIONS} />)
  fireEvent.click(within(await openMenu('기획부')).getByRole('menuitem', { name: '이름 바꾸기' }))
  const dialog = await screen.findByRole('dialog', { name: '부서 이름 바꾸기' })
  fireEvent.change(within(dialog).getByLabelText('부서 이름'), { target: { value: '기획국' } })
  fireEvent.click(within(dialog).getByRole('button', { name: '바꾸기' }))
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  expect(api.calls.find(call => call.path.endsWith('/departments/d2'))?.body).toEqual({ name: '기획국', role: null })
  const finance = await openMenu('재정부')
  expect(within(finance).getByRole('menuitem', { name: '재정 역할 거두기' })).toBeTruthy()
  fireEvent.click(within(finance).getByRole('menuitem', { name: '없애기' }))
  expect(await screen.findByText('부서원이 있었던 부서는 없앨 수 없어요. 이름을 바꿔 쓰세요.')).toBeTruthy()
  fireEvent.click(within(await openMenu('기획국')).getByRole('menuitem', { name: '없애기' }))
  expect(await screen.findByText('부서 1개')).toBeTruthy()
})
