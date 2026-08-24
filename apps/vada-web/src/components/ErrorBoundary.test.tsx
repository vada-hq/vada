import { render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ErrorBoundary } from './ErrorBoundary'

// 이 저장소는 명세의 구멍을 조용히 넘기지 않고 던진다. 받는 자리가 없으면 그
// 던짐이 백지가 되어 **가장 안 보이는 모양**이 된다 — EVT-TASK-01에서 실제로 그랬다.

function Throws({ message }: { message: string }): never {
  throw new Error(message)
}

describe('ErrorBoundary', () => {
  beforeEach(() => {
    // React가 잡힌 예외를 콘솔로도 알린다. 검사 출력에서 진짜 실패와 섞이지 않게 막는다.
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('예외가 없으면 아무것도 하지 않는다', () => {
    render(
      <ErrorBoundary screenId="EVT-TASK-01">
        <p>화면</p>
      </ErrorBoundary>,
    )
    expect(screen.getByText('화면')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('던져진 메시지를 삼키지 않고 그대로 보여준다', () => {
    render(
      <ErrorBoundary screenId="EVT-TASK-01">
        <Throws message="데이터 출처 'event.taskBoard'가 카탈로그에 없습니다." />
      </ErrorBoundary>,
    )

    const alert = screen.getByRole('alert')
    // 무엇이 났는지 — 원문 그대로. 요약하면 고칠 자리를 잃는다.
    expect(alert).toHaveTextContent("데이터 출처 'event.taskBoard'가 카탈로그에 없습니다.")
    // 어디서 났는지 — 화면 이름.
    expect(alert).toHaveTextContent('EVT-TASK-01')
  })

  it('화면을 옮기면 다시 그려 본다', () => {
    const { rerender } = render(
      <ErrorBoundary screenId="EVT-TASK-01">
        <Throws message="터졌다" />
      </ErrorBoundary>,
    )
    expect(screen.getByRole('alert')).toBeInTheDocument()

    rerender(
      <ErrorBoundary screenId="EVT-TASK-02">
        <p>다른 화면</p>
      </ErrorBoundary>,
    )
    // 오류가 그 화면의 것이었다면 여기서 풀린다. 안 풀리면 한 번 터진 앱이
    // 새로고침 전까지 아무 화면도 못 연다.
    expect(screen.getByText('다른 화면')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).toBeNull()
  })
})
