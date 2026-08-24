import { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'

// 렌더 중 던져진 예외를 받아 화면에 보여준다.
//
// 이 저장소는 **조용한 대체를 하지 않는다**. 데이터 출처가 없으면, 명세에
// 등록되지 않은 노드를 찾으면, 자산 지목이 틀리면 — 전부 throw다. 그래야 명세의
// 구멍이 드러난다. 그런데 React는 렌더 중 예외가 나면 트리를 통째로 버리므로,
// 그 throw들이 화면에서는 **백지**로 나타났다. 드러내려고 던진 오류가 가장 안
// 드러나는 모양이 된 것이다.
//
// EVT-TASK-01에서 실제로 겪었다 — 칸반 카드가 업무 상세로 이어지면서, 상세가
// 그려지지 않은 업무를 누르면 백지가 됐다. 원인 자체는 고쳤지만(카탈로그의
// messages.empty로 답한다), 다음 throw도 똑같이 백지로 났을 것이다.
//
// 오류를 삼키지 않는다. 메시지를 그대로 보여주고, 무엇을 하다 났는지도 적는다.
interface ErrorBoundaryProps {
  /** 어느 화면을 그리다 났는지. 오류 화면에 함께 적는다. */
  screenId?: string
  children: ReactNode
}

interface ErrorBoundaryState {
  error: Error | null
  componentStack: string | null
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null, componentStack: null }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // 콘솔에도 남긴다 — e2e가 콘솔을 읽고, 사람은 스택이 필요할 때가 있다.
    console.error(`화면을 그리다 예외가 났습니다: ${error.message}`, error, info)
    this.setState({ componentStack: info.componentStack ?? null })
  }

  // 화면을 옮기면 다시 그려 본다. 오류가 그 화면의 것이었다면 여기서 풀린다.
  componentDidUpdate(previous: ErrorBoundaryProps) {
    if (this.state.error !== null && previous.screenId !== this.props.screenId) {
      this.setState({ error: null, componentStack: null })
    }
  }

  render() {
    const { error, componentStack } = this.state
    if (error === null) {
      return this.props.children
    }

    return (
      <div className="flex min-h-screen items-start justify-center bg-gray-50 px-4 py-12">
        <main
          role="alert"
          className="w-full max-w-2xl rounded-xl border border-red-200 bg-white p-8 shadow-sm"
        >
          <h1 className="text-lg font-semibold text-red-600">화면을 그리지 못했습니다</h1>
          <p className="pt-1 text-sm text-gray-500">
            {this.props.screenId === undefined
              ? '렌더 중 예외가 났습니다.'
              : `${this.props.screenId} 화면을 그리는 중에 예외가 났습니다.`}{' '}
            이 저장소는 명세의 구멍을 조용히 넘기지 않고 예외로 드러냅니다 — 아래가 그
            내용입니다.
          </p>
          <pre className="mt-4 overflow-x-auto rounded-lg border border-gray-200 bg-gray-50 p-4 text-xs whitespace-pre-wrap text-gray-800">
            {error.message}
          </pre>
          {componentStack === null ? null : (
            <details className="pt-3">
              <summary className="cursor-pointer text-xs font-medium text-gray-500">
                어디서 났는지 보기
              </summary>
              <pre className="mt-2 overflow-x-auto rounded-lg border border-gray-200 bg-gray-50 p-4 text-xs whitespace-pre-wrap text-gray-500">
                {componentStack.trim()}
              </pre>
            </details>
          )}
        </main>
      </div>
    )
  }
}
