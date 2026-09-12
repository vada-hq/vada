import { itemKey, joinRowIds } from './compute'
import { draftValueOf, ON } from './draft-scalar'
import { ALL_SPEC_SCREENS } from './screens'
import type { ListSpec, ScreenSpec } from './types'

export { draftValueOf } from './draft-scalar'

// 초안의 칸은 **글이고** 서버의 값은 아니다.
//
// 화면의 칸은 사람이 치는 것이라 전부 글로 다룬다 — 체크 상자도 `'y'`와 빈 글이고,
// 되풀이되는 묶음도 줄 이름을 열쇠에 박은 평평한 맵이다(`items: 'r0\nr1'`과
// `items.r0.itemName`). 그런데 **계약은 다른 꼴을 적었다**: 참거짓은 참거짓이고,
// 묶음은 줄의 배열이다.
//
// 그 사이를 아무도 옮겨 주지 않으면 두 곳이 조용히 어긋난다.
//
// **두 번 값을 치렀다.**
//
// 처음은 참거짓이었다(2026-09-04). `String(true)`가 `'true'`가 되는데 상자는 `'y'`를
// 보므로 **켜져 있는 것이 꺼져 보이고**, 그대로 저장하면 켜져 있던 것이 꺼진다 —
// 비공개 회의가 공개가 되고, 정해 둔 '종료 시간 미정'이 풀린다.
//
// 둘째는 묶음이었다(2026-09-09). ORG-02가 부서를 `'기획부\n홍보부'`라는 글 하나로
// 보냈고 서버는 배열을 요구해 422로 막았다 — **배포된 것을 사람이 눌러 보고서야
// 알았다.** 검사는 초록이었다: 검사가 손으로 계약의 배열을 적어 넣고 그것을 쟀기
// 때문이다(`joining.server.test.tsx`). 화면이 무엇을 만드는지는 아무도 안 쟀다.
//
// 그래서 옮기는 규칙을 **한 곳**에 둔다. 자리마다 옮기면 자리마다 잊는다.
//
// **여기를 지나지 않은 몸통은 나가지 못한다** — `mutations.ts`가 나가는 몸통을 계약에
// 대고 재고, 어긋나면 보내기 전에 던진다.

/** 화면이 초안에 줄 이름을 이어 담는 글자. 서버의 `body.ts`가 같은 글자를 안다. */
const ROW_SEPARATOR = '\n'

/**
 * 이 화면에서 참거짓을 담는 칸들.
 *
 * **명세가 말한다**(`valueType: 'boolean'`). 화면이 목록을 손으로 들면 칸이 하나
 * 늘 때마다 그 목록이 틀리고, 틀린 쪽은 조용하다.
 */
export function booleanFieldsOf(screen: ScreenSpec): Set<string> {
  const found = new Set<string>()
  const walk = (node: unknown): void => {
    if (node === null || typeof node !== 'object') return
    if (Array.isArray(node)) {
      for (const one of node) walk(one)
      return
    }
    const holder = node as { fieldKey?: unknown; valueType?: unknown }
    if (typeof holder.fieldKey === 'string' && holder.valueType === 'boolean') {
      found.add(holder.fieldKey)
    }
    for (const one of Object.values(node)) walk(one)
  }
  walk(screen)
  return found
}

/**
 * 이 화면의 되풀이되는 묶음들.
 *
 * **명세가 든다.** 화면이 손으로 세면 목록이 하나 늘 때마다 그 목록이 틀린다 —
 * 참거짓 칸을 명세에서 읽는 것과 같은 까닭이다.
 */
export function listsOf(screen: ScreenSpec): ListSpec[] {
  const found: ListSpec[] = []
  const walk = (node: unknown): void => {
    if (node === null || typeof node !== 'object') return
    if (Array.isArray(node)) {
      for (const one of node) walk(one)
      return
    }
    const holder = node as { type?: unknown; fieldKey?: unknown }
    if (holder.type === 'list' && typeof holder.fieldKey === 'string') {
      found.push(node as ListSpec)
    }
    for (const one of Object.values(node)) walk(one)
  }
  walk(screen)
  return found
}

/**
 * 평평하게 담긴 묶음을 계약이 적은 배열로.
 *
 * 줄 이름은 `묶음` 칸에 줄바꿈으로 이어 담기고, 줄의 값은 `묶음.줄.칸`에 담긴다.
 * **없는 줄을 지어내지 않는다** — 줄 이름이 없으면 빈 배열이다.
 */
