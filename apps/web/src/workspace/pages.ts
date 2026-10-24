import type { MyCouncil } from '@vada/contracts'
import type { ChatLink } from './useChatLink'

export type Page =
  | 'home'
  | 'chat'
  | 'events'
  | 'tasks'
  | 'finance'
  | 'organization'
  | 'people'
  | 'departments'
  | 'settings'
// 학생회를 고른 곳. 작업 공간이 새로 그려진 뒤 포커스를 그 자리의 버튼으로 돌려놓는다.
export type Opener = 'sidebar' | 'header'

// 경로의 무리(section)는 옆 메뉴의 무리 이름과 같다. 홈·대화·행사·업무·재정은 옆 메뉴에서 무리 없이 나란해서 null이다.
export const pageTitles: Record<Page, { section: string | null; title: string }> = {
  home: { section: null, title: '홈' },
  chat: { section: null, title: '대화' },
  events: { section: null, title: '행사' },
  tasks: { section: null, title: '업무' },
  finance: { section: null, title: '재정' },
  organization: { section: '운영진', title: '조직' },
  people: { section: '운영진', title: '조직' },
  departments: { section: '운영진', title: '조직' },
  settings: { section: '설정', title: '학생회 정보' },
}

export type WorkspaceProps = {
  councils: MyCouncil[]
  initialCouncilId?: string | undefined
  // 알림을 눌러 열 방. 있으면 그 학생회의 대화에서 그 방을 연다.
  chatLink?: ChatLink | null | undefined
  user: { name: string }
  logoutBusy: boolean
  onLogout: () => void
  // 학생회 이름이 바뀌었을 때 내 학생회 목록을 다시 읽게 한다.
  onCouncilsChanged: () => void
  // 이 학생회의 운영진이 아니게 되었을 때(내보내졌거나 기수가 끝남). 목록을 다시 읽는 데 실패해도 이 학생회를 떠나게 한다.
  onCouncilLost: (councilId: string) => void
}
