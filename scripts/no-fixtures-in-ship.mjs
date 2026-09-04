import { readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

// **실서비스로 나가는 번들에 개발용 응답의 글자가 하나도 없어야 한다.**
//
// 2026-09-05에 값을 치렀다. 방금 만든 빈 학생회의 홈에 '박해랑'과 '2026 소프트웨어
// 융합대학 체육대회'와 '예산 34%'가 그려졌다 — 전부 `fixtures.ts`에 손으로 적어 둔
// 값이고, 값을 읽는 화면 일흔넷 중 **마흔**이 그 상태였다.
//
// 읽는 자리는 고쳤고(`fromServer`가 던진다) 번들에서도 뺐다(`vite-fixtures-out.ts`).
// 그런데 **고쳤다는 말과 고쳐졌다는 사실은 다르다** — 누가 새 자리에서 다시 가져오면
// 조용히 되돌아온다. 그래서 나가는 것을 직접 열어 본다.
//
// 재는 것은 '그 파일을 안 가져왔는가'가 아니라 **'그 값이 거기 없는가'**다.
// 가져오는 길은 여럿이고 값은 하나다.

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const DIST = join(ROOT, 'apps', 'vada-web', 'dist')

// **앱의 build 스크립트에 이어 붙이지 않는다.**
//
// 처음에 `tsc -b && vite build && node …`로 이어 붙였는데, e2e가 그 build를
// `npm run build -- --outDir dist-e2e`로 부른다. npm은 `--` 뒤의 인자를 **체인 맨
// 끝**에 붙이므로 그것이 vite가 아니라 이 파일로 갔고, **e2e 빌드가 dist를 덮어썼다.**
// 개발용 응답을 문 묶음이 실서비스 자리에 놓인 것이다 — run-e2e.mjs의 주석이
// 경고하던 바로 그 사고를 검사를 붙이다가 냈다(2026-09-05).
//
// 그래서 이 검사는 **루트의 build**에만 붙는다. 앱의 build는 그대로 두어 인자가
// vite에 닿는다.

/**
 * 번들에 있으면 안 되는 글.
 *
 * **개발용 응답에만 있고 명세·화면에는 없는 것**을 고른다 — 명세에도 있는 말을 고르면
 * 이 검사가 영영 빨갛다. 처음에 '박해랑'과 '2026 체육대회'를 골랐다가 그것을 겪었다:
 * 그 둘은 data-sources.json의 예시('예: 박해랑')에도 있어서 개발용 응답을 다 빼고도
 * 번들에 남는다. **가짜가 실렸는지를 재려 했는데 명세가 실렸는지를 재고 있었다.**
 *
 * 여기 있는 다섯은 명세 전체와 화면 코드 어디에도 없는 글이다.
 */
const FORBIDDEN = [
  '2026 소프트웨어융합대학 학술제',
  '2026-체육대회-참석확인-QR.png',
  '기계시스템디자인공학과',
  '검토 의견이 아직 없습니다.',
  '2025. 12. 19 (금) 18:00–21:00',
]

function files(dir) {
  const found = []
  for (const name of readdirSync(dir)) {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) found.push(...files(path))
    else if (/\.(js|css|html)$/.test(name)) found.push(path)
  }
  return found
}

let dist
try {
  dist = files(DIST)
} catch {
  console.error(`나가는 번들이 없습니다: ${DIST}\n먼저 빌드하세요.`)
  process.exit(1)
}

// **잴 것이 있는지부터 본다.** 번들이 비어 있으면 이 검사는 늘 통과한다.
if (dist.length === 0) {
  console.error('번들에 파일이 없습니다. 빌드가 제대로 됐는지 보세요.')
  process.exit(1)
}

const leaked = []
for (const path of dist) {
  const text = readFileSync(path, 'utf8')
  for (const word of FORBIDDEN) {
    if (text.includes(word)) leaked.push(`${path.slice(ROOT.length + 1)} — ${word}`)
  }
}

if (leaked.length > 0) {
  console.error('**개발용 응답이 실서비스 번들에 실렸습니다.**\n')
  for (const one of leaked) console.error(`  ${one}`)
  console.error(
    '\n사람이 배포된 앱에서 남의 가짜 값을 보게 됩니다.\n' +
      '`apps/vada-web/vite-fixtures-out.ts`가 그 자리를 비우는지 확인하세요.',
  )
  process.exit(1)
}

console.log(`나가는 번들 ${dist.length}개 — 개발용 응답 없음`)
