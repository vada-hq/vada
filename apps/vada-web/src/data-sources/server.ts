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
/** 지금 받아 오는 중인 부름. **칸마다 하나다** — 같은 것을 두 번 부르지 않는다. */
const coming = new Map<string, Promise<void>>()
/** 받아 오다 깨진 부름. 어느 출처였는지를 든다 — 그 출처의 글을 그려야 한다. */
const broken = new Map<string, string>()

function empty(): void {
  cache.clear()
  coming.clear()
  broken.clear()
}

/** 서버에서 받아 오게 한다. 되돌리는 함수를 준다. */
export function useServer(next: Server | null): () => void {
  const before = server
  server = next
  who = ''
  empty()
  return () => {
    server = before
    empty()
  }
}

/**
 * 받아 둔 것을 통째로 잊는다.
 *
 * **쓰고 나면 읽은 것이 낡는다.** 그릇은 한 번 받아 둔 부름을 다시 부르지 않으므로,
 * 비우지 않으면 초대 코드를 다시 만들어도 화면은 옛 코드를 그린다 — 그 코드를 받은
 * 사람은 못 들어온다. 검사가 서버를 갈아 끼워 이 자리를 대신하고 있었고, 그동안
 * **배포된 화면에는 비우는 자리가 아예 없었다.**
 *
 * **어느 것이 낡았는지 고르지 않는다.** 무엇을 쓰면 무엇이 바뀌는지는 명세가 적어
 * 두지 않았고, 짐작해서 고르면 고르지 않은 자리가 조용히 낡는다 — 조용한 것이 이
 * 결함을 오래 살렸다. 쓰고 나면 우리가 든 어느 것도 여전히 참인지 알 수 없다.
 */
export function forgetSources(): void {
  empty()
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
  const named = parts.length === 0 ? call.key : `${call.key}?${parts.join('&')}`
  // **누가 보고 있는지가 칸 이름에 든다.** 아래를 보라.
  return `${who}|${named}`
}

/**
 * 지금 보고 있는 사람.
 *
 * **칸 이름에 신원이 없었다.** 출처와 인자만으로 담아 두었으니, 신원이 바뀌어도
 * 앞사람의 값이 그대로 읽혔다 — 조직을 바꾸면 남의 학생회 것이 화면에 남는다.
 *
 * 지금은 일어날 수 없다. 나가는 자리도 조직을 바꾸는 자리도 아직 명세에 없어서
 * 신원이 바뀔 길이 없고, 들어오는 길은 구글을 다녀오는 통째 이동이라 그릇이
 * 새로 선다. **그래서 이것은 고침이 아니라 자물쇠다** — 그 화면이 생기는 날
 * 조용히 새지 않게.
 *
 * 교차검토가 짚었다(2026-09-05).
 */
let who = ''

/**
 * 보고 있는 사람이 바뀌었다고 알린다. **바뀌면 담아 둔 것을 통째로 놓는다.**
 *
 * 이름을 지어내지 않는다 — 서버가 답한 학생회의 id를 그대로 쓴다. 짐작한 이름은
 * 두 사람이 같은 이름을 갖는 날 조용히 섞인다.
 *
 * **아직 아무도 부르지 않는다.** 셸이 서버에서 받는 것은 학생회의 *이름*뿐이고
 * (`shell.organization`의 조각이 `name` 하나다) 사람 쪽도 `name`·`role`뿐이라,
 * 화면에는 신원이라 부를 값이 없다. 이름으로 대신하면 같은 이름의 학생회가
 * 생기는 날 조용히 섞이므로 그러지 않는다.
 *
 * 그래서 지금은 **자물쇠만 있고 열쇠가 없다.** 조직을 바꾸는 화면이나 나가는
 * 자리를 만들 때, 셸이 id를 함께 받게 하고 여기를 부르면 된다.
 */
