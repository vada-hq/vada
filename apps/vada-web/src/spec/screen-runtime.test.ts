import { describe, expect, it } from 'vitest'
import { fieldsOfScreen, fieldsOfScope, type DraftList } from './draft-values'
import { ALL_SPEC_SCREENS, exampleParamsOf } from './screen-catalog'
import { SCREEN_RUNTIME, findScreenRuntime } from './screen-runtime.generated'
import { dataSourceCallsOf, dataSourceKeysOf } from './screen-sources'

describe('작은 화면 실행 명세는 전체 명세와 같은 동작을 말한다', () => {
  it('화면 목록과 라우팅에 필요한 속성이 같다', () => {
    expect(SCREEN_RUNTIME.map((screen) => screen.screenId)).toEqual(
      ALL_SPEC_SCREENS.map((screen) => screen.screenId),
    )
    for (const screen of ALL_SPEC_SCREENS) {
      const runtime = findScreenRuntime(screen.screenId)
      expect(runtime).toMatchObject({
        screenId: screen.screenId,
        drawable: screen.elements.length > 0,
        ...(screen.stateScopeKey === undefined ? {} : { stateScopeKey: screen.stateScopeKey }),
        ...(screen.viewer === undefined ? {} : { viewer: screen.viewer }),
        ...(screen.workspace?.key === undefined ? {} : { workspace: { key: screen.workspace.key } }),
      })
      expect(runtime?.meta?.title).toBe(screen.meta?.title)
      expect(runtime?.meta?.eyebrow).toBe(screen.meta?.eyebrow)
    }
  })

  it('미리 받을 데이터 출처와 인자 해석이 같다', () => {
    for (const screen of ALL_SPEC_SCREENS) {
      const runtime = findScreenRuntime(screen.screenId)!
      const from = { screenParams: exampleParamsOf(screen.screenId) }
      expect(dataSourceKeysOf(runtime), screen.screenId).toEqual(dataSourceKeysOf(screen))
      expect(dataSourceCallsOf(runtime, from), screen.screenId).toEqual(dataSourceCallsOf(screen, from))
    }
  })

  it('전송 몸통을 바꾸는 스코프별 칸이 같다', () => {
    const expected = new Map<string, { booleans: Set<string>; lists: DraftList[] }>()
    for (const screen of ALL_SPEC_SCREENS) {
      if (screen.stateScopeKey === undefined) continue
      const fields = expected.get(screen.stateScopeKey) ?? { booleans: new Set<string>(), lists: [] }
      const current = fieldsOfScreen(screen)
      for (const field of current.booleans) fields.booleans.add(field)
      for (const list of current.lists) {
        if (!fields.lists.some((found) => found.fieldKey === list.fieldKey)) fields.lists.push(list)
      }
      expected.set(screen.stateScopeKey, fields)
    }
    for (const [scope, fields] of expected) {
      const runtime = fieldsOfScope(scope)
      expect([...runtime.booleans].sort(), scope).toEqual([...fields.booleans].sort())
      expect(runtime.lists, scope).toEqual(
        fields.lists
          .map((list) => ({
            fieldKey: list.fieldKey,
            ...(list.itemValueKey === undefined ? {} : { itemValueKey: list.itemValueKey }),
          }))
          .sort((left, right) => left.fieldKey.localeCompare(right.fieldKey)),
      )
    }
  })
})