function rowsOf(
  spec: ListSpec,
  values: Record<string, string | null>,
  booleans: Set<string>,
): Array<Record<string, unknown>> {
  const joined = values[spec.fieldKey]
  if (typeof joined !== 'string' || joined === '') return []
  const rowIds = joined
    .split(ROW_SEPARATOR)
    .map((one) => one.trim())
    .filter((one) => one !== '')

  return rowIds.map((rowId) => {
    const prefix = `${spec.fieldKey}.${rowId}.`
    const row: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(values)) {
      if (!key.startsWith(prefix)) continue
      const field = key.slice(prefix.length)
      row[field] = booleans.has(field) && typeof value === 'string' ? value === ON : value
    }
    // **줄에 담긴 것을 거르지 않는다.** 여기가 하는 일은 꼴을 바꾸는 것이고, 무엇이
    // 있어야 하는지는 계약과 서버가 정한다. 명세에 없는 칸을 여기서 버렸더니 예산
    // 편성이 고쳐지지 않았다 — 어느 줄을 고치는지 말하는 `id`가 사라졌기 때문이다.
    if (Object.keys(row).length > 0) return row

    // 칸이 하나도 안 담긴 줄은 **줄 이름이 곧 값이다**(부서의 이름, 참가자의 구성원 id).
    if (spec.itemValueKey === undefined) {
      throw new Error(
        `'${spec.fieldKey}' 목록의 줄 '${rowId}'에 담긴 칸이 없고, 명세에 itemValueKey도 없습니다. 줄이 무엇으로 불리는지 명세가 말해야 합니다.`,
      )
    }
    return { [spec.itemValueKey]: rowId }
  })
}

/**
 * 초안을 서버로 보내는 몸통으로.
 *
 * 두 가지를 옮긴다.
 *
 * | 초안 | 계약 |
 * | --- | --- |
 * | `'y'` · `''` | `true` · `false` |
 * | `'r0\nr1'` + `묶음.r0.칸` | `[{ 칸: … }, …]` |
 *
 * **묶음의 부속 열쇠는 나가지 않는다.** `묶음.줄.칸`도 `묶음.root`도 초안이 값을 어떻게
 * 들고 있는가에 대한 말이지 서버가 받는 것이 아니다 — 계약에 그런 칸이 없다.
 */
export function payloadOf(
  screen: ScreenSpec,
  values: Record<string, string | null>,
): Record<string, unknown> {
  return shapeBody(fieldsOfScreen(screen), values)
}

/** 이 초안을 옮기는 데 필요한 것. 참거짓 칸과 되풀이되는 묶음. */
export interface DraftFields {
  booleans: Set<string>
  lists: ListSpec[]
}

export function fieldsOfScreen(screen: ScreenSpec): DraftFields {
  return { booleans: booleanFieldsOf(screen), lists: listsOf(screen) }
}

/**
 * **상태 스코프 하나가 담는 칸들.**
 *
 * 한 스코프를 여러 화면이 함께 채운다 — `orgCreationDraft`는 ORG-01과 ORG-02가, 회의
 * 초안은 OPS-MEET-02 하나가. 그래서 옮기는 규칙도 화면이 아니라 **스코프**가 든다.
 *
 * 계약이 몸통을 만드는 방식과 **같은 자리를 읽는다**(`generate-openapi.mjs`의
 * `fieldsByScope`). 같은 곳에서 나와야 계약과 몸통이 갈리지 않는다.
 */
let byScope: Map<string, DraftFields> | null = null

/**
 * **처음 쓸 때 짓는다.** 불러올 때 지으면 모듈이 이어진 차례에 걸린다 — 셸이
 * `mutations`를 부르고 그것이 여기를, 여기가 `screens`를 부르는 고리가 생기자 화면
 * 명세가 아직 안 채워진 채로 이 자리가 돌았다(2026-09-09).
 */
function scopes(): Map<string, DraftFields> {
  if (byScope !== null) return byScope
  const built = new Map<string, DraftFields>()
  for (const screen of ALL_SPEC_SCREENS) {
    const scope = screen.stateScopeKey
    if (typeof scope !== 'string') continue
    const found = built.get(scope) ?? { booleans: new Set<string>(), lists: [] }
    for (const one of booleanFieldsOf(screen)) found.booleans.add(one)
    for (const one of listsOf(screen)) {
      if (!found.lists.some((had) => had.fieldKey === one.fieldKey)) found.lists.push(one)
    }
    built.set(scope, found)
  }
  byScope = built
  return built
}

