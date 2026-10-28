// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within, waitFor } from '@testing-library/react'
import {
  councilView,
  LEADER_PERMISSIONS,
  MEMBER_PERMISSIONS,
  teamResponse,
} from '@/test-support/council-fixtures'
import { deferredResponse, json, mockApi } from '@/test-support/mock-api'
import Organization from './Organization'
import { useTeam } from './useTeam'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

function Harness({ manage = true }: { manage?: boolean }) {
  const team = useTeam('c1', () => {})
  return (
    <Organization
      view={councilView('c1', { permissions: manage ? LEADER_PERMISSIONS : MEMBER_PERMISSIONS })}
      reading={{ own: false }}
      team={team}
      onCouncilChanged={() => {}}
      onOwnChange={() => {}}
    />
  )
}

function setup() {
  const api = mockApi()
  api.on('GET', '/api/organizations/c1/members', () => json(teamResponse()))
  return api
}

async function openColor() {
  fireEvent.keyDown(await screen.findByRole('button', { name: '기획부 동작' }), { key: 'Enter' })
  fireEvent.click(
    within(await screen.findByRole('menu')).getByRole('menuitem', { name: '색상 바꾸기' }),
  )
  return screen.findByRole('dialog', { name: '기획부 색상' })
}

test('부서 색을 이름과 함께 표시하고 회장단은 중립색을 유지한다', async () => {
  setup()
  render(<Harness manage={false} />)
  const planning = await screen.findByRole('region', { name: '기획부' })
  expect(planning.querySelector('h2')?.innerHTML).toMatch(/bg-category-/)
  expect(screen.getByRole('region', { name: '회장단' }).innerHTML).not.toMatch(/category-/)
  expect(screen.queryByRole('button', { name: '기획부 동작' })).toBeNull()
})

test('팔레트는 이름 있는 선택지 8개이고 저장한 서버 색을 다시 표시한다', async () => {
  const api = setup()
  api.on('POST', '/api/organizations/c1/departments/d2/color', () => {
    const team = teamResponse()
    team.departments[1]!.color = 'orange'
    return json(team)
  })
  render(<Harness />)
  const dialog = within(await openColor())
  expect(dialog.getAllByRole('radio')).toHaveLength(8)
  fireEvent.click(dialog.getByRole('radio', { name: '주황' }))
  fireEvent.click(dialog.getByRole('button', { name: '저장' }))
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  expect(screen.getByRole('region', { name: '기획부' }).querySelector('h2')?.innerHTML).toContain(
    'bg-category-6',
  )
  expect(api.calls.find(call => call.method === 'POST')?.body).toEqual({ color: 'orange' })
})

test('저장 실패는 선택을 유지하고 전송 중 중복 요청을 막는다', async () => {
  const api = setup()
  const pending = deferredResponse()
  api.on('POST', '/api/organizations/c1/departments/d2/color', () => pending.promise)
  render(<Harness />)
  const dialog = within(await openColor())
  fireEvent.click(dialog.getByRole('radio', { name: '주황' }))
  const save = dialog.getByRole('button', { name: '저장' })
  fireEvent.click(save)
  fireEvent.click(save)
  expect(save.hasAttribute('disabled')).toBe(true)
  pending.resolve(json({ error: 'FAILED' }, 500))
  await waitFor(() => expect(save.hasAttribute('disabled')).toBe(false))
  expect(dialog.getByRole('radio', { name: '주황' }).getAttribute('aria-checked')).toBe('true')
  expect(api.calls.filter(call => call.method === 'POST')).toHaveLength(1)
})

test('키보드로 선택하며 저장하지 않고 닫으면 서버 변경 없이 메뉴로 초점이 돌아간다', async () => {
  const api = setup()
  render(<Harness />)
  const dialog = within(await openColor())
  const teal = dialog.getByRole('radio', { name: '청록' })
  teal.focus()
  fireEvent.keyDown(teal, { key: 'ArrowRight' })
  await waitFor(() =>
    expect(dialog.getByRole('radio', { name: '보라' }).getAttribute('aria-checked')).toBe('true'),
  )
  fireEvent.click(dialog.getAllByRole('button', { name: '닫기' })[0]!)
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  expect(api.calls.filter(call => call.method === 'POST')).toHaveLength(0)
  await waitFor(() =>
    expect(document.activeElement).toBe(screen.getByRole('button', { name: '기획부 동작' })),
  )
})

test('편집 중 권한을 잃으면 선택창과 변경 동작이 사라진다', async () => {
  const api = setup()
  const view = render(<Harness />)
  await openColor()
  view.rerender(<Harness manage={false} />)
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  expect(screen.queryByRole('button', { name: '기획부 동작' })).toBeNull()
  expect(api.calls.filter(call => call.method === 'POST')).toHaveLength(0)
})
