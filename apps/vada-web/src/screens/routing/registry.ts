import type { ScreenRegistration, ScreenRenderer } from './types'

/** 업무별 등록을 합친다. 같은 ID를 덮어쓰면 잘못된 화면이 열리므로 즉시 알린다. */
export function createScreenRegistry(
  groups: readonly (readonly ScreenRegistration[])[],
): ReadonlyMap<string, ScreenRenderer> {
  const registry = new Map<string, ScreenRenderer>()
  for (const group of groups) {
    for (const { screenIds, render } of group) {
      for (const screenId of screenIds) {
        if (registry.has(screenId)) {
          throw new Error(`화면 '${screenId}'가 중복 등록됐습니다.`)
        }
        registry.set(screenId, render)
      }
    }
  }
  return registry
}
