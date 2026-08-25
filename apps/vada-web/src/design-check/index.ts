import { FONT_WEIGHTS, colorOf, sameColor, tokenOf } from './palette'

// figma.design.json과 실제로 그려진 DOM을 대조한다.
//
// 왜 필요한가. 명세(screen.json)는 무엇을 어디서 읽는지를 갖고, 시각은 design이
// 갖는다. 그런데 구현이 design을 자동으로 읽지는 않으므로, 사람이 Tailwind 클래스를
// 손으로 고른다. 손으로 고른 것은 어긋나고, 어긋나도 아무도 모른다. 화면이 늘수록
// 어긋난 자리도 늘어난다 — 인스턴스가 아니라 계급을 고쳐야 한다.
//
// 무엇을 대조하고 무엇을 대조하지 않는가.
//
// - 대조한다: 글의 내용, 글자 색, 글자 굵기, 칸의 배경색과 테두리색,
//   그리고 design이 그림으로 뽑아 둔 자리를 화면이 그렸는지.
// - 대조하지 않는다: 여백·크기·위치·글자 크기. 와이어프레임이 0.875배로 떠 있어서
//   숫자가 Tailwind 눈금에 딱 떨어지지 않는다. 그 축은 구조적으로 잡음이 섞여
//   있으므로 지금 붙이면 거짓 경보만 낸다.
//
// 색은 Tailwind 팔레트에서 유도한다(palette.ts). 이 와이어프레임의 색은 Tailwind
// 팔레트와 정확히 같아서 오차 없이 이름으로 견줄 수 있다. 그래서 대조 결과가 곧
// 고칠 클래스 이름이다 — design red-700이라 하면 text-red-700으로 적으면 된다.
//
// 못 보는 것도 적어 둔다. 잡는다고 착각하면 안 잡히는 자리가 생긴다.
//
// - 한 방향이다. design에 있는 것이 화면에 있는지를 보지, 화면에만 있는 장식이
//   design에 없다는 것은 잡지 못한다.
// - 등록 노드 밖은 보지 않는다. 셸(사이드바·헤더)은 등록에서 빠져 있다.
// - 같은 글이 화면에 여럿이면 하나만 맞아도 통과시킨다. 글자만으로는 어느 것이
//   어느 것인지 가릴 수 없기 때문이다. 없는 것을 잡는 것이 목적이지 짝을 맞히는
//   것이 목적이 아니다.
//
// 와이어프레임이 규칙적이지 않은 자리는 규칙을 따르고, 그래서 생긴 차이는 지우지
// 않고 design/deviations.ts에 적는다 — 어긋난 것을 숨기는 것과 어긋나기로 한 것을
// 적어 두는 것은 다른 일이다.

export interface DesignFill {
  type: string
  color?: string
  opacity?: number
}

export interface DesignNode {
  id: string
  type: string
  name: string
  /** 이 노드가 그림 하나로 뽑힌 자리(예: 'assets/16-403.svg'). */
  assetRef?: string
  appearance?: {
    fills?: DesignFill[]
    strokes?: DesignFill[]
  }
  text?: {
    content: string
    style: { fontWeight: number }
  }
  children?: DesignNode[]
}

export interface DesignFile {
  screenId: string
  root: DesignNode
}

/** design이 그리는 글 한 줄기. Figma의 텍스트 노드 하나가 곧 한 가지 색·굵기다. */
export interface DesignText {
  content: string
  color: string | null
  fontWeight: number
}

/** 배경이나 테두리를 가진 칸. 안에 담긴 글로 화면에서 같은 칸을 찾는다. */
export interface DesignBox {
  /** 보고용으로 이어 붙인 글. */
  content: string
  /** 칸이 품은 글줄들. 화면에서 이 줄들을 모두 품은 가장 작은 요소가 같은 칸이다. */
  runs: string[]
  background: string | null
  border: string | null
}

// --- design 쪽 ----------------------------------------------------------

export function findNode(node: DesignNode, nodeId: string): DesignNode {
  const found = tryFindNode(node, nodeId)
  if (found === null) {
    throw new Error(`design에 노드가 없습니다: ${nodeId}`)
  }
  return found
}

function tryFindNode(node: DesignNode, nodeId: string): DesignNode | null {
  if (node.id === nodeId) {
    return node
  }
  for (const child of node.children ?? []) {
    const found = tryFindNode(child, nodeId)
    if (found !== null) {
      return found
    }
  }
  return null
}

