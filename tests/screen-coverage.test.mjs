// 명세가 화면의 몇 할을 덮는가.
//
// design 대조는 **등록 노드 안에서만** 돈다. 그 밖에 그려지는 글은 아무도 견주지
// 않는다 — 화면이 무엇을 그리든 초록이다. 그래서 "대조가 통과했다"는 말은 "덮은
// 만큼은 맞다"는 뜻이고, 얼마나 덮었는지를 세지 않으면 그 말이 얼마짜리인지 모른다.
//
// 이 눈금이 실제로 무언가를 찾았다: OPS-MEET-06A가 가장 낮았고, 그 까닭이
// **object 출처 안의 배열을 목록으로 그릴 어휘가 없다**는 것이었다. 화면이 그
// 자리를 일부러 비워 두고 있었고 주석이 그렇게 적혀 있었다. 눈금이 그 주석을
// 읽지 않고 같은 곳을 짚었다.
//
// 되풀이되는 묶음의 둘째부터는 등록하지 않는 것이 규칙이라(첫 벌만 등록한다)
// 100%가 목표가 아니다. **떨어지지 않는 것**이 목표다.
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

/** 이 화면에서 (등록 노드가 덮은 글자, 셸 밖 글자 전체). null이면 셀 것이 없다. */
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

  const covered = new Set()
  for (const holder of collect(root, registeredIds(spec))) {
    for (const id of textIdsIn(holder)) covered.add(id)
  }
  return { covered: all.filter((t) => covered.has(t.id)).length, total: all.length }
}

// 화면마다의 바닥. 떨어지면 검사가 잡고, 새 화면은 줄을 더해야 통과한다 —
// 그 순간이 "이 화면의 명세가 그림의 몇 할을 말하는가"를 한 번 보는 자리다.
const FLOOR = {
  'EVT-00A': { covered: 29, total: 45 },
  'EVT-01': { covered: 41, total: 42 },
  'EVT-02': { covered: 81, total: 97 },
  'EVT-02D': { covered: 59, total: 75 },
  'EVT-03A': { covered: 48, total: 65 },
  'EVT-03B': { covered: 60, total: 65 },
  'EVT-05': { covered: 104, total: 105 },
  'EVT-05B': { covered: 32, total: 41 },
  'EVT-04': { covered: 66, total: 83 },
  'EVT-DOC-01': { covered: 55, total: 75 },
  'EVT-FIN-01': { covered: 50, total: 67 },
  'EVT-MEET-01': { covered: 35, total: 52 },
  'EVT-SCHED-01': { covered: 85, total: 105 },
  'EVT-TASK-01': { covered: 64, total: 83 },
  'EVT-TASK-02': { covered: 58, total: 76 },
  // 밖에서 온 사람이 보는 다섯. **덜 덮인 자리가 셋 다 정당하다** — 폰 겉틀의 시계
  // '9:41', 로고 'V'·'Vada'(shell.json의 것), 그리고 화면 제목이다.
  //
  // 제목이 빠지는 것은 이 화면들의 흠이 아니라 **눈금의 눈먼 자리**다. meta에는
  // source가 없어 무엇이 제목을 그린 노드인지 알 방법이 없다. 저장소 전체에서
  // meta.title과 같은 글 64곳, eyebrow·description·footerNote 37곳이 같은 까닭으로
  // 안 세어진다(전체의 1.5% 남짓). 셸이 있는 화면은 머리가 등록 노드 안에 들어
  // 가려져 덜 드러날 뿐이다.
  'EXT-01A': { covered: 9, total: 12 },
  'EXT-01B': { covered: 12, total: 14 },
  'EXT-02A': { covered: 17, total: 22 },
  'EXT-02B': { covered: 9, total: 10 },
  'EXT-02C': { covered: 15, total: 17 },
  'FIN-00': { covered: 83, total: 84 },
  'FIN-EVID-01': { covered: 28, total: 54 },
  'FIN-LEDGER-01': { covered: 94, total: 96 },
  'FIN-PROC-01': { covered: 33, total: 64 },
  'FIN-REQ-01': { covered: 173, total: 191 },
  'FIN-REQ-02': { covered: 62, total: 75 },
  'FIN-REV-01': { covered: 71, total: 84 },
  'FIN-SUP-01': { covered: 45, total: 58 },
  'HOME-01K': { covered: 54, total: 69 },
  'INV-01': { covered: 21, total: 24 },
  'INV-00': { covered: 8, total: 13 },
  'MSG-01': { covered: 3, total: 4 },
  'MSG-03': { covered: 3, total: 5 },
  'MY-01': { covered: 30, total: 45 },
  'MY-REQ-01': { covered: 46, total: 59 },
  'ONB-01': { covered: 12, total: 20 },
  'ONB-02': { covered: 6, total: 12 },
  'OPS-00': { covered: 33, total: 48 },
  'OPS-CAL-01': { covered: 97, total: 100 },
  'OPS-MEET-01A': { covered: 101, total: 116 },
  'OPS-MEET-02': { covered: 106, total: 123 },
  'OPS-MEET-03A': { covered: 59, total: 72 },
  'OPS-MEET-04B': { covered: 33, total: 46 },
  'OPS-MEET-05A': { covered: 59, total: 74 },
  // 가장 낮다. object 출처 안의 배열을 목록으로 그릴 어휘가 없어 '현재 정리 현황'
  // 네 줄을 명세가 말하지 못한다(OPSMEET06AScreen.tsx 파일 머리의 주석).
  'OPS-MEET-06A': { covered: 22, total: 45 },
  'OPS-MEET-07': { covered: 38, total: 51 },
  'OPS-MEET-09': { covered: 23, total: 36 },
  'ORG-00': { covered: 9, total: 12 },
  'ORG-01': { covered: 19, total: 23 },
  'ORG-02': { covered: 15, total: 20 },
  'ORG-03A': { covered: 41, total: 54 },
  'ORG-03B': { covered: 60, total: 61 },
  'ORG-03C': { covered: 31, total: 46 },
  'ORG-04': { covered: 76, total: 77 },
  'ORG-04B': { covered: 42, total: 55 },
  'ORG-07A': { covered: 73, total: 86 },
  'REC-01': { covered: 34, total: 36 },
  'REC-02': { covered: 122, total: 123 },
  'REC-02A': { covered: 65, total: 66 },
  'TASK-01': { covered: 62, total: 78 },
}

