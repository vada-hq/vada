import { Component, Suspense, type ReactNode } from 'react'
import { AppShell } from './AppShell'
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
  /** 화면의 머리글. 대신 그릴 때도 그 화면인 것은 그대로여야 한다. */
  meta?: { eyebrow?: string | null; title?: string | null }
  /** 어느 자리를 켤지. 갇히지 않으려면 메뉴가 살아 있어야 한다. */
  onNavigate: (screenId: string) => void
  children: ReactNode
}

/**
 * 기다리는 동안과 깨졌을 때 그리는 자리. 본문 하나를 대신한다.
 *
 * **셸 안에 그린다.** 한동안 화면을 통째로 덮었는데, 그러면 왼쪽 메뉴까지 사라져
 * **사람이 그 화면에 갇힌다** — 나갈 단추가 하나도 없다. 마흔 장이 그 상태였고,
 * 출하 카나리를 만들다 드러났다(2026-09-05).
 *
 * 셸은 자기 값을 서버에서 읽는다(학생회 이름). 그것마저 못 읽으면 이 자리가 다시
 * 던지고 바깥의 `ErrorBoundary`가 받는다 — 거기가 마지막 그물이다.
 */
function Lines({ messages, isError }: { messages: string[]; isError: boolean }) {
  return (
    <div
      role={isError ? 'alert' : 'status'}
      className={`flex flex-col items-center gap-1 rounded-lg border border-dashed px-6 py-16 text-center text-sm ${
        isError ? 'border-red-200 bg-red-50/60 text-red-700' : 'border-gray-300 bg-gray-50/60 text-gray-500'
      }`}
    >
      {messages.map((message) => (
        <p key={message}>{message}</p>
      ))}
    </div>
  )
}

function Note({
  messages,
  isError,
  screenId,
  meta,
  onNavigate,
}: {
  messages: string[]
  isError: boolean
  screenId: string
  meta?: { eyebrow?: string | null; title?: string | null }
  onNavigate: (screenId: string) => void
}) {
  // **셸도 서버를 읽는다**(학생회 이름). 그것이 아직 안 왔으면 셸을 그리다 다시
  // 멈추는데, 대신 그리는 자리에서 멈추면 받아 줄 바깥이 없어 화면이 통째로 죽는다 —
  // 실제로 그랬다(2026-09-05, 카나리가 잡았다). 그래서 여기에 자기 그물을 둔다:
  // 셸을 못 그리는 동안은 맨 글이고, 오면 셸 안으로 들어간다.
  return (
    <Suspense fallback={<Lines messages={messages} isError={isError} />}>
      <AppShell
        screenId={screenId}
        eyebrow={meta?.eyebrow ?? null}
        title={meta?.title ?? screenId}
        onNavigate={onNavigate}
      >
        <Lines messages={messages} isError={isError} />
      </AppShell>
    </Suspense>
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
    const { screenId, meta, onNavigate } = this.props
    if (notBuilt) {
      return (
        <Note
          messages={['이 화면은 아직 준비 중입니다.', '만들어지는 대로 열립니다.']}
          isError={false}
          screenId={screenId}
          meta={meta}
          onNavigate={onNavigate}
        />
      )
    }
    if (failedKeys !== null) {
      return (
        <Note
          messages={messagesOf(failedKeys, 'error')}
          isError
          screenId={screenId}
          meta={meta}
          onNavigate={onNavigate}
        />
      )
    }
    return (
      // **기다리는 동안은 맨 글이다.** 여기에 셸을 그리면 셸도 서버를 읽으므로
      // 대신 그리는 자리에서 또 멈추고, 그러면 본문이 와도 다시 그려지지 않는다 —
      // 화면이 영영 '불러오는 중'에 머문다(2026-09-05, 카나리가 잡았다).
      //
      // 갇히는 것은 기다림이 아니라 **준비 중과 실패**다. 그 둘은 안 끝나므로
      // 나갈 길이 있어야 하고, 기다림은 곧 끝난다.
      <Suspense fallback={<Lines messages={messagesOf(this.props.sourceKeys, 'loading')} isError={false} />}>
        {this.props.children}
      </Suspense>
    )
  }
}