// 등록된 요소 안에 다른 등록 요소가 들어 있을 수 있다 — design에 더 안쪽 칸이 없어서
// 요약 칩 넷과 범위 토글이 한 칸에 함께 사는 식이다(TASK-01 18:95 ⊃ 18:122).
// 그 안쪽은 그 요소가 제 몫으로 대조하므로, 바깥 요소는 들여다보지 않는다.
function descendants(node: DesignNode, exclude: ReadonlySet<string> = EMPTY): DesignNode[] {
  const all: DesignNode[] = []
  const visit = (current: DesignNode) => {
    all.push(current)
    for (const child of current.children ?? []) {
      if (exclude.has(child.id)) {
        continue
      }
      visit(child)
    }
  }
  visit(node)
  return all
}

const EMPTY: ReadonlySet<string> = new Set()

// 투명한 칠(opacity 0)은 자리를 맞추려고 둔 것이지 보이는 색이 아니다.
function solidColor(paints: DesignFill[] | undefined): string | null {
  const paint = (paints ?? []).find((p) => p.type === 'solid' && p.opacity !== 0)
  return paint?.color?.toUpperCase() ?? null
}

// 칸을 화면에서 찾을 때 쓰는 글줄은 안쪽까지 다 센다. 무엇을 대조할지와 어떻게
// 찾을지는 다른 문제다 — 글줄을 덜어내면 더 작은 요소가 걸려 색을 가진 칸을 놓친다.
function runsOf(node: DesignNode): string[] {
  return descendants(node)
    .filter((n) => n.type === 'text' && n.text)
    .map((n) => n.text?.content ?? '')
}

// 같은 글이 같은 모양으로 되풀이되면(목록의 되풀이 항목) 한 번만 본다.
function dedupe<T>(items: T[], keyOf: (item: T) => string): T[] {
  const seen = new Set<string>()
  return items.filter((item) => {
    const key = keyOf(item)
    if (seen.has(key)) {
      return false
    }
    seen.add(key)
    return true
  })
}

export function textsIn(node: DesignNode, exclude: ReadonlySet<string> = EMPTY): DesignText[] {
  const texts = descendants(node, exclude)
    .filter((n) => n.type === 'text' && n.text)
    .map((n) => ({
      content: n.text?.content ?? '',
      color: solidColor(n.appearance?.fills),
      fontWeight: n.text?.style.fontWeight ?? 400,
    }))
  return dedupe(texts, (t) => `${t.content}|${t.color}|${t.fontWeight}`)
}

export function boxesIn(node: DesignNode, exclude: ReadonlySet<string> = EMPTY): DesignBox[] {
  const boxes = descendants(node, exclude)
    .filter((n) => n.type === 'frame')
    .map((n) => {
      const runs = runsOf(n)
      return {
        content: runs.join(' '),
        runs,
        background: solidColor(n.appearance?.fills),
        border: solidColor(n.appearance?.strokes),
      }
    })
    // 색이 없는 칸은 대조할 것이 없고, 글이 없는 칸은 화면에서 찾을 방법이 없다.
    .filter((box) => box.runs.length > 0 && (box.background !== null || box.border !== null))
  return dedupe(boxes, (b) => `${b.content}|${b.background}|${b.border}`)
}

/** design이 그림 하나로 뽑아 둔 자리. */
export interface DesignAsset {
  nodeId: string
  name: string
  file: string
}

export function assetsIn(node: DesignNode, exclude: ReadonlySet<string> = EMPTY): DesignAsset[] {
  return descendants(node, exclude)
    .filter((child) => child.assetRef !== undefined)
    .map((child) => ({ nodeId: child.id, name: child.name, file: child.assetRef as string }))
}

/**
 * 자산이 아이콘 단위가 아니라 **벡터 조각 단위**로 뽑힌 화면인가.
 *
 * 옛 추출기는 벡터 하나를 파일 하나로 냈다. 지금은 '벡터만 품은 가장 바깥 노드'가
 * 단위라 파일 하나가 곧 아이콘 하나다(packages/contracts의 isVectorOnlySubtree).
 * 조각 단위 파일은 아이콘으로 그릴 수 없으므로 그 화면은 그림 대조를 할 수 없다.
 *
 * 화면 목록을 손으로 들지 않는다 — 조각은 Figma가 붙이는 이름이 'Vector'다.
 * 피그마에서 다시 저장하면 이 판정이 저절로 넘어간다.
 */
