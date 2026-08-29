// 그림에 있는데 **명세가 말하지 않는 글**이 있는가.
//
// design 대조는 **등록 노드 안에서만** 돈다. 그 밖에 그려지는 글은 아무도 견주지
// 않는다 — 화면이 무엇을 그리든 초록이다. 그래서 "대조가 통과했다"는 말은 "덮은
// 만큼은 맞다"는 뜻이고, 덮지 못한 자리를 세지 않으면 그 말이 얼마짜리인지 모른다.
//
// 이 눈금이 실제로 무언가를 찾았다: OPS-MEET-06A가 가장 낮았고, 그 까닭이
// **object 출처 안의 배열을 목록으로 그릴 어휘가 없다**는 것이었다. 화면이 그
// 자리를 일부러 비워 두고 있었고 주석이 그렇게 적혀 있었다. 눈금이 그 주석을
// 읽지 않고 같은 곳을 짚었다.
//
// 빠진 글은 세 갈래이고 **셋을 섞으면 아무것도 재지 않는다.** 그릇이 그리는
// 머리·제목은 명세가 값으로 말한 것이고, 되풀이의 둘째 사본은 첫 벌이 말한 것이며,
// 남는 것만이 구멍이다. 아래 ALLOWED의 주석이 그 셋을 왜 가르는지 적어 두었다.
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const WIREFRAME = fileURLToPath(
  new URL('../specs/figma/vada-wireframe/', import.meta.url),
)
const SCREENS = join(WIREFRAME, 'screens')
const shell = JSON.parse(readFileSync(join(WIREFRAME, 'shell.json'), 'utf-8'))

// 셸은 모든 화면이 나눠 쓰는 구조라 화면의 요소가 아니다. screen-draft.mjs와
// **같은 규칙**을 쓴다 — '*/이름'은 화면 바로 아래(깊이 2)에 있는 그 이름의
// 노드다. 이름만 보면 그 이름이 겹치는 자리가 통째로 사라지고(ORG-03C의 초대
// 칸이 'Sidebar'다), 어미 이름으로 보면 셸 프레임의 이름이 화면마다 달라 새어
// 나간다(DesktopShell 63개 · 다른 이름 아홉).
const EXCLUDED = new Set(shell.design?.excludeNodeNames ?? [])
const EXCLUDED_AT_TOP = new Set(
  [...EXCLUDED].filter((entry) => entry.startsWith('*/')).map((entry) => entry.slice(2)),
)

/** 셸 밖에 그려지는 글자 노드 전부. */
function drawnTexts(node, parent = null, out = [], depth = 0) {
  if (EXCLUDED.has(node.name)) return out
  if (EXCLUDED.has(`${parent?.name ?? ''}/${node.name}`)) return out
  if (depth === 2 && EXCLUDED_AT_TOP.has(node.name)) return out
  if (node.text?.content) out.push(node)
  for (const child of node.children ?? []) drawnTexts(child, node, out, depth + 1)
  return out
}

/** design-check의 registeredNodeIds와 같은 셈. */
function registeredIds(spec) {
  const ids = []
  for (const element of spec.elements ?? []) {
    ids.push(element.source.nodeId)
    // 한 자리를 여러 번 그린 그림의 사본도 그 요소의 것이다. 참석 확인의 결과
    // 여섯이 노드 대 노드로 같고 서로 배타적이다 — 한 사람에게 하나만 온다.
    for (const copy of element.source.alsoDrawnAt ?? []) ids.push(copy)
    for (const field of element.spec?.itemFields ?? []) ids.push(field.source.nodeId)
    if (typeof element.spec?.paging?.source === 'string') {
      ids.push(element.spec.paging.source)
    }
  }
  for (const nodeId of Object.values(spec.workspace?.source ?? {})) {
    if (typeof nodeId === 'string') ids.push(nodeId)
  }
  if (typeof spec.breadcrumb?.source === 'string') ids.push(spec.breadcrumb.source)
  return new Set(ids)
}

function collect(node, wanted, out = []) {
  if (wanted.has(node.id)) out.push(node)
  for (const child of node.children ?? []) collect(child, wanted, out)
  return out
}

function textIdsIn(node, out = new Set()) {
  if (node.text?.content) out.add(node.id)
  for (const child of node.children ?? []) textIdsIn(child, out)
  return out
}

