import type { ScreenSpec } from './types'

// 초안의 칸은 **글이고** 서버의 값은 아니다.
//
// 화면의 칸은 사람이 치는 것이라 전부 글로 다룬다 — 체크 상자도 `'y'`와 빈 글이다.
// 그런데 서버는 참거짓을 주고 참거짓을 받는다(계약이 `valueType: boolean`이라 적었고
// 표도 `boolean` 열이다). 그 사이를 아무도 옮겨 주지 않으면 두 곳이 조용히 어긋난다.
//
// **값을 치르고 알았다**(2026-09-04). `String(true)`가 `'true'`가 되는데 상자는
// `'y'`를 보므로 **켜져 있는 것이 꺼져 보이고**, 그대로 저장하면 켜져 있던 것이
// 꺼진다 — 비공개 회의가 공개가 되고, 정해 둔 '종료 시간 미정'이 풀린다. 보내는
// 쪽도 마찬가지로 어긋나 서버가 422로 막았다(`readFlag`가 참거짓을 요구한다).
//
// 그래서 옮기는 규칙을 **한 곳**에 둔다. 자리마다 옮기면 자리마다 잊는다.

/** 체크 상자가 켜졌다는 뜻으로 초안에 담기는 글. 화면들이 이미 쓰던 꼴이다. */
const ON = 'y'

/**
 * 서버가 준 값을 초안의 칸에 담는 꼴로.
 *
 * **참거짓만 다르게 다룬다.** 나머지는 글로 그리는 것이라 그대로 옮기면 된다.
 */
export function draftValueOf(value: unknown): string {
  if (typeof value === 'boolean') return value ? ON : ''
  return String(value)
}

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
 * 초안을 서버로 보내는 몸통으로.
 *
 * 되풀이되는 묶음의 칸은 `묶음.줄.칸` 꼴로 담기므로(`itemKey`) **마지막 조각**으로
 * 본다 — 한 겹 안에 있어도 같은 칸이다.
 */
export function payloadOf(screen: ScreenSpec, values: Record<string, string | null>): Record<string, unknown> {
  const booleans = booleanFieldsOf(screen)
  const payload: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(values)) {
    const last = key.slice(key.lastIndexOf('.') + 1)
    payload[key] = booleans.has(last) ? value === ON : value
  }
  return payload
}
