import { Component, Suspense, type ReactNode } from 'react'
import { Skeleton } from './Skeleton'
import { NotBuiltYet, SourcesFailed } from '../data-sources/server'

// **아직 안 지은 자리 하나만 가린다.**
//
// 화면 하나가 여러 자리를 읽는다. 홈은 일곱을 읽는데 그중 여섯은 지을 수 있고
// 하나(`home.financeSummary`)는 예산을 정해야 지을 수 있다 — 그 하나 때문에 화면이
// 통째로 닫히면, 지어 놓은 여섯을 아무도 못 본다.
//
// 그래서 경계를 두 겹으로 둔다.
//
// | | 무엇을 가리나 | 어디 |
// | --- | --- | --- |
// | `SourceGate` | 화면 하나 | `ScreenRouter` |
// | `Built` | 그 자리 하나 | 화면이 블록마다 두른다 |
//
// **바깥이 그물이다.** 자리마다 두르지 않은 화면은 지금처럼 통째로 준비 중이 된다 —
// 두르는 것을 잊어도 가짜가 새지는 않는다.
//
// 두를 자리는 화면이 안다. 이 저장소의 화면들은 이미 블록마다 따로 읽으므로
// (`BriefingCard`·`FinanceSummary`처럼 작은 컴포넌트로 갈려 있다) 그 부름을 감싸면 된다.

interface BuiltProps<T> {
  /**
   * 이 자리가 읽는 것(선택).
   *
   * **읽기를 경계 안으로 들이는 자리다.** 없이 쓰면 부모가 먼저 읽고, 그러면 부모가
   * 멈춰 화면이 통째로 회색 블록이 된다 — 자리마다 두른 뜻이 사라진다. 자리를
   * 쪼개려면 화면마다 컴포넌트를 갈라야 하는데, 여기 함수 하나를 받으면 **부르는
   * 자리 한 줄**로 끝난다.
   */
  read?: () => T
  children: ReactNode | ((value: T) => ReactNode)
  /** 무엇이 들어올 자리인지. 사람이 빈 자리를 보고 무엇이 빠졌는지 알게 한다. */
  what: string
  children_?: never
}

interface BuiltState {
  notBuilt: boolean
  /** 볼 수 없는 자리였을 때 서버가 준 말. **고장이 아니라 벽이다.** */
  forbidden: string | null
}

/**
 * 그 자리를 대신하는 표시.
 *
 * **데이터인 척하지 않는다.** 점선과 흐린 글로 두어 '값이 이렇다'가 아니라 '여기가
 * 아직 비어 있다'로 읽히게 한다 — 0원과 '예산을 아직 안 만들었다'는 다른 사실이다.
 */
function Placeholder({ what }: { what: string }) {
  return (
    <div
      role="status"
      className="flex flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-gray-300 bg-gray-50/60 px-4 py-8 text-center"
    >
      <p className="text-sm font-medium text-gray-500">{what}</p>
      <p className="text-xs text-gray-400">아직 준비 중입니다</p>
    </div>
  )
}

/**
 * 볼 수 없는 자리를 대신하는 표시.
 *
 * **고장이 아니라 벽이다.** 붉게 그리면 사람은 서버가 죽은 줄 알고 새로고침을
 * 되풀이한다. 무엇이라 말할지는 서버가 정한다 — 누가 볼 수 있는지는 권한 행렬이
 * 알고 그것은 서버에 있다.
 */
function Wall({ said }: { said: string }) {
  return (
    <div
      role="status"
      className="flex flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-gray-300 bg-gray-50/60 px-4 py-8 text-center"
    >
      <p className="text-sm text-gray-600">{said}</p>
    </div>
  )
}

/**
 * 읽기를 경계 **안에서** 한다.
 *
 * 부모가 읽으면 부모가 멈춘다. 여기까지 내려와야 이 자리만 기다린다.
 */
function Reads<T>({ read, children }: { read: () => T; children: (value: T) => ReactNode }) {
  return <>{children(read())}</>
}

export class Built<T = void> extends Component<BuiltProps<T>, BuiltState> {
  state: BuiltState = { notBuilt: false, forbidden: null }

  /**
   * **안 지은 것과 볼 수 없는 것만 여기서 멈춘다.** 나머지 오류는 그대로
   * 올려보낸다 — 화면의 진짜 고장을 '준비 중'으로 덮으면 그 고장을 아무도 못 본다.
   *
   * **볼 수 없는 자리를 여기서 받는 것이 이 자리의 값이다.** 올려보내면 바깥이
   * 화면을 통째로 대신 그리고, 그러면 못 볼 조각 하나 때문에 **볼 수 있는 나머지가
   * 함께 사라진다** — 평부원이 ORG-03C를 열면 조직도까지 없어지던 자리다.
   */
  static getDerivedStateFromError(error: Error): Partial<BuiltState> | null {
    if (error instanceof NotBuiltYet) return { notBuilt: true }
    if (error instanceof SourcesFailed && error.onlyForbidden) {
      return {
        forbidden:
          error.failures[0]?.message ?? '이 자리는 지금 신원으로 볼 수 없습니다',
      }
    }
    return null
  }

  /**
   * **기다리는 것도 이 자리에서 기다린다.**
   *
   * 한동안 기다림을 바깥으로 올려보냈다. 그러면 화면 하나가 통째로 멈추고, 읽는
   * 자리가 일곱인 홈은 문구가 일곱 줄로 쌓였다 — 배포된 것을 사람이 보고 물었다
   * (2026-09-06). 자리마다 두른 경계가 이미 있으니 기다림도 여기서 받는다:
   * 셸과 이미 온 자리는 그대로 있고, 안 온 자리에만 회색 블록이 뜬다.
   *
   * `loading.ts` 머리가 '자리마다 따로 기다리는 것이 결국 옳은 모양'이라 적어 둔
   * 그 모양이다.
   */
  render() {
    if (this.state.notBuilt) return <Placeholder what={this.props.what} />
    if (this.state.forbidden !== null) return <Wall said={this.state.forbidden} />
    const { read, children } = this.props
    return (
      <Suspense fallback={<Skeleton label={`${this.props.what}을(를) 불러오는 중입니다`} />}>
        {read === undefined ? (
          (children as ReactNode)
        ) : (
          <Reads read={read}>{children as (value: T) => ReactNode}</Reads>
        )}
      </Suspense>
    )
  }
}
