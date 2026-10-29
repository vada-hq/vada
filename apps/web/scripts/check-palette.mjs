// 화면 코드가 Tailwind 팔레트 단계(text-gray-700, bg-red-50 등)를 직접 쓰면 실패한다(AGENTS.md '화면').
// 색은 src/index.css의 의미 이름(fg, surface-subtle, danger 등)만 쓴다. 새 색이 필요하면 index.css에 의미 이름을 먼저 더한다.
// 사용: node scripts/check-palette.mjs (pnpm palette, pnpm check에 들어 있다)
import { readdirSync, readFileSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../src', import.meta.url))
const HUE =
  'slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose'
const STEP = '(?:50|[1-9]00|950)'
const rules = [
  // 색 유틸리티 + 팔레트 단계: text-gray-700, hover:bg-red-50, border-l-blue-300/50
  [new RegExp(`(?<![\\w-])[\\w-]+-(?:${HUE})-${STEP}(?![\\w-])`, 'g'), '팔레트 단계 클래스'],
  // 팔레트 변수 직접 쓰기: var(--color-gray-500), [color:var(--color-red-600)]
  [new RegExp(`--color-(?:${HUE})-${STEP}\\b`, 'g'), '팔레트 변수'],
  // 이름을 조립해 검사를 비켜 가기: `bg-${hue}-50`, `text-gray-${step}`
  [new RegExp(`(?:${HUE})-\\$\\{|\\$\\{[^}]*\\}-${STEP}(?![\\w-])`, 'g'), '조립한 팔레트 클래스'],
]

function* sources(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) yield* sources(path)
    else if (/\.(ts|tsx)$/.test(entry.name)) yield path
  }
}

const found = []
const check = (path, text) => {
  text.split('\n').forEach((line, index) => {
    for (const [pattern, label] of rules)
      for (const match of line.matchAll(pattern))
        found.push(`${relative(root, path).split(sep).join('/')}:${index + 1} ${label} ${match[0]}`)
  })
}
for (const path of sources(root)) check(path, readFileSync(path, 'utf8'))
// index.css에서는 의미 이름의 정의(--color-이름: var(--color-gray-900))만 팔레트를 가리킨다. @apply는 의미 이름만 쓴다.
const css = join(root, 'index.css')
check(
  css,
  readFileSync(css, 'utf8')
    .split('\n')
    .map(line => (line.includes('@apply') ? line : ''))
    .join('\n'),
)

if (found.length > 0) {
  console.error(found.join('\n'))
  console.error(
    `\n팔레트 단계 ${found.length}곳. src/index.css의 의미 이름(text-fg-muted, bg-surface-subtle 등)으로 바꾼다. 없는 색이면 index.css에 의미 이름을 먼저 더한다(AGENTS.md '화면').`,
  )
  process.exit(1)
}
