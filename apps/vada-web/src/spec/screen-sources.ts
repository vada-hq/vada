import type { ScreenSpec } from './types'

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