/** 노드 id → 부모 노드. 빠진 글이 어디에 속하는지를 위로 올라가며 묻는 데 쓴다. */
function parentsOf(node, out = new Map(), parent = null) {
  out.set(node.id, parent)
  for (const child of node.children ?? []) parentsOf(child, out, node)
  return out
}

function ancestorsOf(node, parents) {
  const chain = []
  let at = parents.get(node.id)
  while (at !== null && at !== undefined) {
    chain.push(at)
    at = parents.get(at.id)
  }
  return chain
}

function containsRegistered(node, registered) {
  if (registered.has(node.id)) return true
  return (node.children ?? []).some((child) => containsRegistered(child, registered))
}

/**
 * 화면 명세가 아니라 **그릇이 그리는 글**인가.
 *
 * 두 가지다. (1) `Header` 안의 글 — 빵부스러기와 제목은 셸이 그린다(그 안의 버튼은
 * 화면의 요소이고, 등록되므로 이미 덮인 것으로 세어진다). (2) `meta`의 넷과 같은
 * 글 — 셸이 없는 화면(EXT-*)에서 제목을 그리는 것은 PageCard·MobileScreen이다.
 *
 * **둘 다 명세가 말하지 않은 것이 아니다.** 값은 명세(meta·shell.json)에 있고 그것을
 * 어느 노드에 그리는지만 그릇이 안다. 그래서 분모에서 뺀다 — 여기 남겨 두면 눈금이
 * 영원히 100%에 닿지 못하고, 닿지 못하는 눈금은 무엇이 모자란지 말하지 못한다.
 */
function drawnByFrame(text, parents, metaTexts) {
  if (ancestorsOf(text, parents).some((node) => node.name === 'Header')) return true
  return metaTexts.has(text.text.content.trim())
}

/**
 * 되풀이의 **둘째 사본부터**인가.
 *
 * 규칙이 "첫 벌만 등록한다"이므로 나머지 사본은 명세가 이미 말한 것이다. 조상 중
 * 하나가 같은 이름의 형제를 갖고 그 형제가 등록된 노드를 품으면 이 글은 사본이다.
 */
function isRepeatCopy(text, parents, registered) {
  for (const at of ancestorsOf(text, parents)) {
    const above = parents.get(at.id)
    if (above === null || above === undefined) continue
    for (const sibling of above.children ?? []) {
      if (sibling === at) continue
      if (sibling.name !== at.name) continue
      if (containsRegistered(sibling, registered)) return true
    }
  }
  return false
}

/**
 * 이 화면의 글자 셈. null이면 셀 것이 없다.
 *
 * - `covered` 등록 노드가 덮은 글자
 * - `byFrame` 그릇이 그리는 글자(머리·제목) — 분모에서 뺀다
 * - `byCopy` 되풀이의 둘째 사본부터 — 분모에서 뺀다
 * - `hole` **아무도 말하지 않는 글자.** 이것만이 명세의 구멍이다.
 * - `total` 셸 밖 글자 전체(위 넷의 합)
 */
export function coverageOf(screenId) {
  let spec
  let design
  try {
    spec = JSON.parse(readFileSync(join(SCREENS, screenId, 'screen.json'), 'utf-8'))
    design = JSON.parse(
      readFileSync(join(SCREENS, screenId, 'figma.design.json'), 'utf-8'),
    )
  } catch {
    return null
  }
  // 변형과 겹침은 **다른 부분만** 등록한다. 나머지는 원본/뒷화면의 몫이라
  // 여기서 세면 덮지 못한 것으로 잘못 잡힌다.
  if (spec.variantOf !== undefined || spec.overlay !== undefined) return null

  const root = design.root ?? design
  const all = drawnTexts(root)
  if (all.length === 0) return null

  const registered = registeredIds(spec)
  const covered = new Set()
  for (const holder of collect(root, registered)) {
    for (const id of textIdsIn(holder)) covered.add(id)
  }

  const parents = parentsOf(root)
  const metaTexts = new Set(
    [spec.meta?.title, spec.meta?.eyebrow, spec.meta?.description, spec.meta?.footerNote]
      .filter((text) => typeof text === 'string')
      .map((text) => text.trim()),
  )

  let byFrame = 0
  let byCopy = 0
  const holes = []
  for (const text of all) {
    if (covered.has(text.id)) continue
    if (drawnByFrame(text, parents, metaTexts)) {
      byFrame += 1
    } else if (isRepeatCopy(text, parents, registered)) {
      byCopy += 1
    } else {
      holes.push(text.text.content.replace(/\s+/g, ' ').trim())
    }
  }

  return {
    covered: all.length - byFrame - byCopy - holes.length,
    byFrame,
    byCopy,
    hole: holes.length,
    holes,
    total: all.length,
    /** 명세가 말해야 하는 글자. 그릇의 몫과 되풀이 사본을 뺀 나머지다. */
    countable: all.length - byFrame - byCopy,
  }
}

