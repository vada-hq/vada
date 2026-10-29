// 화면 코드가 Tailwind 팔레트 단계(text-gray-700, bg-red-50 등)나 임의 색 값을 직접 쓰면 실패한다(AGENTS.md '화면').
// 색은 src/index.css의 의미 이름(fg, surface-subtle, danger 등)만 쓴다. 새 색이 필요하면 index.css에 의미 이름을 먼저 더한다.
// 색 이름을 변수 둘로 조립한 클래스(`${a}-${b}`)는 Tailwind가 CSS를 만들지 않아 화면에 칠해지지 않으므로 따로 보지 않는다.
// 사용: node scripts/check-palette.mjs (pnpm palette, pnpm check와 CI check 작업에 들어 있다)
import { readdirSync, readFileSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const web = fileURLToPath(new URL('..', import.meta.url))
const src = join(web, 'src')
const HUE =
  'slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose'
const STEP = '(?:50|[1-9]00|950)'
const COLOR_UTILITY =
  'text|bg|border(?:-[trblxyse])?|divide|ring(?:-offset)?|outline|accent|fill|stroke|decoration|caret|from|via|to|shadow|inset-shadow|placeholder'
const rules = [
  // 색 유틸리티 + 팔레트 단계: text-gray-700, hover:bg-red-50, border-l-blue-300/50
  [new RegExp(`(?<![\\w-])[\\w-]+-(?:${HUE})-${STEP}(?![\\w-])`, 'g'), '팔레트 단계 클래스'],
  // 팔레트 변수 직접 쓰기: var(--color-gray-500)
  [new RegExp(`--color-(?:${HUE})-${STEP}\\b`, 'g'), '팔레트 변수'],
  // 이름 한쪽만 조립하기: `bg-${hue}-50`, `text-gray-${step}`
  [new RegExp(`(?:${HUE})-\\$\\{|\\$\\{[^}]*\\}-${STEP}(?![\\w-])`, 'g'), '조립한 팔레트 클래스'],
  // 임의 색 값: bg-[#fff], text-[rgb(0_0_0)], [color:#f00], border-[var(--x)]
  [
    new RegExp(
      `(?:${COLOR_UTILITY})-\\[(?:#|rgb|hsl|oklch|oklab|lab|lch|hwb|color|var)|\\[(?:color|background(?:-color)?|border(?:-[a-z]+)?-color|outline-color|fill|stroke|accent-color|caret-color|text-decoration-color):`,
      'g',
    ),
    '임의 색 값',
  ],
]

function* files(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) yield* files(path)
    else if (/\.(ts|tsx|js|jsx|mjs|css|html)$/.test(entry.name)) yield path
  }
}

// index.css에서 의미 이름의 정의(--color-이름: var(--color-gray-900);)만 팔레트를 가리킬 수 있다.
const DEFINITION = new RegExp(`^\\s*--color-[\\w-]+:\\s*var\\(--color-(?:${HUE})-${STEP}\\);\\s*$`)

const found = []
const check = (path, text) => {
  const name = relative(web, path).split(sep).join('/')
  text.split('\n').forEach((line, index) => {
    if (path.endsWith('.css') && DEFINITION.test(line)) return
    for (const [pattern, label] of rules)
      for (const match of line.matchAll(pattern))
        found.push(`${name}:${index + 1} ${label} ${match[0]}`)
  })
}
for (const path of files(src)) check(path, readFileSync(path, 'utf8'))
for (const page of readdirSync(web).filter(entry => entry.endsWith('.html')))
  check(join(web, page), readFileSync(join(web, page), 'utf8'))

if (found.length > 0) {
  console.error(found.join('\n'))
  console.error(
    `\n팔레트 단계·임의 색 ${found.length}곳. src/index.css의 의미 이름(text-fg-muted, bg-surface-subtle 등)으로 바꾼다. 없는 색이면 index.css에 의미 이름을 먼저 더한다(AGENTS.md '화면').`,
  )
  process.exit(1)
}
