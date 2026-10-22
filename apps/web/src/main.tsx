import { lazy, StrictMode, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import { isKakaoInAppBrowser, openOutsideKakao } from '@/lib/in-app-browser'
import { registerServiceWorker } from '@/lib/service-worker'
import { AUTH_DONE_PATH } from './auth/popup-login'
import { publicRouteOf } from './public/public-path'
import './index.css'

const App = lazy(() => import('./App'))
const AuthDone = lazy(() => import('./auth/AuthDone'))
const PublicApp = lazy(() => import('./public/PublicApp'))
// 홈 화면 앱 안 창에서 로그인이 끝나면 오는 곳이다(휴대폰 길 spec).
const authDone = window.location.pathname === AUTH_DONE_PATH
// 참가 신청(/apply/코드)과 내 신청(/r#토큰)은 학생이 카카오톡에서 여는 로그인 없는 화면이다. 로그인과 바깥 브라우저 넘기기를 거치지 않는다.
const publicRoute = publicRouteOf(window.location.pathname)
const plain = authDone || publicRoute !== null
// 카카오톡에서 연 링크는 구글 로그인이 막히므로 기본 브라우저로 넘긴다. 넘어가지 못해도 화면은 그린다.
if (!plain && isKakaoInAppBrowser(navigator.userAgent))
  openOutsideKakao(navigator.userAgent, window.location)
// 휴대폰 알림을 받을 서비스 워커
if (!plain) registerServiceWorker()

function Root() {
  if (publicRoute) return <PublicApp route={publicRoute} />
  if (authDone)
    return <AuthDone failed={new URLSearchParams(window.location.search).has('error')} />
  return <App />
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Suspense fallback={null}>
      <Root />
    </Suspense>
  </StrictMode>,
)
