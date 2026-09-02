import { findDataSource } from './catalog'
import { isServed } from './served'

/**
 * 서버에서 받아 오는 길.
 *
 * 개발용 응답 4,400줄이 오랫동안 서버 대역을 했다. 그 덕에 화면 여든둘을 서버 없이
 * 지을 수 있었지만, **그 상태로는 계약이 실제로 쓸 만한지 알 수 없다** — 명세가
 * 말하는 모양과 서버가 내는 모양이 같은지 아무도 재 본 적이 없기 때문이다.
 *
 * 여기가 그 둘을 잇는 자리다. 켜면 같은 화면이 같은 값을 **서버에서** 받는다.
 *
 * ## 인자를 넘긴다 (2026-08-31)
 *
 * 오랫동안 인자 없는 자리만 됐다. 그릇은 화면이 무엇을 읽는지는 알지만 어떤 인자로
 * 부르는지는 모른다고 적어 두었는데, **그것도 명세가 이미 안다** — 요소마다 `params`가
 * 붙어 있고 그 인자가 어디서 오는지까지 적혀 있다(`screenParam`·`value`·`fieldKey`).
 * 화면 코드를 읽지 않고 명세를 걸으면 부를 것이 나온다.
 *
 * 그래서 담아 두는 칸이 **key가 아니라 (key, 인자)**가 됐다. 같은 출처를 다른 인자로
 * 두 번 부르면 다른 답이 오는데, key로만 담으면 뒤엣것이 앞엣것을 덮는다.
 *
 * 아직 안 되는 것: **화면 안의 칸에서 오는 인자**(검색어·거르개). 그 값은 화면
 * 컴포넌트 안의 `useState`에 있어서 그릇이 보지 못한다. 145개 중 26개가 그렇다.
 * 숨기지 않고 터뜨린다.
 */
export interface Server {
  /** 어디로 부르는가. 비면 같은 곳(상대 경로)이다. */
  baseUrl?: string
  fetch: typeof globalThis.fetch
}

let server: Server | null = null
const cache = new Map<string, unknown>()

/** 서버에서 받아 오게 한다. 되돌리는 함수를 준다. */
export function useServer(next: Server | null): () => void {
  const before = server
  server = next
  cache.clear()
  return () => {
    server = before
    cache.clear()
  }
}

export function servingFromServer(): boolean {
  return server !== null
}

/**
 * 지금 붙어 있는 서버.
 *
 * **선택지 출처도 같은 서버를 쓴다.** 두 벌을 두면 하나만 켜진 상태가 생기고,
 * 그러면 같은 화면의 표는 진짜인데 고르는 목록은 개발용 응답인 채로 그려진다.
 */
export function currentServer(): Server | null {
  return server
}

export class NeedsParams extends Error {}

/** 어느 출처를 어떤 인자로 부르는가. */
export interface SourceCall {
  key: string
  params: Record<string, string>
}

/**
 * 담아 두는 칸의 이름.
 *
 * **인자까지 넣는다.** 같은 출처를 다른 인자로 두 번 부르면 다른 답이 오는데,
 * key로만 담으면 뒤엣것이 앞엣것을 덮고 화면은 남의 행사를 그린다.
 *
 * 인자의 차례는 뜻이 없으므로 이름순으로 세운다 — 안 그러면 같은 부름이 적은
 * 차례에 따라 다른 칸이 된다.
 */
function slotOf(call: SourceCall): string {
  const parts = Object.keys(call.params)
    .sort()
    .map((name) => `${name}=${call.params[name]}`)
  return parts.length === 0 ? call.key : `${call.key}?${parts.join('&')}`
}

/**
 * 부를 주소.
 *
 * 경로에 `{이름}`으로 박힌 인자는 그 자리에 넣고, 나머지는 조회 인자로 붙인다 —
 * 계약을 뽑아낼 때 서버가 나눈 것과 같은 규칙이다(`parametersOf`).
 */
export function urlOf(path: string, params: Record<string, string>): string {
  const left = { ...params }
  const filled = path.replace(/\{([^}]+)\}/g, (_, name: string) => {
    const value = left[name] ?? ''
    delete left[name]
    return encodeURIComponent(value)
  })
  const query = new URLSearchParams(
    // 빈 값은 넘기지 않는다. 서버가 '안 넘겼다'와 '빈 값을 넘겼다'를 다르게 볼 수 있다.
    Object.entries(left).filter(([, value]) => value !== ''),
  ).toString()
  return query === '' ? filled : `${filled}?${query}`
}