export function usesVectorUnitAssets(design: DesignFile): boolean {
  const assets = assetsIn(design.root)
  return assets.length > 0 && assets.every((asset) => asset.name === 'Vector')
}

// --- DOM 쪽 -------------------------------------------------------------

// 공백은 대조에서 뺀다. Figma는 한 텍스트 노드 안에 공백을 담지만 DOM은 같은 글을
// 여러 요소로 쪼개면서 그 공백을 잃는다("지연 0건" → "지연"+"0건"). 공백을 지우면
// 두 표기가 같은 자리에서 만난다.
function squash(text: string): string {
  return text.replace(/\s+/g, '')
}

/** 이 자리의 색·굵기는 화면 상태가 정한다는 표시. 화면이 직접 단다. */
export const STATE_ATTRIBUTE = 'data-design-state'

/**
 * 이 자리의 색은 우리 규칙이 정한다는 표시(예: 'status-chip'). 화면이 직접 단다.
 *
 * 왜 필요한가. 와이어프레임의 불규칙을 따르지 않기로 한 자리는 design과 어긋나는데,
 * 그 예외를 **자리마다** 적으면 화면이 늘 때마다 목록도 는다. 규칙 이름을 달아 두면
 * 예외를 규칙에 걸 수 있고, 그러면 같은 규칙을 쓰는 자리가 몇이든 한 줄이다.
 */
export const RULE_ATTRIBUTE = 'data-design-rule'

/**
 * 화면이 어느 자산을 그렸는지 내놓는 표시(components/FigmaAsset.tsx).
 *
 * img의 src는 번들러가 만든 주소라 되짚을 수 없다. 끈이 없으면 그림이 통째로
 * 빠져도 대조가 알 수 없다 — MY-01·OPS-00에서 실제로 두 번 그랬고, 그때는
 * 사람이 스크린샷을 봐야만 잡혔다.
 */
export const ASSET_ATTRIBUTE = 'data-asset-node-id'

interface Holder {
  element: Element
  // 색이 화면 상태에 달린 자리다(빈 칸의 안내 문구, 아무것도 고르지 않은 선택지).
  // 정적 와이어프레임은 한 상태만 그리므로 이런 자리는 색을 견주지 않는다.
  stateDependent: boolean
  // 이 자리의 색을 정한 규칙 이름. 없으면 규칙이 아니라 그 자리의 색이다.
  rule: string | null
}

function isStateDependent(element: Element): boolean {
  return element.closest(`[${STATE_ATTRIBUTE}]`) !== null
}

function ruleOf(element: Element): string | null {
  return element.closest(`[${RULE_ATTRIBUTE}]`)?.getAttribute(RULE_ATTRIBUTE) ?? null
}

// 상태 클래스(hover:, focus-visible:)는 평상시 모습이 아니므로 보지 않는다. 다만
// placeholder:는 상태가 아니라 '어느 글자냐'를 가리키므로 그때만 따로 본다.
function classesFor(element: Element, prefix: string): string[] {
  return Array.from(element.classList)
    .filter((name) => name.startsWith(prefix))
    .map((name) => name.slice(prefix.length))
}

function ownColor(element: Element): string | null {
  for (const token of classesFor(element, 'text-')) {
    // text-sm처럼 색이 아닌 text- 유틸리티는 팔레트에 없으므로 걸러진다.
    const color = colorOf(token)
    if (color !== null) {
      return color
    }
  }
  return null
}

/** 글자 색은 상속된다 — 자기 자신부터 조상까지 올라가며 처음 만나는 색을 쓴다. */
function effectiveColor(holder: Holder): string | null {
  let current: Element | null = holder.element
  while (current !== null) {
    const color = ownColor(current)
    if (color !== null) {
      return color
    }
    current = current.parentElement
  }
  return null
}

/** 굵기도 상속된다. 아무 데도 없으면 브라우저 기본인 400이다. */
function effectiveWeight(holder: Holder): number {
  let current: Element | null = holder.element
  while (current !== null) {
    for (const token of classesFor(current, 'font-')) {
      const weight = FONT_WEIGHTS[token]
      if (weight !== undefined) {
        return weight
      }
    }
    current = current.parentElement
  }
  return 400
}

