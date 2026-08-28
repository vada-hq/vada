import { shell } from '../components/AppShell'
import type { ScreenSpec, SummaryItem } from './types'

// 작업 공간 — 셸과 화면 사이의 층.
//
// 셸이 모든 화면의 것이라면 작업 공간은 몇 화면의 것이다. 한 행사를 여는 화면
// 일곱은 갈피 줄과 상태 줄과 제목을 똑같이 그린다. 화면마다 적으면 원본이 일곱
// 개가 되고, 하나가 갈리면 같은 행사가 화면마다 달라 보인다.
//
// **무엇을 그리는지는 shell.json이 알고, 어디에 그리는지는 화면이 안다.** 같은
// 갈피 줄이라도 화면마다 다른 노드에 그려지기 때문이다.

/** 열쇠 하나에 갈 곳 하나. 여기 없는 열쇠면 갈피의 기본으로 간다. */
export interface WorkspaceTabTarget {
  value: string
  targetScreenId: string
}

export interface WorkspaceTab {
  label: string
  targetScreenId?: string
  note?: string
  /**
   * 공간의 상태가 이 갈피의 갈래를 정할 때, 그 상태를 아는 조각의 key.
   *
   * **그려지는 말이 아니라 열쇠다** — 상태의 이름은 서버가 주는 글이라 명세가
   * 들면 조직이 단계를 하나 바꿀 때마다 명세가 틀린다.
   */
  targetField?: string
  targets?: WorkspaceTabTarget[]
}

export interface Workspace {
  key: string
  description: string
  param: string
  titleFrom?: { dataSourceKey: string; field: string }
  status?: { dataSourceKey: string; items: SummaryItem[] }
  tabs: WorkspaceTab[]
}

export function findWorkspace(key: string): Workspace {
  const found = (shell.workspaces ?? []).find((candidate) => candidate.key === key)
  if (!found) {
    // 조용한 대체는 제목과 상태 줄을 통째로 비운 채 통과시킨다.
    throw new Error(`작업 공간 '${key}'가 shell.json에 없습니다.`)
  }
  return found
}

/** 이 화면이 속한 작업 공간. 속하지 않으면 null이다. */
export function workspaceOf(screen: ScreenSpec): Workspace | null {
  return screen.workspace === undefined ? null : findWorkspace(screen.workspace.key)
}

/**
 * 지금 보고 있는 갈피. 대개 이 화면을 가리키는 갈피가 곧 그것이다.
 *
 * 갈피 아래로 한 겹 더 들어가는 화면은 자기를 가리키는 갈피가 없다(MY-REQ-01은
 * 재정 갈피에서 열리지만 자기가 갈피는 아니다). 그때 어느 갈피 아래인지는 화면이
 * 말한다 — 셸의 최상위 메뉴를 activeNavigationScreenId가 가리키는 것과 같다.
 */
export function currentTabOf(screen: ScreenSpec, workspace: Workspace): WorkspaceTab | null {
  const active = screen.workspace?.activeTabScreenId ?? screen.screenId
  return workspace.tabs.find((tab) => tab.targetScreenId === active) ?? null
}
