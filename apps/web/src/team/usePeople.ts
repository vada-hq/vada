import { useEffect, useRef, useState } from 'react'
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
  const own = useOwnChange(setMessage, onCouncilChanged)
  const dialogs = usePeopleDialogs(team.data, me, can, own.notify)
  const requests = usePeopleRequests(team, me, own.changed, own.setMessage)
  useEndOfOwnChange(own, view.permissions, can('invite.manage'))
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
    own.reset()
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

// 내 요청이 성공해 내 권한이 바뀌고 학생회를 다시 읽은 뒤의 사라짐은 바깥 변경이 아니므로 알리지 않는다.
// 다시 읽은 권한이 화면에 반영되면 꺼서 그 뒤의 바깥 변경은 알린다. 다시 읽기가 없거나 실패해도 다음 동작이 시작되면 꺼진다.
function useOwnChange(setMessage: (text: string) => void, onCouncilChanged: () => void) {
  const mine = useRef(false)
  return {
    reset: () => {
      mine.current = false
    },
    notify: (text: string) => {
      if (!mine.current) setMessage(text)
    },
    changed: () => {
      mine.current = true
      onCouncilChanged()
    },
    setMessage: (text: string) => {
      if (text === '') mine.current = false
      setMessage(text)
    },
  }
}

// 위 알림 효과들이 이번 렌더에서 돈 뒤에 꺼야 하므로 usePeople에서 맨 나중에 부른다(선언 순서가 효과 순서다).
function useEndOfOwnChange(
  own: { reset: () => void; notify: (text: string) => void },
  permissions: unknown,
  canInvite: boolean,
) {
  // 초대 링크 카드는 초대 권한과 함께 사라진다.
  useLost(canInvite, () => own.notify(PERMISSION_CHANGED))
  useEffect(() => {
    own.reset()
    // reset은 ref만 바꾸므로 권한이 새로 읽힐 때만 돌면 된다.
    // oxlint-disable-next-line react-hooks/exhaustive-deps -- 위 이유
  }, [permissions])
}
