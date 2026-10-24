import { appPath, parseAppPath } from '@vada/contracts'
import { invitePath } from '../councils/invite-path'
import type { Invite } from './useInviteEntry'

// 로그인 뒤 돌아올 곳은 주소 해석기가 아는 학생회 안 주소뿐이다(열린 리다이렉트 막기, OWASP).
// 해석기를 거쳐 다시 만든 주소만 쓰므로 `//`, 역슬래시, 바깥 주소, 공개·초대 주소, 모르는 쿼리는 들어가지 못하고 '/'가 된다.
export function loginReturnPath(current: string) {
  const location = parseAppPath(current)
  return location ? appPath(location) : '/'
}

// 초대 링크로 왔으면 초대가 먼저다. 아니면 지금 보던 주소(경로와 쿼리, # 뒤는 넣지 않는다).
export function loginCallback(invite: Invite | null, current: string) {
  return invite?.from === 'link' ? invitePath(invite.code) : loginReturnPath(current)
}
