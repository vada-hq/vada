import { useState } from 'react'
import type { Action, CouncilView, TeamMember } from '@vada/contracts'
import type { Confirm } from './people-access'
import { PERMISSION_CHANGED } from '@/lib/messages'
import { useLost, type Reading } from '@/lib/use-lost'
import type { Undoable } from './person-changes'
import { memberPath, isStale, usePeopleRequests } from './usePeopleRequests'
import { usePeopleDialogs } from './usePeopleDialogs'
import type { Team } from './useTeam'
import { useMenuFocus } from './use-menu-focus'
import { useUndo } from './useUndo'

type CouncilRead = { view: CouncilView; reading: Reading }

// 조직 화면의 사람 쪽 상태와 동작: 오류 문구, 창(사람 상세, 부서 배정, 확인), 서버 변경, 되돌리기. 화면은 이것을 그리기만 한다.
// reading은 view를 가져온 학생회 읽기이고, onOwnChange는 내 직급이 바뀐 성공 뒤 학생회를 다시 읽는 일이다.
export function usePeople(council: CouncilRead, team: Team, onOwnChange: () => void) {
  const { view, reading } = council
  const [message, setMessage] = useState('')
  const menuFocus = useMenuFocus()
  const me = view.me.memberId
  const can = (action: Action) => view.permissions.includes(action)
  const dialogs = usePeopleDialogs(team.data, me, { can, reading }, setMessage)
  // 초대 창은 초대 권한과 함께 사라진다.
  useLost(can('invite.manage'), () => setMessage(PERMISSION_CHANGED), reading)
  const requests = usePeopleRequests(team, me, onOwnChange, setMessage)
  const undo = useUndo(team, requests.run, onOwnChange)
  const { viewingMember, editingMember, confirming, setViewing, setEditing, setConfirm } = dialogs
  // 창 안에 보이지 않는 오류만 쪽 위에 보인다.
  const pageMessage = !viewingMember && !editingMember && !confirming ? message : ''

  async function confirmed() {
    if (!confirming || team.saving) return
    const removing = confirming.kind === 'remove'
    const code = removing
      ? await requests.run(`${memberPath(confirming.member)}/remove`, {})
      : await requests.run('/president/transfer', { memberId: confirming.member.id }, true)
    if (code === null || isStale(code)) setConfirm(null)
    // 내보낸 사람의 상세는 함께 닫는다. 내 동작으로 사라졌으므로 까닭을 알리지 않는다.
    if (code === null && removing) setViewing(null)
  }
  return {
    me,
    can,
    menuFocus,
    viewingMember,
    editingMember,
    confirming,
    message,
    pageMessage,
    undo,
    assign: requests.assign,
    removeFrom: requests.removeFrom,
    // 사람 상세의 바로 저장(옮기기, 빼기, 더하기, 직급, 부회장 지정·해제). 성공하면 되돌리기 토스트가 뜬다.
    save: (member: TeamMember, item: Undoable) => {
      setMessage('')
      void undo.save(item, member.id === me)
    },
    confirmed,
    ...openers({ setViewing, setEditing, setConfirm }, menuFocus, setMessage),
  }
}
export type PeopleState = ReturnType<typeof usePeople>

type Setters = {
  setViewing: (id: string | null) => void
  setEditing: (id: string | null) => void
  setConfirm: (confirm: Confirm | null) => void
}

// 창을 열고 닫는 일. 열거나 닫을 때 지난 오류 문구를 지운다.
function openers(
  set: Setters,
  menuFocus: ReturnType<typeof useMenuFocus>,
  setMessage: (message: string) => void,
) {
  const fresh = (change: () => void) => () => {
    setMessage('')
    change()
  }
  return {
    openPerson: (member: TeamMember) => fresh(() => set.setViewing(member.id))(),
    closePerson: fresh(() => set.setViewing(null)),
    // 메뉴 항목으로 창을 연다. 닫을 때 포커스를 그 줄의 버튼으로 돌려주려고 어느 줄인지 기억한다.
    openAssign: (member: TeamMember, from: string) =>
      fresh(() => {
        menuFocus.remember(from)
        set.setEditing(member.id)
      })(),
    // 사람 상세에서 확인 창을 연다. 닫히면 Radix가 포커스를 상세 안의 연 버튼으로 돌려준다.
    askConfirm: (kind: Confirm['kind'], member: TeamMember) =>
      fresh(() => set.setConfirm({ kind, memberId: member.id }))(),
    closeAssign: fresh(() => set.setEditing(null)),
    cancelConfirm: fresh(() => set.setConfirm(null)),
  }
}
