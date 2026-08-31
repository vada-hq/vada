import { findDataSource } from './catalog'

/**
 * 서버에서 받아 오는 길.
 *
 * 개발용 응답 4,400줄이 오랫동안 서버 대역을 했다. 그 덕에 화면 여든둘을 서버 없이
 * 지을 수 있었지만, **그 상태로는 계약이 실제로 쓸 만한지 알 수 없다** — 명세가
 * 말하는 모양과 서버가 내는 모양이 같은지 아무도 재 본 적이 없기 때문이다.
 *
 * 여기가 그 둘을 잇는 자리다. 켜면 같은 화면이 같은 값을 **서버에서** 받는다.
 *
 * ## 아직 인자 없는 자리만 된다
 *
 * 그릇은 화면이 무엇을 읽는지(`dataSourceKeysOf`)는 알지만 **요소마다 어떤 인자로
 * 부르는지는 모른다.** 그것은 요소를 그리는 층이 알고, 지금 그 층은 화면 일흔여덟에
 * 흩어져 있다. 그래서 인자를 받는 자리는 아직 서버로 못 부른다 — 숨기지 않고
 * 부르면 터뜨린다. 자리마다의 기다림을 만들 때 함께 풀린다.
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

export class NeedsParams extends Error {}

/** 이 출처들을 받아 온다. 하나라도 실패하면 던진다 — 조용히 반만 그리지 않는다. */
export async function loadSources(keys: readonly string[]): Promise<void> {
  const at = server
  if (at === null) return
  await Promise.all(
    keys.map(async (key) => {
      const source = findDataSource(key)
      if (source.params.length > 0) {
        throw new NeedsParams(
          `데이터 출처 '${key}'는 조회 인자를 받습니다. 인자를 넘기는 자리는 아직 서버로 부르지 못합니다.`,
        )
      }
      const res = await at.fetch(`${at.baseUrl ?? ''}${source.request.path}`)
      if (!res.ok) {
        throw new Error(`데이터 출처 '${key}'를 받지 못했습니다(${res.status}).`)
      }
      cache.set(key, await res.json())
    }),
  )
}

/** 받아 둔 것. 없으면 undefined — 부르는 쪽이 개발용 응답으로 간다. */
export function fromServer(key: string): unknown {
  return server === null ? undefined : cache.get(key)
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

