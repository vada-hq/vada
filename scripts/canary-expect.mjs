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
// **서버가 짓는 말도 증거가 못 된다.**
//
// '일시 미정'·'장소 미정'·'검토 의견이 아직 없습니다.'는 서버가 지어서 보내는 글인데
// 개발용 응답에도 같은 글자가 들어 있다. 그러면 서버에서 진짜로 온 말을 '가짜가
// 샜다'로 읽는다 — 넓힌 카나리가 곧바로 셋을 그렇게 짚었다(2026-09-05).
//
// 세어서 만든 글을 뺀 것과 같은 규칙이다: **양쪽이 다 낼 수 있는 말은 어느 쪽에서
// 왔는지 못 가른다.**
const API = join(ROOT, 'apps', 'api', 'src')
const elsewhere =
  textOf(WIREFRAME, (name) => name.endsWith('.json')) +
  textOf(WEB, (name) => /\.(ts|tsx)$/.test(name) && !name.includes('fixtures') && !name.includes('.test.')) +
  textOf(API, (name) => /\.ts$/.test(name) && !name.includes('.test.'))

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
  // **이어 붙인 말도 증거가 못 된다.** 화면이 '일시 미정'과 '장소 미정'을 가운뎃점으로
  // 잇는데, 개발용 응답에는 그 이은 꼴이 통째로 한 줄로 들어 있다. 조각이 저마다
  // 다른 데 있으면 어느 쪽에서 왔는지 못 가른다 — 세어서 만든 글과 같은 사정이다.
  const parts = word.split(' · ')
  if (parts.length > 1 && parts.every((part) => elsewhere.includes(part))) continue
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

// **화면을 열려면 무엇을 줘야 하는가.**
//
// 카나리가 걸을 화면을 손으로 고르던 동안 아홉 장뿐이었고, 그것은 이 파일이 이미
// 한 번 겪은 잘못이다 — 고르는 사람이 안 보는 것은 목록에도 없다. 이제 다 지어진
// 화면을 전부 걷되, 열쇠가 필요한 화면은 그 열쇠 이름을 함께 낸다. 카나리가 심어
// 둔 것으로 채울 수 있으면 걷고, 못 채우면 왜 못 걷는지 그쪽에 적힌다.
const paramsOf = new Map()
for (const file of ['data-sources.json', 'option-sources.json']) {
  for (const one of JSON.parse(readFileSync(join(WIREFRAME, file), 'utf8')).sources) {
    paramsOf.set(
      one.key,
      (one.params ?? []).filter((param) => param.required === true).map((param) => param.key),
    )
  }
}
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
  const needs = new Set()
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
        for (const name of paramsOf.get(key) ?? []) needs.add(name)
      }
      walk(value)
    }
  }
  walk(screen)
  if (reads === 0) continue
  // **셸이 있는 화면인가.** 화면을 감싼 것(왼쪽 메뉴·학생회 이름)은 모든 화면에
  // 있지 않다 — 창으로 뜨는 화면과 전체를 차지하는 폼은 셸을 안 두른다. 카나리가
  // '나갈 길이 있는가'를 재려면 **누가 셸을 두르는지**를 알아야 하는데, 그것을 정한
  // 것은 명세가 아니라 화면 코드다(명세의 activeNavigationScreenId는 창에도 붙는다).
  const code = join(WEB, 'screens', `${id.replaceAll('-', '')}Screen.tsx`)
  screens[id] = {
    ready: missing.size === 0,
    missing: [...missing].sort(),
    needs: [...needs].sort(),
    shell: existsSync(code) && readFileSync(code, 'utf8').includes('<AppShell'),
    // 창으로 뜨는 화면은 뒤에 다른 화면을 그대로 그린다. 명세가 그것을 든다.
    over: screen.overlay?.screenId ?? null,
  }
}

// **창은 뒤엣것을 업고 뜬다.**
//
// 창으로 뜨는 화면은 뒤에 다른 화면을 통째로 그린다(`overlay.screenId`). 그래서
// 제 자리를 다 지어도 뒤엣것이 덜 지어졌으면 **사람이 보는 것은 준비 중이다** —
// EVT-02B·02C·02E가 그랬고, 넓힌 카나리가 셋을 한꺼번에 짚었다(2026-09-05).
//
// 뒤엣것이 또 창일 수 있어 끝까지 따라간다.
for (const [id, one] of Object.entries(screens)) {
  const seen = new Set([id])
  let at = one.over
  while (at !== null && screens[at] !== undefined && !seen.has(at)) {
    seen.add(at)
    for (const key of screens[at].missing) if (!one.missing.includes(key)) one.missing.push(key)
    for (const name of screens[at].needs) if (!one.needs.includes(name)) one.needs.push(name)
    // 셸도 뒤엣것의 것이다 — 창 자신은 두르지 않는다.
    one.shell = one.shell || screens[at].shell
    at = screens[at].over
  }
  one.missing.sort()
  one.needs.sort()
  one.ready = one.missing.length === 0
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
