import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { startServing } from './data-sources/server'

// **화면을 그리기 전에 서버에 붙인다.**
//
// 이 한 줄이 오랫동안 없었다. 서버를 짓고 배포하고 로그인까지 되는데도 화면이
// 그리는 값은 전부 개발용 응답이었다 — `useServer`를 부르는 곳이 검사뿐이어서다.
// 화면이 멀쩡히 그려지니 아무도 몰랐고, 그래서 이 줄이 사라지면 검사가 붉어진다
// (`serving.test.ts`).
startServing()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
