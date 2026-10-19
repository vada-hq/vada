import { lazy, StrictMode, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import { isKakaoInAppBrowser, openOutsideKakao } from '@/lib/in-app-browser'
import { registerServiceWorker } from '@/lib/service-worker'
import { AUTH_DONE_PATH } from './auth/popup-login'
import './index.css'

const App = lazy(() => import('./App'))
const AuthDone = lazy(() => import('./auth/AuthDone'))
// 홈 화면 앱 안 창에서 로그인이 끝나면 오는 곳이다(휴대폰 길 spec).
const authDone = window.location.pathname === AUTH_DONE_PATH
// 카카오톡에서 연 링크는 구글 로그인이 막히므로 기본 브라우저로 넘긴다. 넘어가지 못해도 화면은 그린다.
if (!authDone && isKakaoInAppBrowser(navigator.userAgent))
  openOutsideKakao(navigator.userAgent, window.location)
// 휴대폰 알림을 받을 서비스 워커
if (!authDone) registerServiceWorker()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Suspense fallback={null}>
      {authDone ? (
        <AuthDone failed={new URLSearchParams(window.location.search).has('error')} />
      ) : (
        <App />
      )}
    </Suspense>
  </StrictMode>,
)
