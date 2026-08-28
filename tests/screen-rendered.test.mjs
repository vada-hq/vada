import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
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
const NOT_DRAWN_YET = new Set([
  'OPS-MEET-01B',
  'OPS-MEET-01D',
  'OPS-MEET-03B',
  'OPS-MEET-03C',
  'OPS-MEET-05B',
  'OPS-MEET-06B',
  'OPS-MEET-08',
])

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
    (id) => !wired.has(id) && !NOT_DRAWN_YET.has(id),
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

  console.log(
    `\n  명세 ${specced.length}개 / 그리는 화면 ${drawn.length}개 = ` +
      `${((drawn.length / specced.length) * 100).toFixed(1)}%  ` +
      `(아직 없는 것 ${NOT_DRAWN_YET.size}개는 전부 변형)\n`,
  )

  // 세는 것만으로는 잠기지 않는다. 잠그는 것은 위의 세 검사다.
  assert.equal(drawn.length + NOT_DRAWN_YET.size, specced.length)
})
