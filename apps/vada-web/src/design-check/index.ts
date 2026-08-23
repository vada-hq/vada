import { FONT_WEIGHTS, colorOf, tokenOf } from './palette'

// figma.design.json과 실제로 그려진 DOM을 대조한다.
//
// 왜 필요한가. 명세(screen.json)는 무엇을 어디서 읽는지를 갖고, 시각은 design이
// 갖는다. 그런데 구현이 design을 자동으로 읽지는 않으므로, 사람이 Tailwind 클래스를
// 손으로 고른다. 손으로 고른 것은 어긋나고, 어긋나도 아무도 모른다. 화면이 늘수록
// 어긋난 자리도 늘어난다 — 인스턴스가 아니라 계급을 고쳐야 한다.
//
// 무엇을 대조하고 무엇을 대조하지 않는가.
//
// - 대조한다: 글의 내용, 글자 색, 글자 굵기, 칸의 배경색과 테두리색.
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
// - 같은 글이 여럿이면 하나만 맞아도 통과시킨다. 없는 것을 잡는 것이 목적이지
//   짝을 맞히는 것이 목적이 아니다.

export interface DesignFill {
  type: string
  color?: string
  opacity?: number
}

export interface DesignNode {
  id: string
  type: string
  name: string
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
  content: string
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

function descendants(node: DesignNode): DesignNode[] {
  const all: DesignNode[] = []
  const visit = (current: DesignNode) => {
    all.push(current)
    for (const child of current.children ?? []) {
      visit(child)
    }
  }
  visit(node)
  return all
}

// 투명한 칠(opacity 0)은 자리를 맞추려고 둔 것이지 보이는 색이 아니다.
function solidColor(paints: DesignFill[] | undefined): string | null {
  const paint = (paints ?? []).find((p) => p.type === 'solid' && p.opacity !== 0)
  return paint?.color?.toUpperCase() ?? null
}

function textOf(node: DesignNode): string {
  return descendants(node)
    .filter((n) => n.type === 'text' && n.text)
    .map((n) => n.text?.content ?? '')
    .join('')
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

export function textsIn(node: DesignNode): DesignText[] {
  const texts = descendants(node)
    .filter((n) => n.type === 'text' && n.text)
    .map((n) => ({
      content: n.text?.content ?? '',
      color: solidColor(n.appearance?.fills),
      fontWeight: n.text?.style.fontWeight ?? 400,
    }))
  return dedupe(texts, (t) => `${t.content}|${t.color}|${t.fontWeight}`)
}

export function boxesIn(node: DesignNode): DesignBox[] {
  const boxes = descendants(node)
    .filter((n) => n.type === 'frame')
    .map((n) => ({
      content: textOf(n),
      background: solidColor(n.appearance?.fills),
      border: solidColor(n.appearance?.strokes),
    }))
    // 색이 없는 칸은 대조할 것이 없고, 글이 없는 칸은 화면에서 찾을 방법이 없다.
    .filter((box) => box.content !== '' && (box.background !== null || box.border !== null))
  return dedupe(boxes, (b) => `${b.content}|${b.background}|${b.border}`)
}

// --- DOM 쪽 -------------------------------------------------------------

// 공백은 대조에서 뺀다. Figma는 한 텍스트 노드 안에 공백을 담지만 DOM은 같은 글을
// 여러 요소로 쪼개면서 그 공백을 잃는다("지연 0건" → "지연"+"0건"). 공백을 지우면
// 두 표기가 같은 자리에서 만난다.
function squash(text: string): string {
  return text.replace(/\s+/g, '')
}

interface Holder {
  element: Element
  /** 글이 textContent가 아니라 입력칸의 안내 문구로 있는 경우. */
  viaPlaceholder: boolean
}

// 상태 클래스(hover:, focus-visible:)는 평상시 모습이 아니므로 보지 않는다. 다만
// placeholder:는 상태가 아니라 '어느 글자냐'를 가리키므로 그때만 따로 본다.
function classesFor(element: Element, prefix: string): string[] {
  return Array.from(element.classList)
    .filter((name) => name.startsWith(prefix))
    .map((name) => name.slice(prefix.length))
}

function ownColor(element: Element, holder: Holder): string | null {
  const prefixes = holder.viaPlaceholder ? ['placeholder:text-', 'text-'] : ['text-']
  for (const prefix of prefixes) {
    for (const token of classesFor(element, prefix)) {
      // text-sm처럼 색이 아닌 text- 유틸리티는 팔레트에 없으므로 걸러진다.
      const color = colorOf(token)
      if (color !== null) {
        return color
      }
    }
  }
  return null
}

/** 글자 색은 상속된다 — 자기 자신부터 조상까지 올라가며 처음 만나는 색을 쓴다. */
function effectiveColor(holder: Holder): string | null {
  let current: Element | null = holder.element
  while (current !== null) {
    const color = ownColor(current, holder)
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
        holders.push({ element, viaPlaceholder: false })
      } else if (squash(element.placeholder) === wanted) {
        holders.push({ element, viaPlaceholder: true })
      }
      continue
    }
    if (squash(visibleText(element)) === wanted) {
      holders.push({ element, viaPlaceholder: false })
    }
  }
  return holders
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
  kind: '자리 없음' | '글 없음' | '칸 없음' | '색' | '굵기' | '배경' | '테두리'
  design: string
  screen: string
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
    if (text.color !== null && !holders.some((h) => effectiveColor(h) === text.color)) {
      differences.push({
        content: text.content,
        kind: '색',
        design: tokenOf(text.color),
        screen: describe(effectiveColor(innermost(holders))),
      })
    }
    if (!holders.some((h) => effectiveWeight(h) === text.fontWeight)) {
      differences.push({
        content: text.content,
        kind: '굵기',
        design: String(text.fontWeight),
        screen: String(effectiveWeight(innermost(holders))),
      })
    }
  }
  return differences
}