test('명세가 덮는 몫이 떨어지지 않는다', () => {
  const measured = []
  const missing = []
  const dropped = []

  for (const entry of readdirSync(SCREENS, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    const now = coverageOf(entry.name)
    if (now === null) continue
    measured.push([entry.name, now])

    const floor = FLOOR[entry.name]
    if (floor === undefined) {
      missing.push(
        `      "${entry.name}": { covered: ${now.covered}, total: ${now.total} },` +
          `   // ${((now.covered / now.total) * 100).toFixed(1)}%`,
      )
      continue
    }
    if (now.covered / now.total < floor.covered / floor.total - 1e-9) {
      dropped.push(
        `  ${entry.name}: ${now.covered}/${now.total} < 바닥 ${floor.covered}/${floor.total}`,
      )
    }
  }

  const covered = measured.reduce((sum, [, m]) => sum + m.covered, 0)
  const total = measured.reduce((sum, [, m]) => sum + m.total, 0)
  console.log(
    `\n  명세가 덮는 글자 ${covered} / 그려지는 글자 ${total} = ` +
      `${((covered / total) * 100).toFixed(1)}%  (화면 ${measured.length}개)\n`,
  )

  assert.equal(
    missing.length,
    0,
    '눈금에 없는 화면이 있습니다. 아래 줄을 FLOOR에 더하세요.\n' +
      '더하기 전에 한 번 보세요 — 낮으면 그 화면의 명세가 그림의 무언가를 말하지 않고 있습니다.\n' +
      missing.join('\n'),
  )
  assert.equal(dropped.length, 0, `덮는 몫이 떨어졌습니다.\n${dropped.join('\n')}`)
})