// 화면마다 **봐준 글자의 수**. 구멍이 0이라는 말이 값싸지 않으려면 이 둘이 묶여
// 있어야 한다 — 그릇의 몫도 되풀이 사본도 "명세가 말하지 않았는데 넘어간 것"으로
// 둔갑할 수 있는 자리이기 때문이다.
//
// **이 눈금은 한 번 거짓말을 했다.** 그전에는 덮는 몫을 백분율로 재고 화면마다
// 바닥을 두었는데, 빠진 259자를 갈라 보니 **전부가 눈금이 셀 수 없던 것**이었다
// (그릇이 그리는 머리·제목 151 · 되풀이 둘째 사본부터 108). 명세의 구멍은 0개였다.
// 91.9%라는 숫자는 아무것도 재지 않으면서 "아직 8% 모자라다"고 말하고 있었다.
//
// 그래서 재는 것을 바꿨다. **구멍은 0이어야 한다**가 본 검사이고, 봐준 수가 늘면
// 그것도 실패다 — 새로 그려진 글은 등록 노드가 덮거나, 아니면 사람이 이 표를 보고
// 늘리는 까닭을 적어야 한다. 조용히 넘어갈 길을 남기지 않는다.
const ALLOWED = {
  'EVT-00A': { byFrame: 4, byCopy: 0 },
  'EVT-01': { byFrame: 1, byCopy: 0 },
  'EVT-02': { byFrame: 4, byCopy: 0 },
  'EVT-02D': { byFrame: 4, byCopy: 0 },
  'EVT-03A': { byFrame: 5, byCopy: 0 },
  'EVT-03B': { byFrame: 5, byCopy: 0 },
  'EVT-04': { byFrame: 5, byCopy: 0 },
  'EVT-05': { byFrame: 1, byCopy: 0 },
  'EVT-05B': { byFrame: 1, byCopy: 0 },
  'EVT-DOC-01': { byFrame: 8, byCopy: 0 },
  'EVT-FIN-01': { byFrame: 5, byCopy: 0 },
  'EVT-MEET-01': { byFrame: 5, byCopy: 0 },
  'EVT-SCHED-01': { byFrame: 8, byCopy: 0 },
  'EVT-TASK-01': { byFrame: 7, byCopy: 0 },
  'EVT-TASK-02': { byFrame: 6, byCopy: 0 },
  'EXT-01A': { byFrame: 1, byCopy: 2 },
  'EXT-01B': { byFrame: 1, byCopy: 1 },
  'EXT-02A': { byFrame: 1, byCopy: 4 },
  'EXT-02B': { byFrame: 0, byCopy: 1 },
  'EXT-02C': { byFrame: 1, byCopy: 1 },
  'FIN-00': { byFrame: 1, byCopy: 0 },
  'FIN-EVID-01': { byFrame: 1, byCopy: 25 },
  'FIN-LEDGER-01': { byFrame: 2, byCopy: 0 },
  'FIN-PROC-01': { byFrame: 1, byCopy: 30 },
  'FIN-REQ-01': { byFrame: 6, byCopy: 0 },
  'FIN-REQ-02': { byFrame: 1, byCopy: 0 },
  'FIN-REV-01': { byFrame: 1, byCopy: 0 },
  'FIN-SUP-01': { byFrame: 1, byCopy: 0 },
  'HOME-01K': { byFrame: 3, byCopy: 0 },
  'INV-00': { byFrame: 2, byCopy: 3 },
  'INV-01': { byFrame: 1, byCopy: 2 },
  'MSG-01': { byFrame: 1, byCopy: 0 },
  'MSG-03': { byFrame: 2, byCopy: 0 },
  'MY-01': { byFrame: 3, byCopy: 0 },
  'MY-REQ-01': { byFrame: 1, byCopy: 0 },
  'ONB-01': { byFrame: 3, byCopy: 5 },
  'ONB-02': { byFrame: 3, byCopy: 3 },
  'OPS-00': { byFrame: 3, byCopy: 0 },
  'OPS-CAL-01': { byFrame: 3, byCopy: 0 },
  'OPS-MEET-01A': { byFrame: 3, byCopy: 0 },
  'OPS-MEET-02': { byFrame: 5, byCopy: 0 },
  'OPS-MEET-03A': { byFrame: 1, byCopy: 0 },
  'OPS-MEET-04B': { byFrame: 1, byCopy: 0 },
  'OPS-MEET-05A': { byFrame: 1, byCopy: 2 },
  'OPS-MEET-06A': { byFrame: 1, byCopy: 14 },
  'OPS-MEET-07': { byFrame: 1, byCopy: 12 },
  'OPS-MEET-09': { byFrame: 1, byCopy: 0 },
  'ORG-00': { byFrame: 3, byCopy: 0 },
  'ORG-01': { byFrame: 3, byCopy: 1 },
  'ORG-02': { byFrame: 4, byCopy: 1 },
  'ORG-03A': { byFrame: 1, byCopy: 0 },
  'ORG-03B': { byFrame: 1, byCopy: 0 },
  'ORG-03C': { byFrame: 2, byCopy: 1 },
  'ORG-04': { byFrame: 1, byCopy: 0 },
  'ORG-04B': { byFrame: 1, byCopy: 0 },
  'ORG-07A': { byFrame: 1, byCopy: 0 },
  'REC-01': { byFrame: 2, byCopy: 0 },
  'REC-02': { byFrame: 1, byCopy: 0 },
  'REC-02A': { byFrame: 1, byCopy: 0 },
  'TASK-01': { byFrame: 4, byCopy: 0 },
}

