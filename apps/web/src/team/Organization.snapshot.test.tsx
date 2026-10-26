// @vitest-environment jsdom
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
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
import Organization from './Organization'
import { useTeam } from './useTeam'

// 조직 화면(기능 023 조각 2)의 겉 모양. 사람 화면과 부서 화면의 특성 시험을 합쳤다.
// 들어온 때는 올해가 아니면 연도가 붙으므로 오늘을 고정한다.
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-10-25T03:00:00Z'))
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})
const titles = { president: '위원장', vicePresident: '부위원장', head: '국장', viceHead: '차장' }

function Harness({ permissions }: { permissions: Action[] }) {
  const team = useTeam('c1', () => {})
  const base = councilView('c1', { permissions })
  return (
    <Organization
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
}
async function chooseMenuItem(name: string, item: string) {
  fireEvent.keyDown(await screen.findByRole('button', { name: `${name} 동작` }), { key: 'Enter' })
  fireEvent.click(await screen.findByRole('menuitem', { name: item }))
}
async function openMenuItem(name: string, item: string) {
  await chooseMenuItem(name, item)
  await screen.findByRole('dialog')
}
// 사람 줄을 눌러 사람 상세를 연다.
async function openPerson(name: string) {
  fireEvent.click((await screen.findAllByRole('button', { name: new RegExp(`^${name}`) }))[0]!)
  return screen.findByRole('dialog', { name })
}
// 사람 상세 안의 버튼으로 확인 창을 연다.
async function openConfirm(name: string, item: string, title: string) {
  fireEvent.click(within(await openPerson(name)).getByRole('button', { name: item }))
  await screen.findByRole('dialog', { name: title })
}
const loaded = () => screen.findByRole('heading', { name: '회장단' })

test('불러오는 중', () => {
  serve()
  render(<Harness permissions={MEMBER_PERMISSIONS} />)
  expect(snapshotHtml()).toMatchSnapshot()
})

test('목록: 직급 없는 운영진', async () => {
  serve()
  render(<Harness permissions={MEMBER_PERMISSIONS} />)
  await loaded()
  expect(snapshotHtml()).toMatchSnapshot()
})

test('목록: 회장단', async () => {
  serve()
  render(<Harness permissions={LEADER_PERMISSIONS} />)
  await loaded()
  expect(snapshotHtml()).toMatchSnapshot()
})

test('목록: 회장', async () => {
  serve()
  render(<Harness permissions={PRESIDENT_PERMISSIONS} />)
  await loaded()
  expect(snapshotHtml()).toMatchSnapshot()
})

test('빈 목록', async () => {
  serve(200, { members: [], departments: [] })
  render(<Harness permissions={MEMBER_PERMISSIONS} />)
  await screen.findByText('부서 없음')
  expect(snapshotHtml()).toMatchSnapshot()
})

test('불러오기 오류', async () => {
  serve(500)
  render(<Harness permissions={MEMBER_PERMISSIONS} />)
  await screen.findByText('조직을 불러오지 못했어요.')
  expect(snapshotHtml()).toMatchSnapshot()
})

test('권한 하나만 있는 사람의 사람 상세', async () => {
  serve()
  render(<Harness permissions={['council.view', 'rank.manage']} />)
  await openPerson('이재정')
  expect(snapshotHtml()).toMatchSnapshot()
})

test('확인 대화상자: 내보내기', async () => {
  serve()
  render(<Harness permissions={PRESIDENT_PERMISSIONS} />)
  await openConfirm('박새내', '내보내기', '박새내님을 내보낼까요?')
  expect(snapshotHtml()).toMatchSnapshot()
})

test('확인 대화상자: 회장 넘기기', async () => {
  serve()
  render(<Harness permissions={PRESIDENT_PERMISSIONS} />)
  await openConfirm('이재정', '위원장 넘기기', '이재정님에게 위원장 직급을 넘길까요?')
  expect(snapshotHtml()).toMatchSnapshot()
})

test('부서: 제자리 이름 바꾸기', async () => {
  serve()
  render(<Harness permissions={LEADER_PERMISSIONS} />)
  await chooseMenuItem('재정부', '이름 바꾸기')
  await screen.findByRole('form', { name: '부서 이름 바꾸기' })
  expect(snapshotHtml()).toMatchSnapshot()
})

test('부서: 없애기 확인 창', async () => {
  serve()
  render(<Harness permissions={LEADER_PERMISSIONS} />)
  await openMenuItem('기획부', '없애기')
  expect(snapshotHtml()).toMatchSnapshot()
})

test('부서: 펼친 부서 추가 칸', async () => {
  serve()
  render(<Harness permissions={LEADER_PERMISSIONS} />)
  fireEvent.click(await screen.findByRole('button', { name: '부서 추가' }))
  await screen.findByRole('form', { name: '부서 추가' })
  expect(snapshotHtml()).toMatchSnapshot()
})
