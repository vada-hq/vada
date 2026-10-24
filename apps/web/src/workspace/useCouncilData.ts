import { useEffect } from 'react'
import type { CouncilView } from '@vada/contracts'
import { LIST_POLL_MS, useVisiblePoll } from '@/lib/use-visible-poll'
import { useTeam } from '../team/useTeam'
import { useCouncilView } from './useCouncilView'

// 작업 공간이 보여 줄 학생회 하나의 데이터(학생회 정보와 운영진). 운영진이 아니게 되면 알린다.
export function useCouncilData(
  councilId: string,
  onCouncilLost: (councilId: string) => void,
  onCouncilsChanged: () => void,
) {
  const { state, reload, refresh, reloadAfterOwnChange, replace } = useCouncilView(councilId)
  const team = useTeam(councilId, reload)
  // 다른 사람이 바꾼 내 권한과 새로 들어온 운영진을 화면을 다시 열지 않아도 보이게 한다.
  useVisiblePoll(() => {
    refresh()
    team.reload()
  }, LIST_POLL_MS)
  useEffect(() => {
    if (state.kind === 'lost') onCouncilLost(councilId)
  }, [state.kind, onCouncilLost, councilId])
  const view = state.kind === 'ready' ? state.view : null
  // 설정을 바꾸면 서버가 돌려준 학생회로 바꾸고, 학생회 이름이 바뀌었을 수 있어 내 학생회 목록을 다시 읽게 한다.
  const saved = (next: CouncilView) => {
    replace(next)
    onCouncilsChanged()
  }
  return { state, view, reload, reloadAfterOwnChange, saved, team }
}
export type CouncilData = ReturnType<typeof useCouncilData>
