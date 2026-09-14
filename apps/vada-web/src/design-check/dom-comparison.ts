import { FONT_WEIGHTS, colorOf, sameColor, tokenOf } from './palette'
import type { DesignBox, DesignText } from './design-model'

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
        // 어긋났다고 알릴 때는 **실제로 칠한 요소**를 고른다. 색은 바깥 칸에
        // 있고 글은 그 안 껍데기에 있는 일이 흔한데, 가장 안쪽만 보면 '지정
        // 없음'이라 알린다 — 화면은 칠했는데 안 칠했다고 하는 셈이고, 일부러
        // 어긋나기로 한 자리(deviations)가 어긋남을 숨긴 자리처럼 보인다.
        const painted = holders.find(
          (candidate) => ownPaint(candidate.element, prefix) !== null,
        )
        const holder = painted ?? innermost(holders)
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