export function compareBoxes(container: Element, boxes: DesignBox[]): Difference[] {
  const differences: Difference[] = []
  for (const box of boxes) {
    const holders = holdersOf(container, box.content)
    if (holders.length === 0) {
      differences.push({
        content: box.content,
        kind: '칸 없음',
        design: `배경 ${describe(box.background)} / 테두리 ${describe(box.border)}`,
        screen: '화면에 없음',
      })
      continue
    }
    const elements = holders.map((holder) => holder.element)
    if (
      box.background !== null &&
      !elements.some((element) => ownPaint(element, 'bg-') === box.background)
    ) {
      differences.push({
        content: box.content,
        kind: '배경',
        design: tokenOf(box.background),
        screen: describe(ownPaint(innermost(holders).element, 'bg-')),
      })
    }
    if (
      box.border !== null &&
      !elements.some((element) => ownPaint(element, 'border-') === box.border)
    ) {
      differences.push({
        content: box.content,
        kind: '테두리',
        design: tokenOf(box.border),
        screen: describe(ownPaint(innermost(holders).element, 'border-')),
      })
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
}

// 화면 전체를 한 자루에 넣고 글자만으로 짝지으면 엉뚱한 요소와 만난다 — "해야 할
// 업무"는 요약 칩에도 있고 탭에도 있다. 그래서 등록 노드 단위로 좁혀서 본다.
//
// 좁히려면 design 노드와 DOM 요소를 잇는 끈이 있어야 하는데, 그 끈은 화면이
// data-node-id로 내놓는다. 끈이 없으면 대조가 아니라 짐작이 되므로, 없는 것도
// 차이로 센다.
export function compareScreen(
  container: Element,
  screen: { screenId: string; elements: RegisteredElement[] },
  design: DesignFile,
): Difference[] {
  const differences: Difference[] = []
  for (const element of screen.elements) {
    const nodeId = element.source.nodeId
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
    differences.push(...compareTexts(holder, textsIn(node)))
    differences.push(...compareBoxes(holder, boxesIn(node)))
  }
  return differences
}

/** 실패 메시지로 쓸 표. 어느 글이 어떻게 어긋났는지 한 줄씩 보인다. */
export function report(screenId: string, differences: Difference[]): string {
  const lines = differences.map(
    (d) => `  [${d.kind}] "${d.content}" — design ${d.design} / 화면 ${d.screen}`,
  )
  return `${screenId}이(가) design과 ${differences.length}곳 어긋납니다.\n${lines.join('\n')}`
}
