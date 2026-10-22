import type { MyCouncil } from '@vada/contracts'
import type { ChatLink } from './useChatLink'

export type Page =
  'home' | 'chat' | 'events' | 'tasks' | 'finance' | 'people' | 'departments' | 'settings'
// 학생회를 고른 곳. 작업 공간이 새로 그려진 뒤 포커스를 그 자리의 버튼으로 돌려놓는다.
export type Opener = 'sidebar' | 'header'

export const pageTitles: Record<Page, { section: string; title: string }> = {
  home: { section: '홈', title: '홈' },
  chat: { section: '대화', title: '대화' },
  events: { section: '업무', title: '행사' },
  tasks: { section: '업무', title: '업무' },
  finance: { section: '업무', title: '재정' },
  people: { section: '운영진', title: '사람' },
  departments: { section: '운영진', title: '부서' },
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
