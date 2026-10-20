// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { Action, TeamResponse } from '@vada/contracts'
import {
  councilView,
  LEADER_PERMISSIONS,
  MEMBER_PERMISSIONS,
  PRESIDENT_PERMISSIONS,
  teamResponse,
} from '@/test-support/council-fixtures'
import { json, mockApi } from '@/test-support/mock-api'
import { snapshotHtml } from '@/test-support/snapshot-html'
import People from './People'
import { useTeam } from './useTeam'

// 사람 화면을 나누기 전의 겉 모양을 그대로 적어 둔 특성 시험이다(docs/features/r01-maintainability.md 조각 4).
// 나눈 뒤에도 이 스냅숏 파일은 바뀌지 않아야 한다.
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})
const titles = { president: '위원장', vicePresident: '부위원장', head: '국장', viceHead: '차장' }

function Harness({ permissions }: { permissions: Action[] }) {
  const team = useTeam('c1', () => {})
  const base = councilView('c1', { permissions })
  return (
    <People
      view={{ ...base, council: { ...base.council, titles } }}
      reading={{ own: false }}
      team={team}
      onCouncilChanged={() => {}}
      onOwnChange={() => {}}
    />
  )
}
function serve(status = 200, team: TeamResponse = teamResponse()) {
  const api = mockApi()
  api.on('GET', '/api/organizations/c1/members', () =>
    status === 200 ? json(team) : json({ error: 'Internal server error' }, status),
  )
  api.on('GET', '/api/organizations/c1/invite', () => json({ code: 'ABCD2345' }))
}
async function openMenuItem(name: string, item: string) {
  fireEvent.keyDown(await screen.findByRole('button', { name: `${name} 동작` }), { key: 'Enter' })
  fireEvent.click(await screen.findByRole('menuitem', { name: item }))
  await screen.findByRole('dialog')
}

test('불러오는 중', () => {
  serve()
  render(<Harness permissions={MEMBER_PERMISSIONS} />)
  expect(snapshotHtml()).toMatchSnapshot()
})

test('목록: 직급 없는 운영진', async () => {
  serve()
  render(<Harness permissions={MEMBER_PERMISSIONS} />)
  await screen.findByText('운영진 3명')
  expect(snapshotHtml()).toMatchSnapshot()
})

test('목록: 회장단', async () => {
  serve()
  render(<Harness permissions={LEADER_PERMISSIONS} />)
  await screen.findByRole('region', { name: '초대 링크' })
  expect(snapshotHtml()).toMatchSnapshot()
})

test('목록: 회장', async () => {
  serve()
  render(<Harness permissions={PRESIDENT_PERMISSIONS} />)
  await screen.findByRole('region', { name: '초대 링크' })
  expect(snapshotHtml()).toMatchSnapshot()
})

test('빈 목록', async () => {
  serve(200, { members: [], departments: [] })
  render(<Harness permissions={MEMBER_PERMISSIONS} />)
  await screen.findByText('운영진 0명')
  expect(snapshotHtml()).toMatchSnapshot()
})

test('불러오기 오류', async () => {
  serve(500)
  render(<Harness permissions={MEMBER_PERMISSIONS} />)
  await screen.findByText('운영진을 불러오지 못했어요.')
  expect(snapshotHtml()).toMatchSnapshot()
})

test('권한 하나만 있는 사람의 메뉴', async () => {
  serve()
  render(<Harness permissions={['council.view', 'rank.manage']} />)
  fireEvent.keyDown(await screen.findByRole('button', { name: '이재정 동작' }), { key: 'Enter' })
  await screen.findByRole('menu')
  expect(snapshotHtml()).toMatchSnapshot()
})

test('확인 대화상자: 내보내기', async () => {
  serve()
  render(<Harness permissions={PRESIDENT_PERMISSIONS} />)
  await openMenuItem('박새내', '내보내기')
  expect(snapshotHtml()).toMatchSnapshot()
})

test('확인 대화상자: 회장 넘기기', async () => {
  serve()
  render(<Harness permissions={PRESIDENT_PERMISSIONS} />)
  await openMenuItem('이재정', '위원장 넘기기')
  expect(snapshotHtml()).toMatchSnapshot()
})
