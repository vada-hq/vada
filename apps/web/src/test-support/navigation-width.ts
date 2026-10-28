import { vi } from 'vitest'

// 작업 공간의 md 경계와 대화의 lg 경계를 실제 폭처럼 바꾸고 change를 보낸다.
export function navigationWidth(initial = 390) {
  let width = initial
  const queries = new Map<string, MediaQueryList>()
  vi.stubGlobal('matchMedia', (query: string) => {
    if (!queries.has(query)) {
      const events = new EventTarget()
      const minimum = Number(query.match(/[\d.]+/)?.[0]) * 16
      queries.set(query, {
        media: query,
        get matches() {
          return width >= minimum
        },
        addEventListener: events.addEventListener.bind(events),
        removeEventListener: events.removeEventListener.bind(events),
        dispatchEvent: events.dispatchEvent.bind(events),
      } as MediaQueryList)
    }
    return queries.get(query)!
  })
  return (next: number) => {
    width = next
    for (const query of queries.values()) query.dispatchEvent(new Event('change'))
  }
}
