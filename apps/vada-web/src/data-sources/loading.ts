import { useEffect, useRef, useState } from 'react'
import { findDataSource } from './catalog'
import { SourcesFailed, loadSources, servingFromServer, type SourceCall } from './server'

/**
 * 받아 오는 동안과 실패했을 때.
 *
 * **카탈로그는 출처마다 셋을 갖는다** — `loading`·`error`·`empty`. 그런데 화면이
 * 읽는 것은 `empty`뿐이었다(75곳). 나머지 290개를 아무도 읽지 않았고, 까닭은
 * 문구를 빠뜨린 것이 아니라 **읽기가 전부 동기**라서다: 기다리는 시간도 실패할
 * 통신도 없으면 그 두 문구가 그려질 순간 자체가 없다.
 *
 * 명세는 옳다. 진짜 서버는 늦게 답하고 가끔 실패한다. 모자란 것은 **참조 구현이
 * 그 두 상태를 갖지 않는다**는 것이었고, 그러면 명세만 보고 만드는 사람은 로딩과
 * 오류를 지어내야 한다.
 *
 * ## 왜 그릇이 하는가
 *
 * 화면 일흔여덟이 손으로 그린다 — 자리마다 붙이면 자리마다 잊는다. 그리고
 * **무엇을 기다리는지는 명세가 이미 안다**(`dataSourceKeysOf`). 그래서 그릇이
 * 화면을 그리기 전에 묻고, 그동안 카탈로그의 글을 그린다.
 *
 * 자리마다 따로 기다리는 것(표는 도는데 요약은 이미 왔다)이 결국 옳은 모양이지만,
 * 그러려면 요소를 그리는 층이 하나여야 한다. 지금은 아니므로 화면 단위로 한다 —
 * **그 사실을 숨기지 않고 백로그에 적는다.**
 *
 * ## 개발용 응답은 기본적으로 즉시 답한다
 *
 * 늦게 답하게 하면 검사 1,865개가 전부 기다려야 한다. 그것은 이 두 상태를
 * 증명하는 것과 아무 상관이 없는 비용이다. 그래서 기본은 즉시이고, 늦음과 실패는
 * **그것을 시험하는 검사가 켠다.** 켜는 자리가 있다는 것이 요점이다 — 코드 경로가
 * 없으면 명세의 그 줄은 영원히 말뿐이다.
 */
export interface LoadingBehaviour {
  /** 답하기까지의 시간(ms). 0이면 즉시 — 기다리는 상태가 생기지 않는다. */
  delayMs: number
  /** 이 key들은 실패한다. 카탈로그의 error 문구가 그려진다. */
  failing: readonly string[]
}

const INSTANT: LoadingBehaviour = { delayMs: 0, failing: [] }

let behaviour: LoadingBehaviour = INSTANT

/** 늦음과 실패를 켠다. 되돌리는 함수를 준다. */
export function setLoadingBehaviour(next: Partial<LoadingBehaviour>): () => void {
  const before = behaviour
  behaviour = { ...INSTANT, ...next }
  return () => {
    behaviour = before
  }
}

export type LoadingState =
  | { status: 'ready' }
  | { status: 'loading'; messages: string[] }
  | { status: 'error'; messages: string[] }

function messagesOf(keys: readonly string[], which: 'loading' | 'error'): string[] {
  const seen = new Set<string>()
  for (const key of keys) {
    const message = findDataSource(key).messages[which]
    // 같은 글을 여러 출처가 쓰면 한 번만 그린다. 화면이 다섯을 기다린다고
    // 같은 말을 다섯 번 하지 않는다.
    if (typeof message === 'string' && message !== '') seen.add(message)
  }
  return [...seen]
}

/**
 * 이 부름들이 올 때까지의 상태.
 *
 * 부름이 바뀌면 다시 기다린다 — 화면을 옮기거나 인자가 달라지면 그것을 새로 받는다.
 * **key가 아니라 부름**인 까닭은 같은 출처를 다른 인자로 두 번 부를 수 있기 때문이다.
 */
export function useSourceLoading(
  keys: readonly string[],
  makeCalls: () => readonly SourceCall[],
): LoadingState {
  // 인자까지 넣어야 인자가 바뀔 때 다시 받는다. 이름순으로 세워 차례가 뜻을 갖지
  // 않게 한다 — 안 그러면 같은 부름이 적힌 차례에 따라 다른 것으로 보인다.
  //
  // **서버를 안 쓰면 부름을 세지 않는다.** 개발용 응답으로 도는 동안에는 이 값이
  // 쓰이지 않는데, 화면 여든둘을 여러 번 그리는 검사에서는 그 헛일이 곱해진다.
  const fromServer = servingFromServer()
  const calls = fromServer ? makeCalls() : []
  const signature = fromServer
    ? calls
        .map((call) =>
          [call.key, ...Object.keys(call.params).sort().map((name) => `${name}=${call.params[name]}`)].join(''),
        )
        .join('')
    : keys.join('|')
  const failing = keys.filter((key) => behaviour.failing.includes(key))
  // 효과 안에서 읽는 값은 signature가 정한다. 배열을 그대로 의존성에 두면
  // 매번 새 배열이라 끝없이 다시 받는다.
  const callsRef = useRef(calls)
  callsRef.current = calls
  const delayMs = behaviour.delayMs
  const [arrived, setArrived] = useState(() => delayMs === 0 && !fromServer)
  const [broken, setBroken] = useState<string[]>([])

  useEffect(() => {
    // **서버가 켜져 있으면 진짜로 받아 온다.** 늦음을 흉내 내는 것과 실제로
    // 늦는 것은 다르다 — 흉내만 있으면 계약이 틀렸을 때 그것이 드러날 자리가 없다.
    if (fromServer) {
      let live = true
      setArrived(false)
      setBroken([])
      loadSources(callsRef.current)
        .then(() => {
          if (live) setArrived(true)
        })
        .catch((thrown: unknown) => {
          if (!live) return
          // **실패한 것만 실패했다고 말한다.** 부름 전부를 깨진 것으로 적으면
          // 요청조차 나가지 않은 개발용 응답까지 빨갛게 나오고, 사람은 없는 자리를
          // 뒤진다. 어느 것이 막혔는지는 `SourcesFailed`가 싣고 온다.
          setBroken(
            thrown instanceof SourcesFailed
              ? [...thrown.keys]
              : // 받아 오다 난 것이 아니면 어느 것 때문인지 알 수 없다. 그때는
                // 숨기지 않고 기다리던 것을 전부 든다.
                callsRef.current.map((call) => call.key),
          )
        })
      return () => {
        live = false
      }
    }
    if (delayMs === 0) {
      setArrived(true)
      return
    }
    setArrived(false)
    const timer = setTimeout(() => setArrived(true), delayMs)
    return () => clearTimeout(timer)
    // signature가 바뀌면 다시 받는다. 부름 배열 자체는 매번 새로 만들어지므로
    // 그것을 의존성으로 두면 끝없이 다시 받는다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature, delayMs, fromServer])

  if (broken.length > 0) {
    return { status: 'error', messages: messagesOf(broken, 'error') }
  }
  if (failing.length > 0) {
    return { status: 'error', messages: messagesOf(failing, 'error') }
  }
  if (!arrived) {
    return { status: 'loading', messages: messagesOf(keys, 'loading') }
  }
  return { status: 'ready' }
}
