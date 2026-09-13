import { Component, type ReactNode } from 'react'
import { ScreenCodeError } from './lazy-screen'

interface Props {
  screenId: string
  children: ReactNode
}

interface State {
  screenId: string
  error: Error | null
}

// 파일 로딩 실패만 처리한다. 화면의 렌더 오류는 기존 ErrorBoundary에 전달한다.
export class ScreenCodeBoundary extends Component<Props, State> {
  state: State = { screenId: this.props.screenId, error: null }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error }
  }

  static getDerivedStateFromProps(props: Props, state: State): Partial<State> | null {
    return props.screenId === state.screenId ? null : { screenId: props.screenId, error: null }
  }

  render() {
    if (this.state.error === null) return this.props.children
    if (!(this.state.error instanceof ScreenCodeError)) throw this.state.error
    return (
      <div className="flex min-h-dvh items-center justify-center bg-gray-50 px-6">
        <div role="alert" className="max-w-md space-y-3 text-sm text-gray-700">
          <h1 className="font-semibold">화면을 불러오지 못했습니다</h1>
          <p>연결 상태를 확인한 뒤 새로고침해 주세요.</p>
          <p>새로고침하면 저장하지 않은 입력 내용이 사라질 수 있습니다.</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="rounded border border-gray-300 px-4 py-2 hover:bg-gray-100"
          >
            새로고침
          </button>
        </div>
      </div>
    )
  }
}