// 배경과 테두리는 상속되지 않는다. 그 칸이 직접 갖고 있어야 한다.
function ownPaint(element: Element, prefix: string): string | null {
  for (const token of classesFor(element, prefix)) {
    const color = colorOf(token)
    if (color !== null) {
      return color
    }
  }
  return null
}

// 입력칸의 글은 textContent가 아니라 값이나 안내 문구로 있다. 그래서 그냥
// textContent를 쓰면 입력칸을 감싼 칸(테두리를 가진 그 칸)이 자기 안의 글을 갖지
// 않은 것처럼 보인다 — design에서는 그 칸이 글을 품고 있는데도.
function visibleText(node: Node): string {
  if (node instanceof HTMLInputElement || node instanceof HTMLTextAreaElement) {
    return node.value === '' ? node.placeholder : node.value
  }
  if (node.nodeType === node.TEXT_NODE) {
    return node.nodeValue ?? ''
  }
  return Array.from(node.childNodes).map(visibleText).join('')
}

function holdersOf(container: Element, content: string): Holder[] {
  const wanted = squash(content)
  if (wanted === '') {
    return []
  }
  const holders: Holder[] = []
  // 등록 노드의 뿌리 자신도 후보다 — design에서 배경·테두리를 가진 칸이 바로
  // 그 뿌리인 경우가 있다(탭 줄의 아래 선).
  for (const element of [container, ...container.querySelectorAll('*')]) {
    if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
      if (element.value !== '' && squash(element.value) === wanted) {
        holders.push({ element, stateDependent: isStateDependent(element), rule: ruleOf(element) })
      } else if (squash(element.placeholder) === wanted) {
        // 안내 문구는 '빈 칸'이라는 상태에서만 보인다.
        holders.push({ element, stateDependent: true, rule: ruleOf(element) })
      }
      continue
    }
    if (squash(visibleText(element)) === wanted) {
      holders.push({ element, stateDependent: isStateDependent(element), rule: ruleOf(element) })
    }
  }
  return holders
}

// 이 글이 design이 그린 줄들을 **그 순서대로** 품고 있는가.
//
// 그냥 품고 있는지만 보면 우연히 맞는 자리가 생긴다. EVT-SCHED-01의 행사 당일 줄이
// 그랬다: 날짜 '08. 20'은 공백을 지우면 '08.20'이고, 같은 줄의 설명
// '2026.08.20 10:00 ~ 14:00'이 그것을 통째로 품는다. 그래서 날짜를 담지 않은 안쪽
// 칸이 줄 전체를 품은 것처럼 보였고, 진짜 줄(테두리를 가진 바깥 칸)이 후보에서
// 밀려났다.
//
// 순서를 보면 그 우연이 사라진다 — 안쪽 칸에서 '08.20'을 찾으면 그 뒤에 제목이
// 없다. design은 줄을 그린 순서대로 갖고 있고, 화면도 그 순서로 그린다.
function holdsRuns(text: string, runs: string[]): boolean {
  let at = 0
  for (const run of runs) {
    const found = text.indexOf(run, at)
    if (found === -1) {
      return false
    }
    at = found + run.length
  }
  return true
}

// 칸은 글자가 딱 맞아떨어지는 것으로 찾지 않는다. design이 비워 둔 자리를 화면이
// 안내 문구로 채우는 일이 있어서(INV-01의 '현재 학년'), 통째 글자를 견주면 한 마디
// 차이로 칸 전체를 못 찾는다. 대신 '이 줄들을 모두 품은 가장 작은 요소'를 찾는다 —
// 안쪽에 더 들어 있어도 상관없다.
function boxHoldersOf(container: Element, runs: string[]): Holder[] {
  const wanted = runs.map(squash).filter((run) => run !== '')
  if (wanted.length === 0) {
    return []
  }
  const containing = [container, ...container.querySelectorAll('*')].filter((element) =>
    holdsRuns(squash(visibleText(element)), wanted),
  )
  // 조상도 같은 줄을 품으므로, 더 안쪽 후보를 가진 것은 뺀다.
  const innermost = containing.filter(
    (element) => !containing.some((other) => other !== element && element.contains(other)),
  )
  // 다만 색을 칠한 요소가 글을 직접 담은 요소보다 바깥일 때가 많다(카드의 테두리는
  // 바깥 div에 있고 글은 그 안 button에 있다). 글이 늘지 않는 동안은 같은 칸으로
  // 보고 위로 따라 올라간다 — 글이 늘면 다른 칸이다.
  const holders = new Set<Element>()
  for (const element of innermost) {
    const text = squash(visibleText(element))
    let current: Element | null = element
    while (current !== null && squash(visibleText(current)) === text) {
      holders.add(current)
      current = current === container ? null : current.parentElement
    }
  }
  return Array.from(holders).map((element) => ({
    element,
    stateDependent: isStateDependent(element),
    rule: ruleOf(element),
  }))
}

