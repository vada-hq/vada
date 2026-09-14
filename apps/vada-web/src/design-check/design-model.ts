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
