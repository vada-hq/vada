import type { AppMenu, MyCouncil } from '@vada/contracts'
import type { PageTrail } from '@/components/PageHeading'
import type { Target } from './address'

export type Page = AppMenu
// 학생회를 고른 곳. 작업 공간이 새로 그려진 뒤 포커스를 그 자리의 버튼으로 돌려놓는다.
export type Opener = 'sidebar' | 'header'
export type CouncilEntry = 'join' | 'create'

// 머리글 경로 줄에서 학생회 이름 뒤에 붙는 메뉴 칸(crumbs)과 제목(DEC-96). 홈은 학생회 이름 한 칸뿐이다.
// 사람(people)과 옛 부서 주소(departments)는 같은 조직 화면이다(DEC-91, DEC-96).
export const pageTitles: Record<Page, { crumbs: string[]; title: string }> = {
  home: { crumbs: [], title: '홈' },
  chat: { crumbs: ['대화'], title: '대화' },
  events: { crumbs: ['행사'], title: '행사' },
  council: { crumbs: ['우리 학생회'], title: '우리 학생회' },
  tasks: { crumbs: ['업무'], title: '업무' },
  calendar: { crumbs: ['캘린더'], title: '캘린더' },
  purchases: { crumbs: ['구매'], title: '구매' },
  finance: { crumbs: ['재정'], title: '재정' },
  people: { crumbs: ['조직'], title: '조직' },
  departments: { crumbs: ['조직'], title: '조직' },
  settings: { crumbs: ['설정'], title: '학생회 정보' },
}

// 머리글의 경로 줄과 제목: 학생회 이름 > 메뉴 칸 > 화면이 넘긴 칸. 제목은 화면이 넘긴 것(행사는 행사명)이 먼저다.
// 넘치면 학생회 이름 칸과 화면이 말줄임으로 넘긴 칸(행사명)만 줄인다(DEC-96).
export function trailOf(page: Page, councilName: string, deeper: PageTrail | null): PageTrail {
  const menu = pageTitles[page]
  return {
    title: deeper?.title ?? menu.title,
    crumbs: [
      { label: councilName, truncate: true },
      ...menu.crumbs.map(label => ({ label, truncate: false })),
      ...(deeper?.crumbs ?? []),
    ],
  }
}

// 행사 화면이 넘기는 칸: 행사명 > 탭 이름, 제목은 행사명(DEC-96 '{학생회} > 행사 > {행사명} > {탭}').
export const eventTrail = (name: string, tab: string): PageTrail => ({
  title: name,
  crumbs: [
    { label: name, truncate: true },
    { label: tab, truncate: false },
  ],
})

export type WorkspaceProps = {
  onAddCouncil?: ((entry: CouncilEntry) => void) | undefined
  councils: MyCouncil[]
  // 주소가 가리키는 학생회와 메뉴, 연 기록.
  target: Extract<Target, { kind: 'ready' }>
  user: { id: string; name: string; email: string }
  logoutBusy: boolean
  onLogout: () => void
  // 학생회 이름이 바뀌었을 때 내 학생회 목록을 다시 읽게 한다.
  onCouncilsChanged: () => void
  // 이 학생회의 운영진이 아니게 되었을 때(내보내졌거나 기수가 끝남). 목록을 다시 읽는 데 실패해도 이 학생회를 떠나게 한다.
  onCouncilLost: (councilId: string) => void
}
