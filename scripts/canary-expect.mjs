import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

// 카나리가 무엇을 기대해야 하는지를 **훑어서 만든다.**
//
// 손으로 고르면 고르는 사람이 안 보는 것을 목록도 안 본다. 그것을 한 번 겪었다:
// 금지어 다섯을 손으로 골라 두고 어제 상태를 되돌려 반증했더니 **홈이 통과했다** —
// 홈에 나오는 가짜 값이 그 다섯에 없었기 때문이다(2026-09-05).
//
// 두 가지를 낸다.
//
// 1. **개발용 응답에만 있는 글** — 새면 화면에 그 글자가 뜬다. 다만 그림이 그린
//    값은 명세의 예시에도 있어서 이것만으로는 다 못 잡는다.
// 2. **화면마다 다 지어졌는가** — 안 지은 자리를 하나라도 읽는 화면은 반드시
//    '아직 준비 중'이 보여야 한다. **어제 홈이 그러지 않고 가짜를 그렸다.**
//    이쪽이 그 결함을 정확히 짚는 자리다.

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const WEB = join(ROOT, 'apps', 'vada-web', 'src')
const WIREFRAME = join(ROOT, 'specs', 'figma', 'vada-wireframe')
const OUT = join(ROOT, 'apps', 'vada-web', 'e2e-ship', 'canary-expect.json')

function textOf(dir, keep) {
  let text = ''
  for (const name of readdirSync(dir)) {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) text += textOf(path, keep)
    else if (keep(name)) text += readFileSync(path, 'utf8')
  }
  return text
}

// ── 1. 개발용 응답에만 있는 글
const fixtures =
  readFileSync(join(WEB, 'data-sources', 'fixtures.ts'), 'utf8') +
  readFileSync(join(WEB, 'option-sources', 'fixtures.ts'), 'utf8')
const elsewhere =
  textOf(WIREFRAME, (name) => name.endsWith('.json')) +
  textOf(WEB, (name) => /\.(ts|tsx)$/.test(name) && !name.includes('fixtures') && !name.includes('.test.'))

const words = new Set()
for (const found of fixtures.matchAll(/'([^'\n]{6,40})'/g)) {
  const word = found[1]
  if (!/[가-힣]/.test(word)) continue
  if (/[{}`<>]|\/\//.test(word)) continue
  if (elsewhere.includes(word)) continue
  // **세어서 만든 글은 증거가 못 된다.** 화면이 `등록 자료 ${n}개`로 짓는 말은
  // 개발용 응답에도 같은 글자로 들어 있어서, 서버가 진짜로 0을 세어 그린 것을
  // '가짜가 샜다'로 읽는다 — 실제로 그랬다(OPS-MEET-03A, 2026-09-05).
  if (/\d\s*(개|건|명|원|장|회|번|분|시간|%)/.test(word)) continue
  words.add(word)
}

// ── 2. 화면마다 다 지어졌는가
let served = readFileSync(join(WEB, 'data-sources', 'served.ts'), 'utf8')
for (const name of readdirSync(join(WEB, 'data-sources', 'served'))) {
  served += readFileSync(join(WEB, 'data-sources', 'served', name), 'utf8')
}
const isServed = (key) => served.includes(`'${key}'`)

const optionType = new Map(
  JSON.parse(readFileSync(join(WIREFRAME, 'option-sources.json'), 'utf8')).sources.map((one) => [
    one.key,
    one.type,
  ]),
)
const READ = new Set([
  'dataSourceKey',
  'optionsSource',
  'candidatesSource',
  'copySourceKey',
  'downloadSourceKey',
  'poolSourceKey',
])

const screens = {}
const dir = join(WIREFRAME, 'screens')
for (const folder of readdirSync(dir)) {
  const path = join(dir, folder, 'screen.json')
  if (!existsSync(path)) continue
  const screen = JSON.parse(readFileSync(path, 'utf8'))
  const id = screen.screenId ?? folder
  let reads = 0
  const missing = new Set()
  const walk = (node) => {
    if (node === null || typeof node !== 'object') return
    if (Array.isArray(node)) {
      for (const one of node) walk(one)
      return
    }
    for (const [name, value] of Object.entries(node)) {
      const key =
        typeof value === 'string'
          ? value
          : value !== null && typeof value === 'object' && typeof value.key === 'string'
            ? value.key
            : null
      if (READ.has(name) && key !== null && optionType.get(key) !== 'static') {
        reads += 1
        if (!isServed(key)) missing.add(key)
      }
      walk(value)
    }
  }
  walk(screen)
  if (reads === 0) continue
  screens[id] = { ready: missing.size === 0, missing: [...missing].sort() }
}

const ready = Object.values(screens).filter((one) => one.ready).length
const list = [...words].sort()
if (list.length < 30 || Object.keys(screens).length < 50) {
  console.error('훑은 것이 너무 적습니다. 규칙을 보세요.')
  process.exit(1)
}

writeFileSync(OUT, `${JSON.stringify({ words: list, screens }, null, 2)}\n`, 'utf8')
console.log(
  `카나리 기대값: 개발용 응답에만 있는 글 ${list.length}개 · ` +
    `화면 ${Object.keys(screens).length}장 중 다 지어진 것 ${ready}장`,
)
