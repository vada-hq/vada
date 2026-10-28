import { useEffect } from 'react'

// iOS Safari는 화면 키보드가 올라와도 레이아웃 뷰포트를 줄이지 않고 비주얼 뷰포트만 줄인다(interactive-widget 미지원).
// 그래서 아래에 붙은 시트와 바닥 고정 버튼 줄이 키보드 뒤에 숨는다. 보이는 영역의 높이와 키보드가 가린 높이를
// 문서 맨 위 CSS 변수로 두고, 시트(index.css의 sheet-above-keyboard)가 이것으로 키보드 위에 선다.
// https://developer.chrome.com/blog/viewport-resize-behavior
const INSET = '--keyboard-inset'
const HEIGHT = '--visual-viewport-height'
let users = 0

function update() {
  const viewport = window.visualViewport
  if (!viewport) return
  const layout = document.documentElement.clientHeight
  const inset = Math.max(0, layout - viewport.offsetTop - viewport.height)
  const style = document.documentElement.style
  style.setProperty(INSET, `${Math.round(inset)}px`)
  style.setProperty(HEIGHT, `${Math.round(viewport.height)}px`)
}

// 창 안 창이 겹쳐 열려도 마지막 창이 닫힐 때만 지운다.
export function useKeyboardInset() {
  useEffect(() => {
    const viewport = window.visualViewport
    if (!viewport) return
    users += 1
    update()
    viewport.addEventListener('resize', update)
    viewport.addEventListener('scroll', update)
    return () => {
      viewport.removeEventListener('resize', update)
      viewport.removeEventListener('scroll', update)
      users -= 1
      if (users > 0) return
      document.documentElement.style.removeProperty(INSET)
      document.documentElement.style.removeProperty(HEIGHT)
    }
  }, [])
}
