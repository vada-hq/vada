import { lazy, StrictMode, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import { openOutsideKakao } from '@/lib/in-app-browser'
import { registerServiceWorker } from '@/lib/service-worker'
import { publicRoute, shouldLeaveKakao } from './public/public-route'
import './index.css'

// 공개 신청 화면은 로그인 코드 없이 따로 불러온다.
const App = lazy(() => import('./App'))
const PublicApp = lazy(() => import('./public/PublicApp'))
const route = publicRoute(window.location.pathname)
// 카카오톡에서 연 앱 링크는 구글 로그인이 막히므로 기본 브라우저로 넘긴다. 넘어가지 못해도 화면은 그린다.
if (shouldLeaveKakao(route, navigator.userAgent)) openOutsideKakao(navigator.userAgent, window.location)
// 휴대폰 알림을 받을 서비스 워커. 로그인이 없는 공개 화면(참가 신청)에서는 등록하지 않는다.
if (route === null) registerServiceWorker()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Suspense fallback={null}>{route ? <PublicApp route={route} /> : <App />}</Suspense>
  </StrictMode>,
)
