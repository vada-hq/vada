import { appPath, parseAppPath } from '@vada/contracts'

// 이 기기가 사람마다 마지막에 본 학생회 안 주소. 홈 화면 앱처럼 '/'로 열리는 시작이 보던 곳으로 돌아가기 위해서다(Slack 마지막 채널, chat/last-room.ts와 같은 방식).
// 해석기가 아는 학생회 안 주소만 쓰고 읽을 때도 다시 거른다. 공개·초대 주소와 쿼리의 모르는 값(토큰 등)은 들어가지 못한다.
// 저장소를 못 쓰는 브라우저(사생활 보호 모드 등)에서는 조용히 기억하지 않고 첫 학생회 홈이 열린다.
const PREFIX = 'vada.last.address.'

function clean(path: string | null) {
  const location = path === null ? null : parseAppPath(path)
  return location ? appPath(location) : null
}

export function rememberAddress(userId: string, path: string) {
  const value = clean(path)
  if (value === null) return
  try {
    window.localStorage.setItem(PREFIX + userId, value)
  } catch {
    // 가득 찼거나 막혔다. 다음에 첫 학생회 홈이 열릴 뿐이다.
  }
}

export function lastAddress(userId: string) {
  try {
    return clean(window.localStorage.getItem(PREFIX + userId))
  } catch {
    return null
  }
}

// 탈퇴하면 그 계정의 기억을 지운다. 지운 계정이 본 학생회 주소가 이 기기에 남지 않게 한다.
export function forgetAddress(userId: string) {
  try {
    window.localStorage.removeItem(PREFIX + userId)
  } catch {
    // 막힌 저장소에는 지울 것도 없다.
  }
}
