import './themes.css'

// 회장단 홈 시안 미리보기의 테마(시각 언어) 바꿔 끼우기: ?theme=base|a|b|c (없거나 모르면 base).
// 값은 themes.css 1절, 웹폰트는 아래 THEME_FONT. 쓰는 법은 notes/visual-language/theme-frame.md.
const THEMES = ['base', 'a', 'b', 'c'] as const
export type ThemeName = (typeof THEMES)[number]

// 미리보기에서만 CDN으로 부르는 한국어 웹폰트 CSS. 앱에는 Pretendard(npm 패키지)만 있다.
// 각 CSS가 정하는 글꼴 이름(themes.css --font-sans 맨 앞에 쓴다): SUIT 'SUIT Variable',
// Wanted Sans 'Wanted Sans Variable', Spoqa 'Spoqa Han Sans Neo', IBM Plex 'IBM Plex Sans KR'.
const FONT_CSS = {
  suit: 'https://cdn.jsdelivr.net/gh/sun-typeface/SUIT@2/fonts/variable/woff2/SUIT-Variable.css',
  wanted:
    'https://cdn.jsdelivr.net/gh/wanteddev/wanted-sans@v1.0.3/packages/wanted-sans/fonts/webfonts/variable/split/WantedSansVariable.min.css',
  spoqa: 'https://spoqa.github.io/spoqa-han-sans/css/SpoqaHanSansNeo.css',
  plexKr:
    'https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+KR:wght@400;500;600;700&display=swap',
} as const

// 테마마다 불러올 웹폰트(null = Pretendard, 이미 있음). 갈래 값을 채울 때 FONT_CSS의 이름 하나를 적는다(예: a: 'suit').
const THEME_FONT: Record<ThemeName, keyof typeof FONT_CSS | null> = {
  base: null,
  a: null,
  b: null,
  c: null,
}

export function themeOf(value: string | null): ThemeName {
  return THEMES.find(name => name === value) ?? 'base'
}

// <html>에 테마를 건다(body와 옆 창 포털까지 같은 테마). 웹폰트가 있으면 <link>를 더하고,
// 다 받으면 html[data-theme-font=ready]를 둬 찍기 도구가 기다릴 수 있게 한다.
export function applyTheme(theme: ThemeName) {
  const root = document.documentElement
  root.dataset.theme = theme
  const font = THEME_FONT[theme]
  if (!font) {
    root.dataset.themeFont = 'ready'
    return
  }
  const link = document.createElement('link')
  link.rel = 'stylesheet'
  link.href = FONT_CSS[font]
  // 글꼴 파일은 글자가 그 글꼴로 그려질 때 받기 시작해, 한 프레임 뒤(배치가 새 @font-face를 쓴 뒤)의 fonts.ready를 기다린다.
  link.onload = () =>
    requestAnimationFrame(() => {
      void document.fonts.ready.then(() => (root.dataset.themeFont = 'ready'))
    })
  link.onerror = () => (root.dataset.themeFont = 'failed')
  document.head.append(link)
}
