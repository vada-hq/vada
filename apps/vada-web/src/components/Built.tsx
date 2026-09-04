import { Component, type ReactNode } from 'react'
import { NotBuiltYet } from '../data-sources/server'

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

interface BuiltProps {
  children: ReactNode
  /** 무엇이 들어올 자리인지. 사람이 빈 자리를 보고 무엇이 빠졌는지 알게 한다. */
  what: string
  children_?: never
}

interface BuiltState {
  notBuilt: boolean
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

export class Built extends Component<BuiltProps, BuiltState> {
  state: BuiltState = { notBuilt: false }

  /**
   * **안 지은 것만 여기서 멈춘다.** 나머지 오류는 그대로 올려보낸다 — 화면의 진짜
   * 고장을 '준비 중'으로 덮으면 그 고장을 아무도 못 본다.
   *
   * 받아 오는 중이라는 신호(약속)도 올려보낸다. 그것은 오류가 아니라 기다림이고,
   * 기다리는 자리는 바깥의 `Suspense`가 든다.
   */
  static getDerivedStateFromError(error: Error): BuiltState | null {
    return error instanceof NotBuiltYet ? { notBuilt: true } : null
  }

  render() {
    return this.state.notBuilt ? <Placeholder what={this.props.what} /> : this.props.children
  }
}
