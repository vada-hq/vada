import type { ReactNode } from 'react'
import shellJson from '../../../../specs/figma/vada-wireframe/shell.json'
import { readObjectSource } from '../data-sources/catalog'
import type { Workspace } from '../spec/workspaces'

// 모든 데스크톱 화면이 공유하는 앱 구조(사이드바 + 헤더).
//
// 화면 하나의 요소가 아니므로 screen.json이 아니라 wireframe 단위 shell.json이
// 갖는다. 헤더에 무엇을 쓸지는 각 화면의 meta가 정한다 — 셸은 자리만 만든다.

interface ShellNavItem {
  label: string
  targetScreenId?: string
  note?: string
}

interface Shell {
  schemaVersion: 1
  brand: { name: string; dataSourceKey?: string; subtitleField?: string }
  navigation: ShellNavItem[]
  // 화면 묶음이 나눠 쓰는 머리. spec/workspaces.ts가 읽는다.
  workspaces?: Workspace[]
  viewer?: { dataSourceKey: string; nameField: string; roleField?: string }
}

export const shell = shellJson as Shell

interface AppShellProps {
  screenId: string
  /** 하위 상세 화면이 어느 최상위 메뉴에 속하는지. 없으면 screenId로 판정한다. */
  activeNavigationScreenId?: string
  eyebrow?: string | null
  title: string
  description?: string | null
  footerNote?: string | null
  /** 제목 위의 현재 위치 경로. 셸은 자리를 만들고 화면이 경로의 내용을 정한다. */
  breadcrumb?: ReactNode
  // 머리 오른쪽의 화면 동작. 셸이 아니라 화면의 요소다 — 그려지는 자리만 여기다.
  // 이 자리가 없던 동안 TASK-01의 '업무 추가'(18:90)는 명세에도 화면에도 없었고,
  // 대조기는 등록 노드 밖을 보지 않아 아무도 몰랐다.
  headerAction?: ReactNode
  onNavigate: (screenId: string) => void
  children: ReactNode
}

export function AppShell({
  screenId,
  activeNavigationScreenId,
  eyebrow,
  title,
  description,
  footerNote,
  breadcrumb,
  headerAction,
  onNavigate,
  children,
}: AppShellProps) {
  const brandSubtitle =
    shell.brand.dataSourceKey && shell.brand.subtitleField
      ? String(readObjectSource(shell.brand.dataSourceKey)[shell.brand.subtitleField])
      : null
  const viewer = shell.viewer ? readObjectSource(shell.viewer.dataSourceKey) : null

  return (
    <div className="flex min-h-screen bg-gray-50">
      <aside className="flex w-56 shrink-0 flex-col justify-between border-r border-gray-200 bg-white">
        <div>
          <div className="flex items-center gap-2 px-4 py-4">
            <span className="flex h-8 w-8 items-center justify-center rounded bg-blue-600 text-sm font-bold text-white">
              {shell.brand.name.slice(0, 1)}
            </span>
            <span>
              <span className="block text-sm font-semibold text-gray-900">
                {shell.brand.name}
              </span>
              {brandSubtitle === null ? null : (
                <span className="block text-xs text-gray-500">{brandSubtitle}</span>
              )}
            </span>
          </div>

          <nav aria-label="주요 메뉴" className="px-2">
            {shell.navigation.map((item) => {
              const current = item.targetScreenId === (activeNavigationScreenId ?? screenId)
              return (
                <button
                  key={item.label}
                  type="button"
                  aria-current={current ? 'page' : undefined}
                  // 아직 명세되지 않은 화면은 눌러도 갈 곳이 없다. 조용히 아무 일도
                  // 일어나지 않는 대신 비활성으로 드러낸다.
                  disabled={item.targetScreenId === undefined}
                  title={item.note}
                  onClick={() =>
                    item.targetScreenId === undefined
                      ? undefined
                      : onNavigate(item.targetScreenId)
                  }
                  className={`block w-full rounded px-3 py-2 text-left text-sm ${
                    current
                      ? 'bg-blue-50 font-medium text-blue-700'
                      : 'text-gray-600 enabled:hover:bg-gray-50 disabled:text-gray-400'
                  }`}
                >
                  {item.label}
                </button>
              )
            })}
          </nav>
        </div>

        {viewer === null || shell.viewer === undefined ? null : (
          <div className="border-t border-gray-200 px-4 py-3">
            <span className="block text-sm font-medium text-gray-900">
              {String(viewer[shell.viewer.nameField])}
            </span>
            {shell.viewer.roleField === undefined ? null : (
              <span className="block text-xs text-gray-500">
                {String(viewer[shell.viewer.roleField])}
              </span>
            )}
          </div>
        )}
      </aside>

      <div className="min-w-0 flex-1">
        <header className="flex items-center justify-between gap-4 border-b border-gray-200 bg-white px-8 py-4">
          <span className="min-w-0">
            {breadcrumb}
            {eyebrow === null || eyebrow === undefined ? null : (
              <span className="block text-xs text-gray-500">{eyebrow}</span>
            )}
            <h1 className="text-xl font-semibold text-gray-900">{title}</h1>
          </span>
          {headerAction === undefined ? null : (
            <span className="shrink-0">{headerAction}</span>
          )}
        </header>
        <main className="px-8 py-6">
          {description === null || description === undefined ? null : (
            <p className="pb-4 text-sm text-gray-600">{description}</p>
          )}
          {children}
          {footerNote === null || footerNote === undefined ? null : (
            <p className="pt-6 text-xs text-gray-500">{footerNote}</p>
          )}
        </main>
      </div>
    </div>
  )
}
