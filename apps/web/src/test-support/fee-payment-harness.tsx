import { render } from '@testing-library/react'
import { vi } from 'vitest'
import type { Action } from '@vada/contracts'
import OrganizationPage from '@/team/OrganizationPage'
import { useTeam } from '@/team/useTeam'
import { councilView, FINANCE_PERMISSIONS, teamResponse } from './council-fixtures'
import { standardPeriods } from './income-fixtures'
import { json, mockApi } from './mock-api'
import { COUNCIL_ID } from './workspace-at'

export const BASE = `/api/organizations/${COUNCIL_ID}`

export function serveFees() {
  const api = mockApi()
  api.on('GET', `${BASE}/members`, () => json(teamResponse()))
  api.on('GET', `${BASE}/fiscal-periods`, () => json(standardPeriods()))
  return api
}

function OrganizationAt({
  permissions,
  onForbidden,
}: {
  permissions: Action[]
  onForbidden: () => void
}) {
  const team = useTeam(COUNCIL_ID, onForbidden)
  return (
    <OrganizationPage
      view={councilView(COUNCIL_ID, { permissions })}
      reading={{ own: false }}
      team={team}
      onCouncilChanged={onForbidden}
      onOwnChange={onForbidden}
    />
  )
}

export function showOrganization(permissions: Action[] = FINANCE_PERMISSIONS) {
  if (window.location.pathname === '/')
    window.history.replaceState(null, '', `/people/${COUNCIL_ID}`)
  const handlers = { onForbidden: vi.fn(), onChanged: vi.fn() }
  render(<OrganizationAt permissions={permissions} onForbidden={handlers.onForbidden} />)
  return handlers
}
