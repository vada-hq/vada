import type { ReactNode } from 'react'
import { FigmaAsset } from './FigmaAsset'
import { NEUTRAL_CHIP, STATE_CHIP } from '../design/tones'
import { readObjectSource } from '../data-sources/catalog'
import { currentTabOf, workspaceOf } from '../spec/workspaces'
import type { WorkspaceTabTarget } from '../spec/workspaces'
import type { ScreenSpec } from '../spec/types'

// 작업 공간의 머리 — 갈피 줄과 상태 줄.
//
// 행사 화면 일곱이 똑같이 그리는 것이라 화면이 아니라 shell.json이 갖는다. 화면은
// **어디에 그리는지(nodeId)만** 준다. 그래서 이 부품은 화면 하나를 받아 그 화면의
// 등록 노드에 공간의 내용을 끼운다.
//
// 갈피는 고르는 것이 아니라 **옮겨 가는 것**이다 — 갈피마다 다른 화면이다.
// 옮겨 갈 때 공간의 인자(어느 행사인지)가 함께 간다.

interface WorkspaceHeaderProps {
  screen: ScreenSpec
  screenParams: Record<string, string>
  onNavigate: (screenId: string, params?: Record<string, string>) => void
  /** 아직 명세되지 않은 갈피를 눌렀을 때. 화면이 그 문구를 어디에 띄울지 정한다. */
  onPending: (note: string) => void
  /** 상태 줄의 아이콘. 자산은 화면마다 다른 노드라 화면이 지목한다. */
  statusAssets?: Partial<Record<string, string>>
  assetScreenId?: string
  /**
   * 상태 줄 오른쪽 끝의 행동. 셸이 아니라 화면의 요소이고 그리는 자리만 여기다 —
   * AppShell의 headerAction과 같은 규칙이다.
   *
   * 이 자리에는 안내(permissionNote)가 오거나 행동이 오거나 둘 중 하나다. 그 안내가
   * '행사 관리 행동은 담당 운영진에게 제공됩니다'라고 적혀 있는 것이 근거다 —
   * 안내는 행동이 없다는 말이므로, 행동이 있으면 안내가 설 자리가 없다.
   */
  actions?: ReactNode
}

// 딱지로 그리는 조각과 오른쪽 끝으로 밀리는 안내. 어느 조각이냐는 명세의 field가
// 말한다 — 이름은 화면이 아니라 데이터 출처의 것이므로 공간이 늘어도 같다.
const CHIP_FIELDS = new Set(['status', 'alert'])

/**
 * 이 갈피가 데려갈 화면. **공간의 상태가 갈래를 정할 수 있다.**
 *
 * 후속 정리 중인 행사의 '개요'는 기획 중 개요가 아니라 정리 화면이다. 갈래를
 * 가르는 것은 **열쇠**이지 그려지는 말이 아니다 — 상태의 이름은 서버가 주는
 * 글이라 명세가 들면 단계가 하나 바뀔 때마다 명세가 틀린다.
 *
 * 명세가 든 갈래에 없는 열쇠면 기본으로 간다. 갈피는 늘 갈 곳이 있어야 한다.
 */
function tabTargetOf(
  tab: { targetScreenId?: string; targetField?: string; targets?: WorkspaceTabTarget[] },
  status: Record<string, unknown> | null,
): string {
  const fallback = tab.targetScreenId ?? ''
  if (tab.targetField === undefined || tab.targets === undefined || status === null) {
    return fallback
  }
  const key = String(status[tab.targetField] ?? '')
  return tab.targets.find((target) => target.value === key)?.targetScreenId ?? fallback
}
const MUTED_FIELD = 'permissionNote'

export function WorkspaceHeader({
  screen,
  screenParams,
  onNavigate,
  onPending,
  statusAssets = {},
  assetScreenId,
  actions,
}: WorkspaceHeaderProps) {
  const workspace = workspaceOf(screen)
  if (workspace === null || screen.workspace === undefined) {
    return null
  }
  const here = currentTabOf(screen, workspace)
  const argument = { [workspace.param]: screenParams[workspace.param] ?? '' }
  const status = workspace.status
    ? readObjectSource(workspace.status.dataSourceKey, argument)
    : null

  return (
    <>
      <nav
        data-node-id={screen.workspace.source.tabs}
        aria-label={workspace.description}
        className="-mx-8 -mt-6 flex gap-6 border-b border-gray-200 bg-white px-8"
      >
        {workspace.tabs.map((tab) => {
          const current = tab === here
          return (
            <button
              key={tab.label}
              type="button"
              aria-current={current ? 'page' : undefined}
              onClick={() => {
                if (tab.targetScreenId === undefined) {
                  onPending(tab.note ?? '')
                  return
                }
                onNavigate(tabTargetOf(tab, status), argument)
              }}
              className={`border-b-2 py-3.5 text-sm font-medium ${
                current
                  ? 'border-blue-600 text-blue-700'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label}
            </button>
          )
        })}
      </nav>

      {status === null || workspace.status === undefined ? null : (
        <div
          data-node-id={screen.workspace.source.status}
          className="-mx-8 flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-gray-200 bg-white px-8 py-2.5"
        >
          {workspace.status.items
            // 눈에 띄어야 하는 것은 없으면 아예 오지 않는다 — 자리를 비워 두지 않는다.
            .filter((item) => status[item.field ?? ''] !== undefined)
            .map((item) => {
              const field = item.field ?? ''
              const value = String(status[field])
              if (CHIP_FIELDS.has(field)) {
                const tone = String(status[`${field}Tone`])
                return (
                  <span
                    key={field}
                    data-design-rule="state-chip"
                    className={`rounded px-2 py-0.5 text-xs font-medium ${
                      STATE_CHIP[tone] ?? NEUTRAL_CHIP
                    }`}
                  >
                    {value}
                  </span>
                )
              }
              if (field === MUTED_FIELD) {
                if (actions !== undefined) {
                  return null
                }
                return (
                  <span key={field} className="ml-auto text-xs text-gray-400">
                    {value}
                  </span>
                )
              }
              const assetNodeId = statusAssets[field]
              return (
                <span
                  key={field}
                  className="flex items-center gap-1.5 text-xs text-gray-500"
                >
                  {assetNodeId && assetScreenId ? (
                    <FigmaAsset
                      screenId={assetScreenId}
                      nodeId={assetNodeId}
                      className="size-3"
                    />
                  ) : null}
                  {value}
                </span>
              )
            })}
          {actions}
        </div>
      )}
    </>
  )
}
