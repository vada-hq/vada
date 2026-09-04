import { Component, Suspense, type ReactNode } from 'react'
import { messagesOf } from '../data-sources/loading'
import { NotBuiltYet, SourcesFailed } from '../data-sources/server'

/**
 * 화면이 읽다 멈춘 자리.
 *
 * **그릇이 미리 못 받아 두는 부름이 있다.** 검색어와 거르개는 화면 안의 칸에 살고,
 * 무엇을 칠지는 그리기 전에 알 수 없다 — 그래서 그 부름은 읽는 순간에야 정해진다.
 *
 * 그때 그릇은 받아 오기 시작하고 **약속을 던진다**. 여기가 그것을 받아 카탈로그의
 * '불러오는 중'을 그리고, 받아 오면 화면이 그대로 다시 그려진다. 깨졌으면 그 출처의
 * '불러오지 못했습니다'를 그린다.
 *
 * **화면은 한 줄도 안 고친다.** 열넷이 이 자리를 필요로 했고, 자리마다 고쳤으면
 * 자리마다 잊었을 것이다 — 이 저장소가 그릇을 두는 까닭과 같다.
 */
interface SourceGateProps {
  /** 이 화면이 읽는 출처들. 그릴 글을 카탈로그에서 고르는 데 쓴다. */
  sourceKeys: readonly string[]
  /** 화면이 바뀌면 깨진 상태를 놓는다 — 안 그러면 옛 오류가 새 화면에 남는다. */
  screenId: string
  children: ReactNode
}

/** 기다리는 동안과 깨졌을 때 그리는 자리. 둘 다 화면 하나를 통째로 대신한다. */
function Note({ messages, isError }: { messages: string[]; isError: boolean }) {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-gray-50 px-6">
      <div
        role={isError ? 'alert' : 'status'}
        className={`max-w-md text-center text-sm ${isError ? 'text-red-700' : 'text-gray-600'}`}
      >
        {messages.map((message) => (
          <p key={message}>{message}</p>
        ))}
      </div>
    </div>
  )
}

interface GateState {
  failedKeys: readonly string[] | null
  /** 아직 안 지은 자리를 읽었을 때. **실패와 다른 상태다.** */
  notBuilt: boolean
  screenId: string
}

export class SourceGate extends Component<SourceGateProps, GateState> {
  state: GateState = { failedKeys: null, notBuilt: false, screenId: this.props.screenId }

  /**
   * **받지 못한 것만 여기서 멈춘다.** 나머지 오류는 그대로 올려보낸다 — 화면의
   * 진짜 고장을 '불러오지 못했습니다'로 덮으면 그 고장을 아무도 못 본다.
   */
  static getDerivedStateFromError(error: Error): Partial<GateState> | null {
    if (error instanceof NotBuiltYet) return { notBuilt: true }
    return error instanceof SourcesFailed ? { failedKeys: error.keys } : null
  }

  static getDerivedStateFromProps(props: SourceGateProps, state: GateState): Partial<GateState> | null {
    return props.screenId === state.screenId
      ? null
      : { failedKeys: null, notBuilt: false, screenId: props.screenId }
  }

  render() {
    const { failedKeys, notBuilt } = this.state
    // **아직 안 지은 자리는 실패도 비었음도 아니다.**
    //
    // 이 글은 명세가 갖지 않는다 — 데이터에 대한 말이 아니라 **이 앱이 어디까지
    // 만들어졌는가**에 대한 말이고, 그것은 저장소가 아는 사실이다.
    if (notBuilt) {
      return (
        <Note
          messages={['이 화면은 아직 준비 중입니다.', '만들어지는 대로 열립니다.']}
          isError={false}
        />
      )
    }
    if (failedKeys !== null) {
      return <Note messages={messagesOf(failedKeys, 'error')} isError />
    }
    return (
      <Suspense fallback={<Note messages={messagesOf(this.props.sourceKeys, 'loading')} isError={false} />}>
        {this.props.children}
      </Suspense>
    )
  }
}
