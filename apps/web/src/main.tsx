import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { openOutsideKakao } from './shared/in-app-browser'

// 카카오톡에서 연 링크는 구글 로그인이 막히므로 기본 브라우저로 넘긴다. 넘어가지 못해도 화면은 그린다.
openOutsideKakao(navigator.userAgent, window.location)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