// 같은 글이 화면에 여럿이면(탭의 건수 배지 "2"처럼) 어느 것이 어느 것인지 글만으로는
// 가릴 수 없다. 하나라도 맞으면 통과시킨다 — 없는 것을 잡는 것이 목적이지 짝을
// 맞히는 것이 목적이 아니다. 아무것도 안 맞으면 가장 안쪽 것을 보고한다.
function innermost(holders: Holder[]): Holder {
  return holders.reduce((deepest, holder) =>
    holder.element.querySelectorAll('*').length <
    deepest.element.querySelectorAll('*').length
      ? holder
      : deepest,
  )
}

// --- 대조 ---------------------------------------------------------------


export interface Difference {
  content: string
  kind: '자리 없음' | '글 없음' | '칸 없음' | '그림 없음' | '색' | '굵기' | '배경' | '테두리'
  design: string
  screen: string
  /** 이 자리의 색을 정한 규칙 이름(RULE_ATTRIBUTE). 예외를 규칙에 걸 때 쓴다. */
  rule?: string
}

function describe(color: string | null): string {
  return color === null ? '지정 없음' : tokenOf(color)
}

export function compareTexts(container: Element, texts: DesignText[]): Difference[] {
  const differences: Difference[] = []
  for (const text of texts) {
    const holders = holdersOf(container, text.content)
    if (holders.length === 0) {
      differences.push({
        content: text.content,
        kind: '글 없음',
        design: describe(text.color),
        screen: '화면에 없음',
      })
      continue
    }
    // 상태가 색을 정하는 자리는 색·굵기를 대조하지 않는다. 정적 와이어프레임은
    // 한 상태만 그리므로, design이 칠한 색은 그 상태의 색이지 지금 상태의 색이
    // 아니다. 글이 있는지는 그대로 본다.
    // some이지 every가 아니다 — 그런 자리를 감싼 바깥 칸도 같은 글을 품는다.
    if (holders.some((holder) => holder.stateDependent)) {
      continue
    }
    if (text.color !== null && !holders.some((h) => sameColor(effectiveColor(h), text.color))) {
      const holder = innermost(holders)
      differences.push({
        content: text.content,
        kind: '색',
        design: tokenOf(text.color),
        screen: describe(effectiveColor(holder)),
        ...(holder.rule === null ? {} : { rule: holder.rule }),
      })
    }
    if (!holders.some((holder) => effectiveWeight(holder) === text.fontWeight)) {
      const holder = innermost(holders)
      differences.push({
        content: text.content,
        kind: '굵기',
        design: String(text.fontWeight),
        screen: String(effectiveWeight(holder)),
        ...(holder.rule === null ? {} : { rule: holder.rule }),
      })
    }
  }
  return differences
}

export function compareBoxes(container: Element, boxes: DesignBox[]): Difference[] {
  const differences: Difference[] = []
  for (const box of boxes) {
    const holders = boxHoldersOf(container, box.runs)
    if (holders.length === 0) {
      differences.push({
        content: box.content,
        kind: '칸 없음',
        design: `배경 ${describe(box.background)} / 테두리 ${describe(box.border)}`,
        screen: '화면에 없음',
      })
      continue
    }
    if (holders.some((holder) => holder.stateDependent)) {
      continue
    }
    const elements = holders.map((holder) => holder.element)
    for (const [kind, prefix, wanted] of [
      ['배경', 'bg-', box.background],
      ['테두리', 'border-', box.border],
    ] as const) {
      if (wanted === null) {
        continue
      }
      if (!elements.some((element) => sameColor(ownPaint(element, prefix), wanted))) {
        const holder = innermost(holders)
        differences.push({
          content: box.content,
          kind,
          design: tokenOf(wanted),
          screen: describe(ownPaint(holder.element, prefix)),
          ...(holder.rule === null ? {} : { rule: holder.rule }),
        })
      }
    }
  }
  return differences
}

