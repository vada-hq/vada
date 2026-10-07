import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import Gallery from './Gallery'
import '../index.css'

// 개발 서버에서만 /ui.html로 열린다. 운영 빌드는 index.html만 묶는다.
createRoot(document.getElementById('root')!).render(<StrictMode><Gallery /></StrictMode>)
