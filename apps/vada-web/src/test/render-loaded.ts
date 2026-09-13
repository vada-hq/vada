import type { ReactElement } from 'react'
import { render, waitFor } from '@testing-library/react'

// 실제 라우터와 지연 로딩을 거친다. 디자인·내용 검사는 전체 화면 로딩이 끝난 뒤 시작한다.
export async function renderLoaded(ui: ReactElement) {
  const result = render(ui)
  await waitFor(() => {
    if (result.container.querySelector('[role="status"][aria-busy="true"]') !== null) {
      throw new Error('화면이 아직 준비 중입니다.')
    }
  }, { timeout: 20_000 })
  return result
}
