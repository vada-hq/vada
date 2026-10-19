// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { councilView, teamResponse } from '@/test-support/council-fixtures'
import { json, mockApi } from '@/test-support/mock-api'
import People from './People'
import { useTeam } from './useTeam'

afterEach(() => { cleanup(); vi.unstubAllGlobals() })

function Harness({ onForbidden = () => {} }: { onForbidden?: () => void }) {
  const team = useTeam('c1', onForbidden)
  return <People view={{ ...councilView(), council: { ...councilView().council, titles: { president: '위원장', vicePresident: '부위원장', head: '국장', viceHead: '차장' } } }}
    team={team} />
}

test('운영진 목록은 들어온 순서대로 이름, 학생회가 정한 직급 이름, 부서와 부서 직급, 들어온 날을 보이고 이메일은 없다', async () => {
  const api = mockApi()
  api.on('GET', '/api/organizations/c1/members', () => json(teamResponse()))
  render(<Harness />)
  expect(await screen.findByText('운영진 3명')).toBeTruthy()
  const rows = within(screen.getByRole('list', { name: '운영진' })).getAllByRole('listitem')
  expect(rows.map(row => row.textContent)).toEqual([
    '김회장위원장부서 없음 · 2026.10.01 들어옴',
    '이재정재정부 국장 · 2026.10.02 들어옴',
    '박새내부서 없음 · 2026.10.19 들어옴',
  ])
  expect(document.body.textContent).not.toContain('@')
})

test('목록을 불러오지 못하면 다시 시도할 수 있고, 403이면 학생회를 다시 읽게 한다', async () => {
  const api = mockApi()
  let calls = 0
  api.on('GET', '/api/organizations/c1/members', () => calls++ === 0 ? json({ error: 'Internal server error' }, 500) : json(teamResponse()))
  render(<Harness />)
  fireEvent.click(await screen.findByRole('button', { name: '다시 시도' }))
  expect(await screen.findByText('운영진 3명')).toBeTruthy()
  cleanup()
  const forbidden = vi.fn()
  api.on('GET', '/api/organizations/c1/members', () => json({ error: 'FORBIDDEN' }, 403))
  render(<Harness onForbidden={forbidden} />)
  await screen.findByText('운영진을 불러오지 못했어요.')
  expect(forbidden).toHaveBeenCalled()
})
