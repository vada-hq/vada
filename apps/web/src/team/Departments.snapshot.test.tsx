// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { Action, TeamResponse } from '@vada/contracts'
import {
  councilView,
  LEADER_PERMISSIONS,
  MEMBER_PERMISSIONS,
  teamResponse,
} from '@/test-support/council-fixtures'
import { json, mockApi } from '@/test-support/mock-api'
import { snapshotHtml } from '@/test-support/snapshot-html'
import Departments from './Departments'
import { useTeam } from './useTeam'

// 부서 화면을 나누기 전의 겉 모양을 그대로 적어 둔 특성 시험이다(docs/features/r01-maintainability.md 조각 5).
// 나눈 뒤에도 이 스냅숏 파일은 바뀌지 않아야 한다.
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

function Harness({ permissions }: { permissions: Action[] }) {
  const team = useTeam('c1', () => {})
  return <Departments view={councilView('c1', { permissions })} team={team} />
}
function serve(status = 200, team: TeamResponse = teamResponse()) {
  const api = mockApi()
  api.on('GET', '/api/organizations/c1/members', () =>
    status === 200 ? json(team) : json({ error: 'Internal server error' }, status),
  )
}
async function openMenuItem(name: string, item: string) {
  fireEvent.keyDown(await screen.findByRole('button', { name: `${name} 동작` }), { key: 'Enter' })
  fireEvent.click(await screen.findByRole('menuitem', { name: item }))
  await screen.findByRole('dialog')
}

test('불러오는 중', () => {
  serve()
  render(<Harness permissions={LEADER_PERMISSIONS} />)
  expect(snapshotHtml()).toMatchSnapshot()
})

test('목록: 회장단', async () => {
  serve()
  render(<Harness permissions={LEADER_PERMISSIONS} />)
  await screen.findByText('부서 2개')
  expect(snapshotHtml()).toMatchSnapshot()
})

test('목록: 권한 없음', async () => {
  serve()
  render(<Harness permissions={MEMBER_PERMISSIONS} />)
  await screen.findByText('부서 2개')
  expect(snapshotHtml()).toMatchSnapshot()
})

test('빈 목록', async () => {
  serve(200, { members: [], departments: [] })
  render(<Harness permissions={LEADER_PERMISSIONS} />)
  await screen.findByText('부서 0개')
  expect(snapshotHtml()).toMatchSnapshot()
})

test('불러오기 오류', async () => {
  serve(500)
  render(<Harness permissions={LEADER_PERMISSIONS} />)
  await screen.findByText('부서를 불러오지 못했어요.')
  expect(snapshotHtml()).toMatchSnapshot()
})

test('대화상자: 이름 바꾸기', async () => {
  serve()
  render(<Harness permissions={LEADER_PERMISSIONS} />)
  await openMenuItem('재정부', '이름 바꾸기')
  expect(snapshotHtml()).toMatchSnapshot()
})

test('대화상자: 없애기', async () => {
  serve()
  render(<Harness permissions={LEADER_PERMISSIONS} />)
  await openMenuItem('기획부', '없애기')
  expect(snapshotHtml()).toMatchSnapshot()
})
