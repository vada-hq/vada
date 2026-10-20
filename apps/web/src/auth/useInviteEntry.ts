import { useState } from 'react'
import { inviteCodeFromPath } from '../councils/invite-path'

// 초대 링크(/join/코드)로 왔는지, 학생회가 없어 코드를 직접 입력했는지에 따라 돌아갈 곳이 다르다.
export type Invite = { code: string; from: 'link' | 'form' }

export function useInviteEntry() {
  const [invite, setInvite] = useState<Invite | null>(() => {
    const code = inviteCodeFromPath(window.location.pathname)
    return code === null ? null : { code, from: 'link' }
  })
  // 초대로 방금 들어온 학생회. 작업 공간이 그 학생회를 먼저 연다.
  const [opened, setOpened] = useState<string>()
  function leaveInvite() {
    window.history.replaceState(null, '', '/')
    setInvite(null)
  }
  return {
    invite,
    opened,
    enterCode: (code: string) => setInvite({ code, from: 'form' }),
    leaveInvite,
    joined: (councilId: string) => {
      leaveInvite()
      setOpened(councilId)
    },
  }
}
