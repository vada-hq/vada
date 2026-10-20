import { useState } from 'react'
import type { Action, CouncilView, TeamMember } from '@vada/contracts'
import type { Confirm } from './people-access'
import { PERMISSION_CHANGED } from '@/lib/messages'
import { useLost } from '@/lib/use-lost'
import { memberPath, isStale, usePeopleRequests } from './usePeopleRequests'
import { usePeopleDialogs } from './usePeopleDialogs'
import type { Team } from './useTeam'
import { useMenuFocus } from './use-menu-focus'

// 운영진 > 사람 화면의 상태와 동작: 오류 문구, 대화상자, 서버 변경. 화면(People)은 이것을 그리기만 한다.
export function usePeople(view: CouncilView, team: Team, onCouncilChanged: () => void) {
  const [message, setMessage] = useState('')
  const menuFocus = useMenuFocus()
  const me = view.me.memberId
  const can = (action: Action) => view.permissions.includes(action)
  const dialogs = usePeopleDialogs(team.data, me, can, setMessage)
  // 초대 링크 카드는 초대 권한과 함께 사라진다.
  useLost(can('invite.manage'), () => setMessage(PERMISSION_CHANGED))
  const requests = usePeopleRequests(team, me, onCouncilChanged, setMessage)
  const { editingMember, confirming, setEditing, setConfirm } = dialogs
  // 대화상자 안에 보이지 않는 오류만 쪽 위에 보인다.
  const pageMessage = !editingMember && !confirming ? message : ''

  async function confirmed() {
    if (!confirming || team.saving) return
    const code =
      confirming.kind === 'remove'
        ? await requests.run(`${memberPath(confirming.member)}/remove`, {})
        : await requests.run('/president/transfer', { memberId: confirming.member.id }, true)
    if (code === null || isStale(code)) setConfirm(null)
  }
  // 메뉴 항목으로 대화상자를 연다. 닫을 때 포커스를 그 줄의 ⋯ 버튼으로 돌려주려고 어느 줄인지 기억한다.
  const open = (member: TeamMember, show: () => void) => {
    setMessage('')
    menuFocus.remember(member.id)
    show()
  }
  return {
    me,
    can,
    menuFocus,
    editingMember,
    confirming,
    message,
    pageMessage,
    assign: requests.assign,
    removeFrom: requests.removeFrom,
    toggleViceRank: requests.toggleViceRank,
    confirmed,
    openAssign: (member: TeamMember) => open(member, () => setEditing(member.id)),
    askConfirm: (kind: Confirm['kind'], member: TeamMember) =>
      open(member, () => setConfirm({ kind, memberId: member.id })),
    closeAssign: () => {
      setEditing(null)
      setMessage('')
    },
    cancelConfirm: () => {
      setConfirm(null)
      setMessage('')
    },
  }
}
export type PeopleState = ReturnType<typeof usePeople>