/** 이 부름들을 받아 온다. 하나라도 실패하면 던진다 — 조용히 반만 그리지 않는다. */
export async function loadSources(calls: readonly SourceCall[]): Promise<void> {
  const at = server
  if (at === null) return
  await Promise.all(
    calls.map(async (call) => {
      // **아직 서버에 안 붙은 출처는 부르지 않는다.** 계약에 자리가 있어도 서버가
      // 답하지 않으면 404가 오고, 그러면 화면 하나가 통째로 오류가 된다.
      // 무엇이 붙었는지는 `served.ts`가 든다 — 그 목록이 진도표다.
      if (!isServed(call.key)) return
      const slot = slotOf(call)
      if (cache.has(slot)) return
      const source = findDataSource(call.key)
      const res = await at.fetch(`${at.baseUrl ?? ''}${urlOf(source.request.path, call.params)}`)
      if (!res.ok) {
        throw new Error(`데이터 출처 '${call.key}'를 받지 못했습니다(${res.status}).`)
      }
      cache.set(slot, await res.json())
    }),
  )
}

/**
 * 받아 둔 것.
 *
 * **서버를 쓰는데 안 받아 둔 부름이면 터뜨린다.** 개발용 응답으로 슬쩍 돌아가면
 * 화면은 그려지는데 그 값이 어디서 왔는지 아무도 모른다 — 이 저장소가 줄곧
 * 피해 온 조용한 대체다.
 */
export function fromServer(key: string, params: Record<string, string> = {}): unknown {
  if (server === null) return undefined
  // **아직 안 붙은 출처는 개발용 응답으로 간다.** 그것이 조용한 대체가 아닌 까닭은
  // 어느 것이 붙었는지를 `served.ts`가 코드로 들고 있기 때문이다 — 둘 다 적힌 상태다.
  if (!isServed(key)) return undefined
  const slot = slotOf({ key, params })
  if (!cache.has(slot)) {
    throw new NeedsParams(
      `데이터 출처 '${key}'를 인자 ${JSON.stringify(params)}로 받아 두지 않았습니다. ` +
        '그릇이 미리 받는 목록에 이 부름이 없습니다 — 화면 안의 칸에서 오는 인자는 아직 그릇이 보지 못합니다.',
    )
  }
  return cache.get(slot)
}

/**
 * api가 어디에 있는가.
 *
 * **비면 같은 곳이다**(상대 경로). 웹과 api를 한 주소에 올리면 그대로 두면 되고,
 * 나눠 올리면 `VITE_API_BASE_URL`이 그 자리를 말한다 — 그때는 쿠키가 사이트를
 * 건너므로 서버 쪽 설정도 함께 갈린다(`serve.ts`의 CORS).
 *
 * 화면이 주소를 지어내지 않게 여기 하나만 둔다.
 */
export function apiBaseUrl(): string {
  const base = import.meta.env.VITE_API_BASE_URL
  return typeof base === 'string' ? base.replace(/\/$/, '') : ''
}

/**
 * 이 브라우저에서 api를 부르는 길.
 *
 * **쿠키를 함께 보낸다.** 세션이 쿠키에 있으므로 이것이 없으면 로그인해도 다음
 * 요청은 로그인하지 않은 것과 같다 — 다른 주소로 부를 때 특히 그렇다.
 */
export function browserFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  return fetch(input, { ...init, credentials: 'include' })
}

/**
 * 이 브라우저를 서버에 붙인다. **앱이 켜질 때 한 번 부른다**(`main.tsx`).
 *
 * 오랫동안 이 자리가 없었다. `useServer`를 부르는 곳이 검사뿐이어서, 서버를 짓고
 * 배포하고 로그인까지 되는데도 **화면이 그리는 값은 전부 개발용 응답이었다** —
 * 서버가 답하는 자리가 늘어도 사람이 보는 것은 그대로였고, 화면이 멀쩡히 그려지니
 * 아무도 몰랐다.
 *
 * 무엇이 진짜로 서버에서 오는지는 `served.ts`가 든다. 여기서 켜는 것은 길뿐이고,
 * 그 길로 갈 출처는 그 목록이 정한다.
 */
export function startServing(): () => void {
  // **시나리오 검사는 개발용 응답으로 돈다.** 그 검사 사백스물아홉은 '명세가 말한 것을
  // 화면이 그리는가'를 보고, 개발용 응답이 바로 그 명세가 든 예시 값이다. 진짜 서버로
  // 돌리면 그 검사들은 명세가 아니라 저장소에 든 것을 재게 된다.
  //
  // **서버가 이어지는지는 다른 곳에서 잰다** — `*.server.test.tsx`가 진짜 Postgres에
  // 대고 화면을 그린다. 거기가 통합이고 여기는 적합성이다.
  //
  // 이 빌드는 `dist-e2e/`로만 나간다(`run-e2e.mjs`). 실서비스가 나가는 `dist/`가
  // 개발용 응답을 물고 배포되는 일이 **구조적으로 생길 수 없게** 자리를 갈라 두었다.
  if (import.meta.env.VITE_FIXTURES === '1') return () => {}
  return useServer({ baseUrl: apiBaseUrl(), fetch: browserFetch })
}
