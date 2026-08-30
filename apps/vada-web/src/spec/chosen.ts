import { readListSource } from '../data-sources/catalog'
import type { ScreenSpec } from './types'

/**
 * **아무것도 고르기 전에 무엇이 골라져 있는가.**
 *
 * 명세가 말하지 않는다. `itemAction.choose`는 '누르면 값이 된다'까지만 말하고,
 * 처음에 무엇이 골라져 있는지는 데이터에도 그림에도 규칙이 없다.
 *
 * **그림은 자기 자신이 골라진 순간을 그렸다**(ORG-04B의 박해랑은 보는 사람이다).
 * 그런데 화면이 '누가 나인가'를 알 길이 명세에 없다 — `shell.viewer`는 이름과
 * 이어 붙인 역할만 주고 구성원 id를 주지 않는다. 그래서 **목록의 첫 줄**로 둔다.
 *
 * 여기 하나만 두는 까닭: 화면과 준수 검사가 같은 값을 봐야 한다. 두 곳이 저마다
 * 정하면 검사는 화면이 그리지 않는 것을 재게 된다.
 */
export function initialChosen(spec: ScreenSpec): Record<string, string> {
  const values: Record<string, string> = {}
  const walk = (node: unknown): void => {
    if (Array.isArray(node)) {
      for (const item of node) walk(item)
      return
    }
    if (node === null || typeof node !== 'object') return
    const holder = node as {
      dataSourceKey?: string
      itemAction?: { type?: string; fieldKey?: string; itemField?: string }
    }
    const action = holder.itemAction
    if (
      action?.type === 'choose' &&
      typeof action.fieldKey === 'string' &&
      typeof action.itemField === 'string' &&
      typeof holder.dataSourceKey === 'string'
    ) {
      const first = readListSource(holder.dataSourceKey)[0]
      if (first !== undefined) {
        values[action.fieldKey] = String(first[action.itemField] ?? '')
      }
    }
    for (const value of Object.values(node)) walk(value)
  }
  walk(spec)
  return values
}