test('명세가 말하지 않는 글이 없다', () => {
  const holes = []
  const unlisted = []

  for (const entry of readdirSync(SCREENS, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    const now = coverageOf(entry.name)
    if (now === null) continue
    if (ALLOWED[entry.name] === undefined) {
      unlisted.push(
        `      "${entry.name}": { byFrame: ${now.byFrame}, byCopy: ${now.byCopy} },`,
      )
    }
    if (now.hole > 0) {
      holes.push(
        `  ${entry.name}: ${now.hole}개 — ${now.holes.slice(0, 6).map((text) => `'${text}'`).join(' · ')}`,
      )
    }
  }

  assert.equal(
    unlisted.length,
    0,
    '눈금에 없는 화면이 있습니다. 아래 줄을 ALLOWED에 더하세요.\n' + unlisted.join('\n'),
  )
  assert.equal(
    holes.length,
    0,
    '그림에 있는데 명세가 말하지 않는 글이 있습니다.\n' +
      '등록 노드로 덮거나, 봐줄 까닭이 있으면 ALLOWED를 늘리고 왜인지 적으세요.\n' +
      holes.join('\n'),
  )
})

test('봐준 글자가 늘지 않는다', () => {
  const grown = []
  for (const [screenId, allowed] of Object.entries(ALLOWED)) {
    const now = coverageOf(screenId)
    if (now === null) continue
    if (now.byFrame > allowed.byFrame) {
      grown.push(`  ${screenId}: 그릇의 몫 ${now.byFrame} > 적어 둔 ${allowed.byFrame}`)
    }
    if (now.byCopy > allowed.byCopy) {
      grown.push(`  ${screenId}: 되풀이 사본 ${now.byCopy} > 적어 둔 ${allowed.byCopy}`)
    }
  }
  assert.equal(
    grown.length,
    0,
    '눈금이 봐주는 글자가 늘었습니다 — 명세가 말하지 않은 것이 그리로 새고 있는지 보세요.\n' +
      grown.join('\n'),
  )
})

test('세어 둔다 — 명세가 그림의 몇 할을 말하는가', () => {
  let covered = 0
  let byFrame = 0
  let byCopy = 0
  let hole = 0
  let screens = 0
  for (const entry of readdirSync(SCREENS, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    const now = coverageOf(entry.name)
    if (now === null) continue
    covered += now.covered
    byFrame += now.byFrame
    byCopy += now.byCopy
    hole += now.hole
    screens += 1
  }
  const countable = covered + hole
  console.log(
    `\n  명세가 말하는 글자 ${covered} / 말해야 하는 글자 ${countable} = ` +
      `${((covered / countable) * 100).toFixed(1)}퍼센트  (화면 ${screens}개)\n` +
      `  분모에서 뺀 것 — 그릇이 그리는 머리·제목 ${byFrame} · 되풀이 둘째 사본부터 ${byCopy}\n`,
  )
  assert.equal(hole, 0)
})