/** 화면이 등록 노드를 어디에 그렸는지 알리는 표시. 대조는 이 표시를 따라간다. */
export const NODE_ATTRIBUTE = 'data-node-id'

export function nodeSelector(nodeId: string): string {
  return `[${NODE_ATTRIBUTE}="${nodeId}"]`
}

interface RegisteredElement {
  source: { nodeId: string }
  // 목록의 쪽 줄은 표와 다른 자리에 그려진다(디자인이 둘을 형제로 둔다).
  // 요소 유형마다 spec의 모양이 달라 여기서는 이 한 자리만 본다.
  spec?: unknown
}

// 화면 전체를 한 자루에 넣고 글자만으로 짝지으면 엉뚱한 요소와 만난다 — "해야 할
// 업무"는 요약 칩에도 있고 탭에도 있다. 그래서 등록 노드 단위로 좁혀서 본다.
//
// 좁히려면 design 노드와 DOM 요소를 잇는 끈이 있어야 하는데, 그 끈은 화면이
// data-node-id로 내놓는다. 끈이 없으면 대조가 아니라 짐작이 되므로, 없는 것도
// 차이로 센다.
/**
 * 이 화면의 등록 노드 전부.
 *
 * 요소만 세면 **작업 공간의 갈피 줄과 상태 줄이 대조에서 통째로 빠진다** —
 * 무엇을 그리는지는 shell.json이 알고 화면은 어디에 그리는지만 갖기 때문이다.
 * 실제로 EVT-TASK-01을 공간으로 옮기자마자 상태 줄이 대조 밖으로 나갔고,
 * '쓰이지 않는 예외'가 그것을 알렸다.
 */
export function registeredNodeIds(screen: ComparableScreen): string[] {
  return [
    ...screen.elements.map((element) => element.source.nodeId),
    ...screen.elements
      .map((element) => (element.spec as { paging?: { source?: string } })?.paging?.source)
      .filter((nodeId): nodeId is string => typeof nodeId === 'string'),
    ...Object.values(screen.workspace?.source ?? {}).filter(
      (nodeId): nodeId is string => typeof nodeId === 'string',
    ),
  ]
}

export interface ComparableScreen {
  screenId: string
  elements: RegisteredElement[]
  workspace?: { source: Record<string, string | undefined> }
}

export function compareScreen(
  container: Element,
  screen: ComparableScreen,
  design: DesignFile,
): Difference[] {
  const differences: Difference[] = []
  const nodeIds = registeredNodeIds(screen)
  const registered = new Set(nodeIds)
  for (const nodeId of nodeIds) {
    const exclude = new Set([...registered].filter((id) => id !== nodeId))
    const node = findNode(design.root, nodeId)
    const holder = container.querySelector(nodeSelector(nodeId))
    if (holder === null) {
      differences.push({
        content: nodeId,
        kind: '자리 없음',
        design: node.name,
        screen: `${NODE_ATTRIBUTE}를 단 요소가 없음`,
      })
      continue
    }
    differences.push(...compareTexts(holder, textsIn(node, exclude)))
    differences.push(...compareBoxes(holder, boxesIn(node, exclude)))
  }
  return differences
}

/**
 * 같은 그림인지 가릴 때 쓰는 열쇠. Figma가 파일마다 새로 매기는 id를 지운 SVG다.
 *
 * 같은 아이콘도 자리마다 파일이 따로 나오고, 그 파일들은 `clip0_18_150` 같은
 * 일련번호만 다르다. 지우지 않으면 같은 달력 아이콘 아홉 개가 서로 다른 그림이 된다.
 */
