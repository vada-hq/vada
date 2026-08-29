import assert from 'node:assert/strict'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

// 명세를 아무도 읽지 않으면 그 명세는 없는 것과 같다.
//
// **이 눈금이 없는 동안 열 화면이 조용히 빠져 있었다.** 덮는 몫은 변형을 세지
// 않고(변형은 다른 부분만 등록하므로 셀 것이 없다), design 대조는 화면이 붙은
// 것만 돈다. 그래서 "명세는 있는데 그리는 화면이 없다"가 어느 검사에도 걸리지
// 않았다 — 검사가 초록인 채로 아무것도 안 보는 자리가 하나 더 있었다.
//
// 무엇을 '그린다'고 볼 것인가. **spec/screens.ts가 그 명세를 읽는 것**이다.
// 주소로 가는 화면은 라우터가 그 이름으로 가르고, 변형은 주소가 같아서 라우터가
// 가르지 않는다 — 보는 사람이 가른다. 그래서 라우터의 갈래를 세면 변형이 전부
// 빠지고, 명세를 읽는지를 세면 둘 다 잡힌다.

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..')
const SCREENS = join(repoRoot, 'specs', 'figma', 'vada-wireframe', 'screens')
const WIRING = join(repoRoot, 'apps', 'vada-web', 'src', 'spec', 'screens.ts')

// 아직 그리는 화면이 없는 명세. **전부 변형이다** — 같은 주소를 보는 사람이 다를
// 때의 그림이고, 바탕 화면이 그 갈래를 아직 갖지 않는다. 줄이 늘면 그때 봐야 한다.
//
// 늘어난 적이 있는지는 이 목록의 길이가 말한다. 줄이면 지우고, 늘려야 한다면
// 왜 늘리는지를 적는다.
const NOT_DRAWN_YET = new Set([])

// **등록한 요소가 없는 변형은 바탕이 이미 그린다.** 다른 것이 데이터뿐이라
// (줄마다의 딱지, 띠의 글) 화면이 읽을 것이 없다 — 명세가 그 사실을 요소 0개로
// 말한다. 여기에 요소가 하나라도 생기면 그리는 화면이 있어야 하고, 아래 검사가
// 그때 울린다.
function readsNothing(screenId) {
  const spec = JSON.parse(
    readFileSync(join(SCREENS, screenId, 'screen.json'), 'utf8'),
  )
  return spec.variantOf !== undefined && (spec.elements ?? []).length === 0
}

