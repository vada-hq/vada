import shellJson from '../../../../specs/figma/vada-wireframe/shell.json'
import type { SummaryItem } from './types'

// 앱 공통 명세. UI와 작업 공간 조회가 함께 읽으며 화면 코드에 의존하지 않는다.
interface ShellNavItem {
  label: string
  targetScreenId?: string
  note?: string
}

export interface Shell {
  schemaVersion: 1
  brand: { name: string; dataSourceKey?: string; subtitleField?: string }
  navigation: ShellNavItem[]
  workspaces?: Workspace[]
  viewer?: {
    dataSourceKey: string
    nameField: string
    roleField?: string
    /** 그 이름을 눌렀을 때 열리는 것. 명세가 든다(`shell.json`). */
    menu?: ShellMenuItem[]
  }
}

/**
 * 보는 사람 자리에서 열리는 갈래.
 *
 * **어느 화면에 있든 자기 계정으로 가는 길이 여기다.** 이 자리가 없던 동안 로그아웃할
 * 방법이 앱 어디에도 없었다 — 한번 들어온 사람은 브라우저의 쿠키를 직접 지워야
 * 나갈 수 있었다(2026-09-09, 배포된 것을 쓰던 사람이 물었다).
 */
export interface ShellMenuItem {
  label: string
  targetScreenId?: string
  mutationKey?: string
  onSuccess?: { navigate: string }
}

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

export const shell = shellJson as Shell