export function drawingKey(svg: string): string {
  return (
    svg
      // 잘라내는 틀과 그것을 묶는 껍데기. 같은 아이콘인데 어떤 파일은 clipPath로
      // 감싸여 나오고 어떤 파일은 그냥 나온다 — 그려지는 것은 같다.
      // (그라디언트 정의는 남긴다. 그건 실제로 보이는 차이다.)
      .replace(/<clipPath[\s\S]*?<\/clipPath>/g, '')
      .replace(/<defs>\s*<\/defs>/g, '')
      .replace(/\sclip-path="[^"]*"/g, '')
      .replace(/<\/?g[^>]*>/g, '')
      .replace(/(?:clip|filter|paint|pattern|image)\d+_[0-9_]+/g, 'ID')
      // 좌표의 끝자리. 같은 아이콘도 자리마다 소수점 다섯째 자리가 다르게 나온다
      // (18:476은 6.12498, 18:568은 6.12501 — 눈으로는 같은 그림이다).
      // 소수 첫째 자리까지만 본다. 둘째 자리로는 위 둘이 6.12와 6.13으로 갈린다.
      // 13픽셀짜리 아이콘에서 0.1은 눈에 보이지 않는 차이다.
      .replace(/\d+\.\d+/g, (n) => Number(n).toFixed(1))
      .replace(/\s+/g, ' ')
      .trim()
  )
}

/**
 * design이 그림으로 뽑아 둔 자리를 화면이 그렸는가.
 *
 * 같은 그림이 여러 자리에 있으면 하나만 그려도 통과시킨다. design은 목록 항목마다
 * 그림을 따로 뽑지만 구현은 데이터로 되풀이해 그리므로, 어느 항목이 어느 노드인지
 * 짝지을 근거가 없다 — 글 대조가 같은 글에 대해 하는 것과 같은 이유다.
 *
 * 그래서 **내용이 다르면 다른 그림**이다. TASK-01의 지연 카드 날짜 아이콘이 빨강인
 * 것이 이 규칙으로 드러났다.
 */
export function compareAssets(
  container: Element,
  assets: DesignAsset[],
  drawingOf: (file: string) => string,
): Difference[] {
  const drawn = new Set(
    Array.from(container.querySelectorAll(`[${ASSET_ATTRIBUTE}]`)).map((element) =>
      element.getAttribute(ASSET_ATTRIBUTE),
    ),
  )
  const byDrawing = new Map<string, DesignAsset[]>()
  for (const asset of assets) {
    const key = drawingOf(asset.file)
    byDrawing.set(key, [...(byDrawing.get(key) ?? []), asset])
  }

  const differences: Difference[] = []
  for (const group of byDrawing.values()) {
    if (group.some((asset) => drawn.has(asset.nodeId))) {
      continue
    }
    const asset = group[0]
    differences.push({
      content: group.length === 1 ? `${asset.nodeId} ${asset.name}` : `${asset.nodeId} ${asset.name} 외 ${group.length - 1}`,
      kind: '그림 없음',
      design: asset.file,
      screen: `${ASSET_ATTRIBUTE}를 단 그림이 없음`,
    })
  }
  return differences
}

/**
 * 등록 노드 안의 그림을 대조한다. 셸(사이드바·헤더)의 아이콘은 등록 밖이라
 * 빠진다 — 글 대조와 같은 범위다.
 *
 * 다만 글 대조와 달리 **등록 노드로 쪼개지 않고 화면 전체를 한 자루에 넣는다.**
 * 글은 같은 글자가 여럿이면 어느 것이 어느 것인지 노드로 좁혀야 가려지지만,
 * 그림은 내용 자체가 신원이라 좁힐 필요가 없다. 오히려 좁히면 틀린다 —
 * TASK-01의 네 열이 같은 달력 아이콘을 쓰는데 열마다 design 노드가 다르다.
 */
export function compareScreenAssets(
  container: Element,
  screen: ComparableScreen,
  design: DesignFile,
  drawingOf: (file: string) => string,
): Difference[] {
  const assets = new Map<string, DesignAsset>()
  for (const nodeId of registeredNodeIds(screen)) {
    if (container.querySelector(nodeSelector(nodeId)) === null) {
      // 자리 자체가 없는 것은 compareScreen이 이미 알린다. 두 번 세지 않는다.
      continue
    }
    for (const asset of assetsIn(findNode(design.root, nodeId))) {
      assets.set(asset.nodeId, asset)
    }
  }
  return compareAssets(container, Array.from(assets.values()), drawingOf)
}