export function servingAs(identity: string): void {
  if (identity === who) return
  who = identity
  empty()
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

/**
 * **무엇을 못 받았는지 실은 실패.**
 *
 * 한동안 실패가 이름을 달고 있지 않아, 부르는 쪽이 그 화면이 기다리는 **전부**를
 * 못 받았다고 적었다 — HOME-01K이 읽는 아홉 중 진짜로 서버에서 오는 것은 둘뿐인데
 * 그 둘이 막히자 **요청조차 나가지 않은 일곱까지** 빨갛게 나왔다. 사람은 아홉 군데가
 * 고장 난 줄 알고 없는 자리를 뒤진다.
 */
/**
 * 아직 만들지 않은 자리.
 *
 * **실패가 아니다.** 서버가 고장 난 것도, 데이터가 없는 것도 아니고, 우리가 그
 * 자리를 아직 안 지은 것이다. 셋을 같은 글로 말하면 사람이 기다려야 하는지
 * 다시 눌러야 하는지 우리를 불러야 하는지 가릴 수 없다.
 */
export class NotBuiltYet extends Error {
  readonly key: string

  constructor(key: string) {
    super(`데이터 출처 '${key}'는 아직 서버에 붙지 않았습니다.`)
    this.name = 'NotBuiltYet'
    this.key = key
  }
}

export class SourcesFailed extends Error {
  readonly keys: readonly string[]

  constructor(keys: readonly string[]) {
    super(`데이터 출처를 받지 못했습니다: ${keys.join(', ')}`)
    this.name = 'SourcesFailed'
    this.keys = keys
  }
}

/**
 * 한 칸을 받아 온다. **칸마다 한 번이다.**
 *
 * 성공하면 담고, 깨지면 깨진 것으로 적는다 — 둘 다 다음 그리기가 읽는다.
 */
function bring(call: SourceCall): Promise<void> {
  const slot = slotOf(call)
  const already = coming.get(slot)
  if (already !== undefined) return already
  const at = server!
  const run = (async () => {
    try {
      const source = findDataSource(call.key)
      const res = await at.fetch(`${at.baseUrl ?? ''}${urlOf(source.request.path, call.params)}`)
      if (!res.ok) throw new Error(String(res.status))
      cache.set(slot, await res.json())
      broken.delete(slot)
    } catch {
      broken.set(slot, call.key)
    } finally {
      coming.delete(slot)
    }
  })()
  coming.set(slot, run)
  return run
}

/**
 * 이 부름들을 받아 온다.
 *
 * **하나라도 실패하면 던진다** — 조용히 반만 그리지 않는다. 다만 **어느 것이**
 * 실패했는지를 실어 던진다.
 *
 * 먼저 죽은 하나 때문에 나머지를 안 부르지도 않는다. 둘이 막혔으면 둘 다 알아야
 * 사람이 한 번에 본다.
 */
export async function loadSources(calls: readonly SourceCall[]): Promise<void> {
  if (server === null) return
  const failed: string[] = []
  await Promise.all(
    calls.map(async (call) => {
      // **아직 서버에 안 붙은 출처는 부르지 않는다.** 계약에 자리가 있어도 서버가
      // 답하지 않으면 404가 오고, 그러면 화면 하나가 통째로 오류가 된다.
      // 무엇이 붙었는지는 `served.ts`가 든다 — 그 목록이 진도표다.
      //
      // 부르지 않았으므로 **실패한 것으로도 세지 않는다.**
      if (!isServed(call.key)) return
      const slot = slotOf(call)
      if (cache.has(slot)) return
      await bring(call)
      if (broken.has(slot)) failed.push(call.key)
    }),
  )
  if (failed.length > 0) throw new SourcesFailed(failed)
}

/**
 * 받아 둔 것.
 *
 * **서버를 쓰는데 안 받아 둔 부름이면 개발용 응답으로 돌아가지 않는다.** 화면은
 * 그려지는데 그 값이 어디서 왔는지 아무도 모르게 되기 때문이다 — 이 저장소가 줄곧
 * 피해 온 조용한 대체다.
 *
 * ## 없으면 받아 온다
 *
 * 한동안 없으면 그냥 터뜨렸다. 그릇이 화면을 그리기 전에 미리 받아 두는데, **화면
 * 안의 칸에서 오는 인자는 그릇이 보지 못하기** 때문이다 — 검색어와 거르개가 그렇다.
 * 그래서 거르개가 달린 화면은 서버에 붙는 순간 통째로 터졌다. 열아홉 중 열넷이
 * 그런 화면이고, 학생 명단(ORG-07A)은 이미 붙여 둔 채였다(2026-09-02).
 *
 * 이제 없으면 **받아 오기 시작하고 그동안 그리기를 멈춘다**(약속을 던진다). 멈춘
 * 자리는 `ScreenBody`를 감싼 자리가 받아 카탈로그의 '불러오는 중'을 그리고, 받아
 * 오면 그대로 다시 그려진다. 화면은 여전히 동기로 읽는다 — 한 줄도 안 고쳤다.
 *
 * 미리 받아 두는 일을 없애지는 않았다. 그것이 있어야 한 화면의 여러 부름이 **함께**
 * 나간다 — 없으면 하나씩 줄지어 기다린다.
 */
export function fromServer(key: string, params: Record<string, string> = {}): unknown {
  if (server === null) return undefined
  // **아직 안 붙은 출처는 개발용 응답으로 돌아가지 않는다.**
  //
  // 한동안 여기서 `undefined`를 돌려주었고 그러면 카탈로그가 개발용 응답을 그렸다.
  // 개발할 때는 그것이 맞았다 — 서버가 한 줄도 없는 동안 화면 여든다섯을 지어야 했고,
  // 어느 것이 진짜인지는 `served.ts`가 코드로 들고 있었다.
  //
  // **배포된 앱에서는 그것이 거짓말이다.** 2026-09-05에 값을 치렀다: 방금 만든
  // 빈 학생회의 홈에 남의 행사와 남의 예산이 그려졌다. 값을 읽는 화면 일흔넷 중
  // **마흔**이 그 상태였다. 사람은 `served.ts`를 읽지 않는다.
  //
  // 이제 없으면 없다고 말한다. **'비었다'와는 다른 말이다** — 행사가 하나도 없는
  // 것과 우리가 아직 그 자리를 안 만든 것은 다른 사실이고, `empty`를 그리면 사람은
  // 앞엣것으로 읽는다.
  if (!isServed(key)) throw new NotBuiltYet(key)
  const slot = slotOf({ key, params })
  if (cache.has(slot)) return cache.get(slot)
  // 깨진 것은 그 사실을 던진다. 어느 출처였는지를 실어야 그 출처의 글이 그려진다.
  const failed = broken.get(slot)
  if (failed !== undefined) throw new SourcesFailed([failed])
  throw bring({ key, params })
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
