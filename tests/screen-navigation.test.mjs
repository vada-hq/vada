// 화면이 셸의 **어느 메뉴 아래에 있는지**를 명세가 말하는가.
//
// 그림은 늘 말하고 있었다 — 사이드바의 한 칸만 바탕이 칠해져 있다. 그런데 명세에는
// 그 자리가 뒤늦게 생겼고, 이미 있던 화면 열여덟이 그 말을 하지 않은 채 남았다.
// 실행이 멀쩡했던 까닭은 화면이 **자기 id로** 메뉴를 찾았기 때문이고, 짝이 없으면
// 아무 메뉴도 켜지지 않았다. 명세만 읽고 화면을 만드는 사람은 그것을 알 수 없다.
//
// 그래서 이 검사는 명세끼리 대조하지 않는다. **그림에게 묻고 명세에게 확인한다.**
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
const MENU_LABELS = shell.navigation.map((item) => item.label)
const TARGET_OF = new Map(
  shell.navigation.map((item) => [item.label, item.targetScreenId]),
)

// 켜진 메뉴는 **바탕이 칠해진** 칸이다. 사이드바 자체의 흰 바탕은 켜진 표시가 아니다.
const SIDEBAR_GROUND = new Set(['#FFFFFF', '#F9FAFB', '#F3F4F6'])

/** 이 그림에서 켜져 있는 최상위 메뉴의 이름. 사이드바가 없으면 null. */
function litMenuOf(design) {
  const root = design.id === undefined ? (design.root ?? design) : design
  const parents = new Map()
  const found = []

  const walk = (node, parent) => {
    parents.set(node, parent)
    if (MENU_LABELS.includes(node.text?.content)) found.push(node)
    for (const child of node.children ?? []) walk(child, node)
  }
  walk(root, null)

  for (const label of found) {
    // 글자에서 위로 올라가며 바탕이 칠해진 첫 조상을 찾는다. 그보다 위는 사이드바다.
    let node = parents.get(label)
    for (let depth = 0; node !== null && node !== undefined && depth < 4; depth += 1) {
      const painted = (node.appearance?.fills ?? []).find(
        (fill) => fill.type === 'solid' && fill.opacity !== 0,
      )
      if (painted !== undefined) {
        if (!SIDEBAR_GROUND.has(painted.color.toUpperCase())) {
          return label.text.content
        }
        break
      }
      node = parents.get(node)
    }
  }
  return null
}

const specced = readdirSync(SCREENS, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .filter((id) => {
    try {
      readFileSync(join(SCREENS, id, 'screen.json'))
      return true
    } catch {
      return false
    }
  })

test('화면은 자기가 셸의 어느 메뉴 아래에 있는지 말한다', () => {
  const silent = []
  const wrong = []

  for (const id of specced) {
    const spec = JSON.parse(readFileSync(join(SCREENS, id, 'screen.json'), 'utf-8'))
    // 변형은 원본이, 겹쳐 뜨는 화면은 뒤에 남는 화면이 이미 말했다(viewer와 같은
    // 규칙). 겹치는 화면은 뒤에 남는 화면을 그리게 하고 그 화면이 셸을 그린다 —
    // 여기 적어 두면 아무도 읽지 않는 값이 명세에 남는다.
    if (spec.variantOf !== undefined || spec.overlay !== undefined) {
      const whose = spec.variantOf === undefined ? '뒤에 남는 화면' : '원본'
      assert.equal(
        spec.activeNavigationScreenId,
        undefined,
        `${id}: 셸의 메뉴를 스스로 말하지 않는다. ${whose}이 이미 말했다.`,
      )
      continue
    }

    let design
    try {
      design = JSON.parse(readFileSync(join(SCREENS, id, 'figma.design.json'), 'utf-8'))
    } catch {
      continue
    }

    const lit = litMenuOf(design)
    if (lit === null) {
      // 셸을 그리지 않는 화면. 그렇다면 메뉴를 말할 것도 없다.
      wrong.push(
        ...(spec.activeNavigationScreenId === undefined
          ? []
          : [`${id}: 그림에 사이드바가 없는데 '${spec.activeNavigationScreenId}'라고 말한다`]),
      )
      continue
    }

    const target = TARGET_OF.get(lit)
    // 그 메뉴가 아직 아무 화면도 가리키지 않으면 견줄 것이 없다.
    if (target === undefined) continue
    // 메뉴가 가리키는 화면 자신은 말하지 않는다 — 자기 id로 찾으면 된다.
    if (target === id) {
      if (spec.activeNavigationScreenId !== undefined) {
        wrong.push(`${id}: 메뉴가 가리키는 화면 자신인데 굳이 말한다`)
      }
      continue
    }

    if (spec.activeNavigationScreenId === undefined) {
      silent.push(`  "${id}" -> "${target}"   (그림이 '${lit}'을 켜 두었다)`)
    } else if (spec.activeNavigationScreenId !== target) {
      wrong.push(
        `${id}: 그림은 '${lit}'(${target})을 켜는데 명세는 '${spec.activeNavigationScreenId}'라고 말한다`,
      )
    }
  }

  assert.equal(
    silent.length,
    0,
    `그림이 켜 둔 메뉴를 명세가 말하지 않는 화면이 있습니다.\n` +
      `screen.json의 source 바로 앞에 activeNavigationScreenId를 더하세요.\n` +
      silent.join('\n'),
  )
  assert.equal(wrong.length, 0, `\n${wrong.join('\n')}`)
})