/**
 * 일부러 design과 다르게 하기로 한 자리.
 *
 * 무엇에 거느냐가 셋이다. 고르는 기준은 하나 — **화면이 늘면 이 줄도 느는가.**
 *
 * - `rule`: 우리 규칙이 정하는 색(RULE_ATTRIBUTE로 표시된 자리). 상태 칩이 몇 개든,
 *   화면이 몇이든 한 줄이다. 늘지 않는다.
 * - `color`: design의 그 색이 나오는 모든 자리. 팔레트 밖 색을 이름 있는 색으로
 *   바꾸는 경우다. 그 색이 어디에 또 쓰였든 한 줄이다. 늘지 않는다.
 * - `place`: 이 화면의 이 글. 와이어프레임이 같은 것을 두 군데에 다르게 그린
 *   일회성 사고에만 쓴다. 규칙이 아니므로 저절로 늘지도 않는다.
 *
 * design·screen 값은 대조 검사가 뱉은 줄을 그대로 옮긴 것이다 — 예외를 적는 말과
 * 검사가 말하는 말이 같다.
 */
interface DeviationBody {
  kind: Difference['kind']
  design: string
  screen: string
  why: string
}

export type Deviation =
  | (DeviationBody & { by: 'rule'; rule: string })
  | (DeviationBody & { by: 'color' })
  | (DeviationBody & { by: 'place'; screenId: string; content: string })

/** 어긋남 하나가 어느 화면 것인지까지 기억한 것. 썩음 판정에 쓴다. */
export type SeenDifference = Difference & { screenId: string }

function covers(deviation: Deviation, difference: Difference, screenId: string): boolean {
  if (
    deviation.kind !== difference.kind ||
    deviation.design !== difference.design ||
    deviation.screen !== difference.screen
  ) {
    return false
  }
  switch (deviation.by) {
    case 'rule':
      return difference.rule === deviation.rule
    case 'color':
      return true
    case 'place':
      return deviation.screenId === screenId && deviation.content === difference.content
  }
}

/** 적어 둔 예외를 덜어낸다. 남는 것이 진짜 어긋남이다. */
export function applyDeviations(
  screenId: string,
  differences: Difference[],
  deviations: Deviation[],
): Difference[] {
  return differences.filter(
    (difference) => !deviations.some((deviation) => covers(deviation, difference, screenId)),
  )
}

/**
 * 어느 화면에서도 쓰이지 않은 예외.
 *
 * 예외 목록은 썩는다 — design이 고쳐져 더는 어긋나지 않는데도 예외가 남아 있으면
 * 그 자리는 아무도 보지 않는 사각이 된다. 쓰이지 않은 예외를 실패로 다루면 목록이
 * 저절로 현재를 가리킨다.
 *
 * 화면 하나가 아니라 **전부**를 모아 판정해야 한다. 규칙에 건 예외는 여러 화면에
 * 걸쳐 쓰이므로, 화면마다 따로 물으면 안 쓰인 화면에서 거짓 경보가 난다.
 */
export function unusedDeviations(seen: SeenDifference[], deviations: Deviation[]): Deviation[] {
  return deviations.filter(
    (deviation) => !seen.some((difference) => covers(deviation, difference, difference.screenId)),
  )
}

/** 실패 메시지로 쓸 표. 어느 글이 어떻게 어긋났는지 한 줄씩 보인다. */
export function report(screenId: string, differences: Difference[]): string {
  const lines = differences.map(
    (d) =>
      `  [${d.kind}] "${d.content}"${d.rule ? ` (규칙 ${d.rule})` : ''}` +
      ` — design ${d.design} / 화면 ${d.screen}`,
  )
  return `${screenId}이(가) design과 ${differences.length}곳 어긋납니다.\n${lines.join('\n')}`
}

function deviationLabel(deviation: Deviation): string {
  switch (deviation.by) {
    case 'rule':
      return `규칙 '${deviation.rule}'`
    case 'color':
      return `design ${deviation.design}인 자리`
    case 'place':
      return `${deviation.screenId}의 "${deviation.content}"`
  }
}

/** 더는 일어나지 않는 예외. 목록에서 지우라는 뜻이다. */
export function staleReport(unused: Deviation[]): string {
  const lines = unused.map(
    (deviation) =>
      `  [${deviation.kind}] ${deviationLabel(deviation)} — 이제 design과 어긋나지 않습니다`,
  )
  return (
    `design/deviations.ts에 쓰이지 않는 예외가 ${unused.length}개 있습니다. 지우세요.\n` +
    lines.join('\n')
  )
}
