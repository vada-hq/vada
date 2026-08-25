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

export interface WorkspaceTab {
  label: string
  targetScreenId?: string
  note?: string
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

/** 지금 보고 있는 갈피. 이 화면을 가리키는 갈피가 곧 그것이다. */
export function currentTabOf(workspace: Workspace, screenId: string): WorkspaceTab | null {
  return workspace.tabs.find((tab) => tab.targetScreenId === screenId) ?? null
}