/** 그 스코프의 칸들. 모르는 스코프면 옮길 것이 없다 — 값은 그대로 나간다. */
export function fieldsOfScope(scopeKey: string | undefined): DraftFields {
  if (scopeKey === undefined) return { booleans: new Set(), lists: [] }
  return scopes().get(scopeKey) ?? { booleans: new Set(), lists: [] }
}

/**
 * 초안을 계약의 꼴로.
 *
 * **이미 옮겨진 값은 건드리지 않는다.** 화면이 먼저 옮겨 보내도 같은 것이 나와야
 * 한다 — 두 번 옮겨 망가지면 '한 곳에서만 옮긴다'는 규칙을 지키기가 오히려 어려워진다.
 */
export function shapeBody(
  fields: DraftFields,
  values: Record<string, unknown>,
): Record<string, unknown> {
  const { booleans, lists } = fields
  const payload: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(values)) {
    const list = lists.find(
      (one) => one.fieldKey === key || key.startsWith(`${one.fieldKey}.`),
    )
    // 묶음의 자리는 아래에서 한꺼번에 짓는다. 부속 열쇠는 버린다.
    if (list !== undefined) continue
    const last = key.slice(key.lastIndexOf('.') + 1)
    payload[key] = booleans.has(last) && typeof value === 'string' ? value === ON : value
  }

  for (const list of lists) {
    const raw = values[list.fieldKey]
    // 묶음이 초안에 아예 없으면 없는 것이다 — 빈 배열은 '전부 지웠다'는 다른 사실이다.
    if (raw === undefined) continue
    // 이미 배열이면 옮길 것이 없다.
    payload[list.fieldKey] = Array.isArray(raw)
      ? raw
      : rowsOf(list, values as Record<string, string | null>, booleans)
  }

  return payload
}

/** 화면의 초안 한 벌. 값과 이름표가 갈려 있다. */
export interface Draft {
  values: Record<string, string | null>
  labels: Record<string, string>
}

/**
 * 서버가 준 한 건을 초안으로 옮긴다(`draftFrom`).
 *
 * **고칠 것을 먼저 읽어 온다.** 빈칸에서 시작하면 사람은 자기가 적어 둔 것을 다시
 * 적는다. 조각 이름이 칸 이름과 같으면 그 값으로 시작하고, 배열인 조각은 되풀이되는
 * 묶음이라 줄 이름을 붙여 편다.
 *
 * ## `<칸>Name`은 이름표다
 *
 * 고르는 값은 코드로 온다(`college: 'COL-…'`). 그대로 그리면 화면이 열리는 순간
 * 사람이 코드를 본다 — **서버가 완성된 글을 준다**는 규칙에 따라 이름이 곁에 함께
 * 오고, 그것은 값이 아니라 이름표 칸에 담긴다. 값에 담으면 저장할 때 서버가 모르는
 * 칸이 함께 간다.
 *
 * **곁에 그 값이 있어야 이름표다.** 이름이 그냥 값인 칸도 있다(`itemName`·
 * `sourceName`·`schoolName`). 그것을 이름표로 오해하면 그 칸이 통째로 빈다 —
 * 실제로 그랬다.
 *
 * 네 화면이 같은 것을 각자 들고 있었다(FIN-PLAN-01만 온전했고 나머지 셋은 이름표를
 * 버렸다). 자리마다 옮기면 자리마다 잊는다 — 보내는 쪽과 같은 까닭으로 여기 하나만 둔다.
 */
export function draftFromRow(row: Record<string, unknown>): Draft {
  const values: Record<string, string | null> = {}
  const labels: Record<string, string> = {}

  const put = (holder: Record<string, unknown>, key: string, field: string, value: unknown) => {
    const owner = field.endsWith('Name') ? field.slice(0, -'Name'.length) : ''
    if (owner !== '' && owner in holder) {
      labels[key.slice(0, key.length - 'Name'.length)] = String(value)
      return
    }
    values[key] = draftValueOf(value)
  }

  for (const [key, value] of Object.entries(row)) {
    if (!Array.isArray(value)) {
      put(row, key, key, value)
      continue
    }
    const rowIds: string[] = []
    value.forEach((item, index) => {
      const rowId = `r${index}`
      rowIds.push(rowId)
      for (const [field, fieldValue] of Object.entries(item as Record<string, unknown>)) {
        put(item as Record<string, unknown>, itemKey(key, rowId, field), field, fieldValue)
      }
    })
    values[key] = joinRowIds(rowIds)
  }

  return { values, labels }
}
