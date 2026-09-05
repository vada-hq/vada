import shellJson from '../../../../specs/figma/vada-wireframe/shell.json'
import { findDataSource } from '../data-sources/catalog'
import { resolveParams } from './params'
import type { QueryParams, ScreenSpec } from './types'

/**
 * 이 화면이 조회하는 데이터 출처의 key 전부.
 *
 * **명세가 이미 말한다.** 화면이 무엇을 그리는지를 적으면서 어디서 받아 오는지도
 * 함께 적으므로, 무엇을 기다리는지도 명세가 안다 — 그릇이 화면 코드를 읽지 않고
 * 답할 수 있다.
 *
 * 모양이 아니라 **이름으로** 모은다. `dataSourceKey`는 요소·제목·조건 등 여러
 * 자리에 붙는데(itemList·summary·fieldSet·steps·meta.titleFrom·drawnWhen), 자리를
 * 하나씩 세면 새 자리가 생길 때마다 여기가 조용히 뒤처진다.
 *
 * 선택지 출처(`optionsSource.key`)는 세지 않는다 — 그것은 다른 카탈로그이고
 * 이미 제 나름의 늦게 오는 길을 갖는다(`fetchOptions`).
 */
export function dataSourceKeysOf(spec: ScreenSpec): string[] {
  const keys = new Set<string>()
  const walk = (node: unknown) => {
    if (Array.isArray(node)) {
      for (const item of node) walk(item)
      return
    }
    if (node === null || typeof node !== 'object') return
    for (const [name, value] of Object.entries(node)) {
      if (name === 'dataSourceKey' && typeof value === 'string') {
        keys.add(value)
        continue
      }
      // 선택지 출처는 다른 카탈로그다. 그 안으로 들어가지 않는다.
      if (name === 'optionsSource') continue
      walk(value)
    }
  }
  walk(spec)
  return [...keys]
}

/**
 * 이 화면이 **어떤 인자로** 무엇을 부르는가.
 *
 * key만 세던 것을 부름으로 넓혔다. 인자가 어디서 오는지는 명세가 이미 적어 두었고
 * (`value`·`screenParam`·`fieldKey`), 그것을 걸으면 그릇이 화면 코드를 읽지 않고
 * 부를 것을 안다.
 *
 * **못 채우는 인자가 있다.** 눌린 항목(`itemField`)·방금 보낸 답(`resultField`)·
 * 이미 집어 온 한 건(`sourceField`)은 그리기 전에는 없는 값이다. 그런 부름은 여기서
 * 내지 않는다 — 빈 값으로 부르면 서버가 엉뚱한 것을 답하고, 화면은 그것을 그린다.
 *
 * 화면 안의 칸에서 오는 인자(`fieldKey`)는 **스코프에 있는 것만** 채운다. 화면
 * 컴포넌트의 `useState`에 든 검색어·거르개는 그릇이 보지 못하므로, 사람이 그것을
 * 바꾸면 받아 두지 않은 부름이 되고 `fromServer`가 터뜨린다.
 */
export interface SourceCall {
  key: string
  params: Record<string, string>
}

/**
 * **빈 열쇠는 없는 열쇠다.**
 *
 * 화면이 아직 아무것도 안 고른 채로 열리면 그 자리의 인자가 빈 줄로 풀린다. 그
 * 상태로 미리 받으면 `/api/org/members//role-assignment` 같은 주소가 나가고,
 * 서버는 그것을 남의 것을 묻는 것으로 보아 막는다 — 그러면 **화면이 통째로 죽는다.**
 * ORG-04B가 열자마자 그랬고, 배포 모양으로 걷는 카나리가 찾았다(2026-09-05).
 *
 * 위의 '그리기 전에는 값이 없는 인자'와 같은 사정이다: 아직 모르는 것은 **묻지
 * 않는다.** 값이 생기면 그리는 자리에서 그때 묻는다.
 */
