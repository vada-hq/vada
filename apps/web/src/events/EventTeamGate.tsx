import type { ReactNode } from 'react'
import type { TeamResponse } from '@vada/contracts'
import StateMessage from '@/components/StateMessage'
import { EVENT_TEAM_FAILED } from '@/lib/messages'
import { useTeam } from '@/team/useTeam'

type Props = {
  councilId: string
  onForbidden: () => void
  children: (team: TeamResponse) => ReactNode
}

// 책임자를 고르려면 운영진 목록이 있어야 한다. 읽는 동안과 읽지 못했을 때를 보인다.
export function EventTeamGate({ councilId, onForbidden, children }: Props) {
  const team = useTeam(councilId, onForbidden)
  if (team.data) return children(team.data)
  return (
    <StateMessage kind={team.loadFailed ? 'error' : 'loading'}>
      {team.loadFailed ? EVENT_TEAM_FAILED : '불러오는 중이에요'}
    </StateMessage>
  )
}
