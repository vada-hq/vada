import { render } from '@testing-library/react'
import App from '@/App'
import { settle } from './settle'

// 로그인한 앱은 동의 상태를 읽을 때까지 학생회 화면을 보이지 않는다. 그 읽기가 끝난 뒤의 화면에서 시험을 시작한다.
export async function renderApp() {
  const view = render(<App />)
  await settle()
  return view
}
