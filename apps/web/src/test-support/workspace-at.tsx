import { menuPath } from '@vada/contracts'
import { useHere } from '@/lib/app-location'
import CouncilWorkspace from '../workspace/CouncilWorkspace'
import { targetOf } from '../workspace/address'
import type { Page } from '../workspace/pages'
import { myCouncil } from './council-fixtures'

// 주소는 uuid여야 읽히므로 작업 공간 시험은 이 학생회를 쓴다.
export const COUNCIL_ID = '0199d1a0-0000-7000-8000-0000000000c1'

// 학생회 한 곳의 작업 공간을 startPage의 주소로 연다. 메뉴를 누르면 주소가 바뀌고 작업 공간이 따라온다.
export function WorkspaceAt({ startPage }: { startPage: Page }) {
  if (window.location.pathname === '/')
    window.history.replaceState(null, '', menuPath(startPage, COUNCIL_ID))
  const council = myCouncil(COUNCIL_ID)
  const target = targetOf(useHere(), [council])
  if (target.kind !== 'ready') return null
  return (
    <CouncilWorkspace
      council={council}
      councils={[council]}
      target={target}
      onSelect={() => {}}
      returnFocusTo={null}
      user={{ id: 'u1', name: '김회장', email: 'kim.google@example.com' }}
      logoutBusy={false}
      onLogout={() => {}}
      onCouncilsChanged={() => {}}
      onCouncilLost={() => {}}
    />
  )
}