function missingKey(key: string, params: Record<string, string>): boolean {
  let source
  try {
    source = findDataSource(key)
  } catch {
    // 카탈로그에 없는 이름은 여기서 가리지 않는다. 그 잘못은 다른 자리가 든다.
    return false
  }
  return source.params.some(
    (param) => param.required && (params[param.key] ?? '').trim() === '',
  )
}

/** 그리기 전에는 값이 없는 인자. 이런 것이 섞인 부름은 미리 받지 않는다. */
function needsDrawnRow(params: QueryParams | undefined): boolean {
  return Object.values(params ?? {}).some(
    (argument) =>
      argument.itemField !== undefined ||
      argument.resultField !== undefined ||
      argument.sourceField !== undefined,
  )
}

export function dataSourceCallsOf(
  spec: ScreenSpec,
  from: { screenParams?: Record<string, string>; fields?: Record<string, string | null> } = {},
): SourceCall[] {
  const calls = new Map<string, SourceCall>()
  const walk = (node: unknown) => {
    if (Array.isArray(node)) {
      for (const item of node) walk(item)
      return
    }
    if (node === null || typeof node !== 'object') return
    const holder = node as { dataSourceKey?: unknown; params?: QueryParams }
    if (typeof holder.dataSourceKey === 'string') {
      if (!needsDrawnRow(holder.params)) {
        const params = resolveParams(holder.params, {
          ...(from.screenParams === undefined ? {} : { screenParams: from.screenParams }),
          ...(from.fields === undefined ? {} : { fields: from.fields }),
        })
        if (!missingKey(holder.dataSourceKey, params)) {
          const call = { key: holder.dataSourceKey, params }
          const slot = `${call.key}?${Object.keys(params).sort().map((name) => `${name}=${params[name]}`).join('&')}`
          calls.set(slot, call)
        }
      }
    }
    for (const [name, value] of Object.entries(node)) {
      // 선택지 출처는 다른 카탈로그다. 그 안으로 들어가지 않는다.
      if (name === 'optionsSource' || name === 'params') continue
      walk(value)
    }
  }
  walk(spec)
  for (const call of shellCallsOf(spec, from.screenParams ?? {})) {
    const slot = `${call.key}?${Object.keys(call.params).sort().map((name) => `${name}=${call.params[name]}`).join('&')}`
    if (!calls.has(slot)) calls.set(slot, call)
  }
  return [...calls.values()]
}

/**
 * 셸이 읽는 것.
 *
 * **화면의 요소가 아니라서 화면을 걸어서는 안 나온다.** 학생회 이름과 보는 사람은
 * 셸이 그리고, 행사 화면 일곱이 나눠 쓰는 머리도 셸이 그린다 — 그래서 화면만 걸어
 * 미리 받으면 셸이 읽을 때 받아 두지 않은 부름이 되어 터진다. 실제로 그랬다.
 *
 * 셸을 그리지 않는 화면(들어오는 중·바깥 사람)은 이것도 없다.
 */
function shellCallsOf(spec: ScreenSpec, screenParams: Record<string, string>): SourceCall[] {
  if (spec.viewer === 'joining' || spec.viewer === 'external') return []
  const shell = shellJson as {
    brand?: { dataSourceKey?: string }
    viewer?: { dataSourceKey?: string }
    workspaces?: Array<{
      key: string
      param?: string
      titleFrom?: { dataSourceKey?: string }
      status?: { dataSourceKey?: string }
    }>
  }
  const calls: SourceCall[] = []
  for (const key of [shell.brand?.dataSourceKey, shell.viewer?.dataSourceKey]) {
    if (typeof key === 'string') calls.push({ key, params: {} })
  }
  const workspace = (shell.workspaces ?? []).find((entry) => entry.key === spec.workspace?.key)
  if (workspace !== undefined) {
    // 어느 행사의 머리인가. 그 값은 주소가 실어 온다.
    const params =
      workspace.param === undefined ? {} : { [workspace.param]: screenParams[workspace.param] ?? '' }
    for (const key of [workspace.titleFrom?.dataSourceKey, workspace.status?.dataSourceKey]) {
      if (typeof key === 'string') calls.push({ key, params })
    }
  }
  return calls
}

