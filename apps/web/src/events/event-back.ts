import { parentOf, parseAppPath } from '@vada/contracts'
import { pageTitles } from '../workspace/pages'

// 행사 화면의 뒤로 버튼이 말하는 이름. 앱 안에서 들어온 곳이 행사 목록 밖(업무, 홈, 재정)이면 그곳의 이름이고,
// 행사 목록이나 링크로 바로 들어왔으면 행사 목록이다(뒤로가 들어온 곳으로 가므로 이름도 같아야 한다).
export function backLabel(from: string | null) {
  const location = from === null ? null : parseAppPath(from)
  const parent = location ? parentOf(location) : null
  if (parent?.type !== 'menu' || parent.menu === 'events') return '행사 목록'
  return pageTitles[parent.menu].title
}
