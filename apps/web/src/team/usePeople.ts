import { useState } from 'react'
import type { Action, CouncilView, TeamMember } from '@vada/contracts'
import type { Confirm } from './people-access'
import { PERMISSION_CHANGED } from '@/lib/messages'
import { useLost, type Reading } from '@/lib/use-lost'
import { memberPath, isStale, usePeopleRequests } from './usePeopleRequests'
import { usePeopleDialogs } from './usePeopleDialogs'
import type { Team } from './useTeam'
import { useMenuFocus } from './use-menu-focus'

type CouncilRead = { view: CouncilView; reading: Reading }

// 운영진 > 사람 화면의 상태와 동작: 오류 문구, 대화상자, 서버 변경. 화면(People)은 이것을 그리기만 한다.
// reading은 view를 가져온 학생회 읽기이고, onOwnChange는 내 직급이 바뀐 성공 뒤 학생회를 다시 읽는 일이다.
export function usePeople(council: CouncilRead, team: Team, onOwnChange: () => void) {
  const { view, reading } = council
  const [message, setMessage] = useState('')
  const menuFocus = useMenuFocus()
  const me = view.me.memberId
  const can = (action: Action) => view.permissions.includes(action)
  const dialogs = usePeopleDialogs(team.data, { can, reading }, setMessage)
  // 초대 링크 카드는 초대 권한과 함께 사라진다.
  useLost(can('invite.manage'), () => setMessage(PERMISSION_CHANGED), reading)
  const requests = usePeopleRequests(team, me, onOwnChange, setMessage)
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
  // from은 연 줄의 ⋯ 버튼 키(triggerRef와 같은 값)다. 여럿이면 앞의 것이 사라졌을 때 다음 것으로 돌려준다.
  const open = (from: string | string[], show: () => void) => {
    setMessage('')
    menuFocus.remember(...[from].flat())
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
    openAssign: (member: TeamMember, from: string | string[]) =>
      open(from, () => setEditing(member.id)),
    askConfirm: (kind: Confirm['kind'], member: TeamMember, from: string) =>
      open(from, () => setConfirm({ kind, memberId: member.id })),
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
