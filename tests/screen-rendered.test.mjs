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
// 무엇을 '그린다'고 볼 것인가. **명세가 요소를 갖는 것**이다.
//
// 오랫동안 'spec/screens.ts가 그 명세를 읽는가'로 셌다. 그때는 그 파일이 화면을 손으로
// 여든 줄 적고 있어서 읽는 것이 곧 그리는 것이었다. 이제 그 파일은 폴더를 걸어 **전부**
// 읽으므로 그 신호가 죽었다 — 읽는다는 사실이 아무것도 가르지 않는다.
//
// 대신 명세 자신이 답한다. **요소를 가지면 그릴 것이 있고, 없으면 바탕이 데이터로 그린다**
// (목록이 비었을 때, 다른 사람이 볼 때). 이 규칙은 옛 여든 줄을 한 줄도 틀리지 않고 다시
// 만들어 냈다.
//
// **그 화면을 실제로 그리는 코드가 있는지는 여기서 세지 않는다.** 준수 검사가 화면 여든을
// 전부 라우터로 그려 보므로(`spec/conformance.test.tsx`), 컴포넌트가 없으면 거기서
// 붉어진다 — 글자를 훑는 것보다 그쪽이 참말이다.

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..')
const SCREENS = join(repoRoot, 'specs', 'figma', 'vada-wireframe', 'screens')

// 아직 그리는 화면이 없는 명세. **비어 있어야 한다** — 요소를 가진 화면은 준수 검사가
// 라우터로 그려 보므로, 여기 무언가 적힌다는 것은 그 검사에서 빼 두었다는 뜻이다.
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

/** 그릴 것을 가진 화면. 준수 검사가 이것들을 라우터로 그려 본다. */
function drawableScreenIds() {
  return new Set(
    speccedScreenIds().filter((id) => {
      const spec = JSON.parse(readFileSync(join(SCREENS, id, 'screen.json'), 'utf8'))
      return (spec.elements ?? []).length > 0
    }),
  )
}

test('명세된 화면은 그릴 것을 갖거나, 바탕이 그리거나, 없다고 적혀 있다', () => {
  const drawable = drawableScreenIds()
  const unlisted = speccedScreenIds().filter(
    (id) => !drawable.has(id) && !NOT_DRAWN_YET.has(id) && !readsNothing(id),
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
  const drawable = drawableScreenIds()
  const done = [...NOT_DRAWN_YET].filter((id) => drawable.has(id))

  assert.deepEqual(done, [], `이미 그리는 화면입니다. 목록에서 지우세요: ${done.join(', ')}`)
})

test('세어 둔다 — 명세 몇 개 중 몇 개가 그려지는가', () => {
  const specced = speccedScreenIds()
  const drawable = drawableScreenIds()
  const drawn = specced.filter((id) => drawable.has(id))
  const byBase = specced.filter((id) => !drawable.has(id) && readsNothing(id))

  console.log(
    `\n  명세 ${specced.length}개 / 그려지는 것 ${drawn.length + byBase.length}개 = ` +
      `${(((drawn.length + byBase.length) / specced.length) * 100).toFixed(1)}%` +
      `  (그릴 것을 가진 화면 ${drawn.length} · 바탕이 그리는 변형 ${byBase.length} · ` +
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

// 화면이 **명세에 없는 출처**를 읽고 있는가.
//
// 지금까지 대조는 늘 명세 → 화면 한 방향이었다. 명세가 가리킨 것을 화면이
// 그렸는지는 봤지만, **화면이 명세 밖에서 무언가를 읽는 것**은 아무도 보지
// 않았다. OPS-MEET-02가 그렇게 `meeting.memberCandidates`를 코드에 박아 읽고
// 있었고 — 카탈로그의 그 항목은 아무 명세도 가리키지 않는 죽은 선언처럼
// 보였는데, 죽은 것이 아니라 **명세가 모르는 채로 살아 있었다.**
//
// 명세만 읽는 사람은 그 화면이 그 출처를 필요로 한다는 것을 알 길이 없다.
// 이것이 "명세 하나면 된다"가 새는 자리다.
test('화면이 명세에 없는 데이터 출처를 읽지 않는다', () => {
  const screenSource = join(repoRoot, 'apps', 'vada-web', 'src', 'screens')
  const declaredOf = (screenId) => {
    const keys = new Set()
    const walk = (node) => {
      if (Array.isArray(node)) {
        for (const item of node) walk(item)
        return
      }
      if (node === null || typeof node !== 'object') return
      for (const [name, value] of Object.entries(node)) {
        if (name === 'dataSourceKey' && typeof value === 'string') {
          keys.add(value)
          continue
        }
        if (name === 'optionsSource') continue
        walk(value)
      }
    }
    walk(JSON.parse(readFileSync(join(SCREENS, screenId, 'screen.json'), 'utf8')))
    return keys
  }

  const folders = readdirSync(SCREENS, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)

  const undeclared = []
  for (const file of readdirSync(screenSource).filter((name) => name.endsWith('Screen.tsx'))) {
    const flat = file.replace('Screen.tsx', '')
    const screenId = folders.find((name) => name.replace(/-/g, '') === flat)
    if (screenId === undefined) continue
    if (!existsSync(join(SCREENS, screenId, 'screen.json'))) continue

    const code = readFileSync(join(screenSource, file), 'utf8')
    const read = new Set(
      [...code.matchAll(/read[A-Za-z]*Source[A-Za-z]*\(\s*'([^']+)'/g)].map((match) => match[1]),
    )
    const declared = declaredOf(screenId)
    for (const key of read) {
      if (!declared.has(key)) {
        undeclared.push(`  ${screenId}: '${key}'를 읽는데 명세가 말하지 않습니다.`)
      }
    }
  }

  assert.equal(
    undeclared.length,
    0,
    '화면이 명세 밖의 출처를 읽습니다. 명세가 말하게 하세요.' + String.fromCharCode(10) + undeclared.join(String.fromCharCode(10)),
  )
})
