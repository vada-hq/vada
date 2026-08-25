import { describe, expect, it } from 'vitest'
import { findDataSource, readListSource, readObjectSourceOrNull } from '../data-sources/catalog'
import type { DataRow } from '../data-sources/catalog'
import { resolveParams } from './params'
import { ALL_SCREENS, exampleParamsOf } from './screens'
import type { DisplayAction, ElementSpec, QueryParams, ScreenSpec } from './types'

// 이동은 도착해야 한다.
//
// 검증기는 명세끼리만 맞춘다 — 대상 화면이 있는지, 그 화면이 그 인자를 받는지.
// 넘어간 **값**이 저쪽에서 실제로 무엇을 집어 오는지는 보지 않는다. 재정 보드의
// 카드가 'PR-01'을 넘기는데 요청 상세는 'PR-2026-0031'만 알던 자리가 그랬다:
// 두 개발용 응답이 같은 요청에 다른 이름을 붙여 두었고, 누르면 빈 상세가
// 열렸는데 게이트 넷 중 아무것도 말하지 않았다.
//
// 개발용 응답은 서버 대역이라 이 어긋남 자체는 배포되지 않는다. 그러나 **이어진
// 줄 알았는데 안 이어진 것**은 명세의 문제이기도 하다 — 어느 조각을 넘길지는
// 명세가 정하고, 그 조각이 저쪽의 열쇠와 같은 것인지는 아무도 적지 않았다.

interface Arrival {
  from: string
  to: string
  label: string
  params: Record<string, string>
}

function actionsOf(spec: ElementSpec): DisplayAction[] {
  const out: DisplayAction[] = []
  const candidate = spec as {
    action?: { type: string }
    itemAction?: DisplayAction
    selection?: { action: DisplayAction }
  }
  if (candidate.action?.type === 'navigate') {
    out.push(candidate.action as DisplayAction)
  }
  if (candidate.itemAction !== undefined) {
    out.push(candidate.itemAction)
  }
  if (candidate.selection !== undefined) {
    out.push(candidate.selection.action)
  }
  return out.filter((action) => action.type === 'navigate')
}

// 목록 항목의 동작이 넘기는 값은 눌린 그 행만 안다. 검사는 첫 행으로 대신한다 —
// 한 행이 이어지면 그 목록이 이어지는 것이고, 첫 행조차 못 이으면 확실히 끊겼다.
function firstRowOf(screen: ScreenSpec, spec: ElementSpec): DataRow | undefined {
  const candidate = spec as { dataSourceKey?: string; params?: QueryParams }
  if (candidate.dataSourceKey === undefined) {
    return undefined
  }
  if (findDataSource(candidate.dataSourceKey).shape !== 'list') {
    return undefined
  }
  const rows = readListSource(
    candidate.dataSourceKey,
    resolveParams(candidate.params, { screenParams: exampleParamsOf(screen.screenId) }),
  )
  return rows[0]
}

const ARRIVALS: Arrival[] = ALL_SCREENS.flatMap((screen) =>
  screen.elements.flatMap((element) =>
    actionsOf(element.spec).flatMap((action) => {
      if (action.type !== 'navigate') return []

      const listSpec = element.spec as { dataSourceKey?: string }
      const row = firstRowOf(screen, element.spec)
      // 누를 카드가 없는 빈 목록은 끊긴 것이 아니다. 재정 보드의 네 열 중 셋은
      // 개발용 응답에 카드가 없고, 그것은 '아직 그 단계인 요청이 없다'는 뜻이다.
      const needsRow = Object.values(action.params ?? {}).some(
        (argument) => argument.itemField !== undefined,
      )
      if (needsRow && row === undefined) {
        void listSpec
        return []
      }

      const params = resolveParams(action.params, {
        screenParams: exampleParamsOf(screen.screenId),
        row,
      })
      const label = (element.spec as { label?: string; title?: string })
      return [
        {
          from: screen.screenId,
          to: action.targetScreenId,
          label: action.label ?? label.label ?? label.title ?? action.targetScreenId,
          params,
        },
      ]
    }),
  ),
)

// 도착한 화면이 한 건을 집어 오는 자리. 목록은 비어 있는 것이 뜻인 경우가 있지만
// (아직 아무것도 없는 행사), 한 건의 상세가 없는 것은 잘못 온 것이다.
function objectSourcesOf(screen: ScreenSpec): Array<{ key: string; params?: QueryParams }> {
  const out: Array<{ key: string; params?: QueryParams }> = []
  const add = (key: string | undefined, params?: QueryParams) => {
    if (key === undefined) return
    if (findDataSource(key).shape !== 'object') return
    out.push({ key, params })
  }
  add(screen.meta?.titleFrom?.dataSourceKey, screen.meta?.titleFrom?.params)
  add(screen.breadcrumb?.dataSourceKey, screen.breadcrumb?.params)
  for (const element of screen.elements) {
    const spec = element.spec as { dataSourceKey?: string; params?: QueryParams }
    add(spec.dataSourceKey, spec.params)
  }
  return out
}

describe.each(ARRIVALS)('$from → $to ($label)', ({ to, params }) => {
  const target = ALL_SCREENS.find((screen) => screen.screenId === to)

  it('넘긴 값으로 대상 화면이 한 건을 집어 온다', () => {
    // 아직 구현되지 않은 화면으로의 이동은 명세가 pending으로 적는다. 여기 왔다는
    // 것은 이미 등록된 화면이라는 뜻이다.
    expect(target, `${to}이 ALL_SCREENS에 없습니다`).toBeDefined()
    if (target === undefined) return

    for (const { key, params: queryParams } of objectSourcesOf(target)) {
      // 대상 화면 안에서 값을 얻는 자리(fieldKey)는 이동이 채워 줄 수 없다.
      const usesScreenParam = Object.values(queryParams ?? {}).some(
        (argument) => argument.screenParam !== undefined,
      )
      if (!usesScreenParam) continue

      const row = readObjectSourceOrNull(key, resolveParams(queryParams, { screenParams: params }))
      expect(
        row,
        `${to}의 '${key}'가 ${JSON.stringify(params)}로 아무것도 집어 오지 못했습니다.`,
      ).not.toBeNull()
    }
  })
})