function speccedScreenIds() {
  const ids = []
  for (const entry of readdirSync(SCREENS, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    try {
      readFileSync(join(SCREENS, entry.name, 'screen.json'), 'utf8')
      ids.push(entry.name)
    } catch {
      continue // 아직 명세되지 않은 그림
    }
  }
  return ids
}

function wiredScreenIds() {
  const source = readFileSync(WIRING, 'utf8')
  return new Set(
    [...source.matchAll(/screens\/([A-Z0-9-]+)\/screen\.json/g)].map((match) => match[1]),
  )
}

test('명세된 화면은 그리는 화면이 있거나, 없다고 적혀 있다', () => {
  const wired = wiredScreenIds()
  const unlisted = speccedScreenIds().filter(
    (id) => !wired.has(id) && !NOT_DRAWN_YET.has(id) && !readsNothing(id),
  )

  assert.deepEqual(
    unlisted,
    [],
    '명세는 있는데 그리는 화면이 없습니다. 화면을 만들거나 NOT_DRAWN_YET에 까닭과 함께 적으세요.\n' +
      unlisted.map((id) => `  ${id}`).join('\n'),
  )
})

test('그리지 않기로 적어 둔 화면은 실제로 명세가 있다', () => {
  // 명세가 사라졌는데 목록에 남으면, 그 줄이 안 그린 화면 수를 부풀린다.
  const specced = new Set(speccedScreenIds())
  const stale = [...NOT_DRAWN_YET].filter((id) => !specced.has(id))

  assert.deepEqual(stale, [], `명세가 없는데 목록에 남았습니다: ${stale.join(', ')}`)
})

test('그리지 않기로 적어 둔 화면은 아직 그려지지 않는다', () => {
  // 만들고 나서 목록에서 지우지 않으면, 다음 사람이 "아직 안 만들었다"고 읽는다.
  const wired = wiredScreenIds()
  const done = [...NOT_DRAWN_YET].filter((id) => wired.has(id))

  assert.deepEqual(done, [], `이미 그리는 화면입니다. 목록에서 지우세요: ${done.join(', ')}`)
})

test('세어 둔다 — 명세 몇 개 중 몇 개가 그려지는가', () => {
  const specced = speccedScreenIds()
  const wired = wiredScreenIds()
  const drawn = specced.filter((id) => wired.has(id))
  const byBase = specced.filter((id) => !wired.has(id) && readsNothing(id))

  console.log(
    `\n  명세 ${specced.length}개 / 그려지는 것 ${drawn.length + byBase.length}개 = ` +
      `${(((drawn.length + byBase.length) / specced.length) * 100).toFixed(1)}%` +
      `  (읽는 화면 ${drawn.length} · 바탕이 그리는 변형 ${byBase.length} · ` +
      `아직 없는 것 ${NOT_DRAWN_YET.size})\n`,
  )

  // 세는 것만으로는 잠기지 않는다. 잠그는 것은 위의 세 검사다.
  assert.equal(drawn.length + byBase.length + NOT_DRAWN_YET.size, specced.length)
})

// "아직 명세되지 않았습니다"가 **거짓이 되는 날**이 온다.
//
// pending의 note는 그때의 사실을 적은 글이고, 그 화면이 나중에 만들어져도 아무도
// 돌아가 잇지 않는다. 2026-08-29에 훑어 보니 일곱 자리가 그랬다 — EVT-00A2가
// 이름까지 적어 둔 EVT-00B, ORG-03A의 구성원 초대(ORG-03C), EVT-03B의 기본정보
// 수정(EVT-02B), EVT-02의 설문·참가자·일정, ORG-00의 부서 & 구성원.
//
// **화면 이름을 적은 것만은 기계가 볼 수 있다.** 문구로 짐작하는 것은 흔들리지만
// 'EVT-00B' 같은 이름은 흔들리지 않는다. 그것만 본다 — 보는 것이 좁아도 조용한
// 거짓말 하나는 확실히 막는다.
test('pending이 이름 댄 화면이 이미 있으면 안 된다', () => {
  const specced = new Set(
    readdirSync(SCREENS, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .filter((entry) => existsSync(join(SCREENS, entry.name, 'screen.json')))
      .map((entry) => entry.name),
  )

  const lies = []
  for (const screenId of specced) {
    const spec = JSON.parse(readFileSync(join(SCREENS, screenId, 'screen.json'), 'utf8'))
    const walk = (node) => {
      if (Array.isArray(node)) {
        for (const item of node) walk(item)
        return
      }
      if (node === null || typeof node !== 'object') return
      if (node.type === 'pending' && typeof node.note === 'string') {
        for (const match of node.note.matchAll(
          /(?<![A-Z0-9-])([A-Z]{2,4}(?:-[A-Z0-9]{1,6}){1,3})(?![A-Z0-9-])/g,
        )) {
          const named = match[0]
          if (named === screenId || !specced.has(named)) continue
          // **이름이 나온 것만으로는 모자란다.** 그 이름 곁에서 '없다'고 말해야
          // 거짓말이다 — 있다고 적으면서 이름을 대는 글도 있다(OPS-MEET-04B가
          // '주는 쪽은 D03이 있는데'라고 적는다).
          const after = node.note.slice(match.index + named.length, match.index + named.length + 25)
          if (!/명세되지 않았|아직 없|아직 만들/.test(after)) continue
          lies.push(`  ${screenId}: '${named}이 없다'는데 그 화면은 이미 있습니다.`)
        }
      }
      for (const value of Object.values(node)) walk(value)
    }
    walk(spec)
  }

  assert.equal(
    lies.length,
    0,
    '명세가 없다고 말한 화면이 이미 있습니다. 이으세요.\n' + lies.join('\n'),
  )
})
