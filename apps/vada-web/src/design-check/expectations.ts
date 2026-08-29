import {
  assetsIn,
  boxesIn,
  findNode,
  registeredNodeIds,
  textsIn,
  type ComparableScreen,
  type DesignFile,
} from '.'
import { utilityColorOf, weightNameOf } from './palette'

// design이 무엇을 말하는지 **그리기 전에** 알려준다.
//
// 지금까지 이 폴더의 지식은 한 방향으로만 쓰였다: 다 그린 뒤에 어긋난 곳을 세는
// 것. 그래서 화면 하나를 만들 때마다 색과 굵기를 눈으로 옮겨 적고, 게이트가 틀린
// 자리를 알려주면 고치고, 다시 돌리는 되돌이를 했다.
//
// 같은 표를 반대로 읽으면 그 되돌이가 없어진다 — 견주는 데 쓰는 값이 곧 받아쓸
// 값이다. 대조가 약해지지도 않는다: 대조는 여전히 **그려진 DOM**과 design을
// 견주고, 이 도구는 그 사이에 아무것도 끼지 않는다. 다만 대조가 잡던 것 중
// '내가 색을 잘못 봤다'는 없어진다 — 그건 이 도구가 아예 만들지 않는 잘못이다.
//
// **자리·크기·여백은 말하지 않는다.** 대조가 보지 않는 것을 여기서 말하면
// 명세가 표현을 정하게 된다. 여기서 나오는 것은 대조가 보는 다섯 가지뿐이다:
// 글·글자 색·글자 굵기·배경색·테두리색, 그리고 그림이 놓인 자리.

export interface TextExpectation {
  content: string
  /** `text-gray-900`처럼 그대로 쓸 수 있는 유틸리티. 색이 없으면 null. */
  colorClass: string | null
  /** `font-bold`. 400이면 적을 것이 없어 null. */
  weightClass: string | null
}

export interface BoxExpectation {
  content: string
  backgroundClass: string | null
  borderClass: string | null
}

export interface AssetExpectation {
  nodeId: string
  name: string
}

export interface NodeExpectation {
  nodeId: string
  /** 이 노드를 등록한 요소의 유형. 등록만 되고 요소가 아니면 null(갈피 줄 등). */
  elementType: string | null
  texts: TextExpectation[]
  boxes: BoxExpectation[]
  assets: AssetExpectation[]
}

function textExpectation(color: string | null, fontWeight: number, content: string) {
  return {
    content,
    colorClass: color === null ? null : `text-${utilityColorOf(color)}`,
    weightClass: weightNameOf(fontWeight) === null ? null : `font-${weightNameOf(fontWeight)}`,
  }
}

/**
 * 이 화면의 등록 노드마다, 그 안에 design이 그려 둔 것.
 *
 * 등록 노드 목록은 대조와 **같은 함수**에서 온다(registeredNodeIds). 목록이
 * 갈리면 알려준 자리와 견주는 자리가 달라져 도구가 거짓말을 한다.
 */
export function expectationsOf(
  screen: ComparableScreen,
  design: DesignFile,
): NodeExpectation[] {
  const typeByNodeId = new Map<string, string>()
  for (const element of screen.elements) {
    const type = (element.spec as { type?: unknown })?.type
    if (typeof type === 'string') {
      if (element.source !== undefined) typeByNodeId.set(element.source.nodeId, type)
    }
    for (const field of (element.spec as { itemFields?: typeof screen.elements })?.itemFields ??
      []) {
      const fieldType = (field.spec as { type?: unknown })?.type
      if (typeof fieldType === 'string') {
        if (field.source !== undefined) typeByNodeId.set(field.source.nodeId, fieldType)
      }
    }
  }

  return registeredNodeIds(screen).map((nodeId) => {
    const node = findNode(design.root, nodeId)
    return {
      nodeId,
      elementType: typeByNodeId.get(nodeId) ?? null,
      texts: textsIn(node).map((text) =>
        textExpectation(text.color, text.fontWeight, text.content),
      ),
      boxes: boxesIn(node).map((box) => ({
        content: box.content,
        backgroundClass: box.background === null ? null : `bg-${utilityColorOf(box.background)}`,
        borderClass: box.border === null ? null : `border-${utilityColorOf(box.border)}`,
      })),
      assets: assetsIn(node).map((asset) => ({ nodeId: asset.nodeId, name: asset.name })),
    }
  })
}

function line(indent: number, text: string): string {
  return `${' '.repeat(indent)}${text}`
}

/** 사람이 읽고 그대로 옮겨 적을 수 있는 꼴로. */
export function formatExpectations(
  screenId: string,
  expectations: NodeExpectation[],
): string {
  const out: string[] = [`${screenId} — design이 등록 노드 ${expectations.length}곳에 그려 둔 것`, '']

  for (const node of expectations) {
    out.push(`${node.nodeId}${node.elementType === null ? '' : `  (${node.elementType})`}`)

    if (node.texts.length > 0) {
      out.push(line(2, '글'))
      for (const text of node.texts) {
        const classes = [text.colorClass, text.weightClass].filter(Boolean).join(' ')
        out.push(line(4, `${JSON.stringify(text.content)}  →  ${classes || '(기본)'}`))
      }
    }

    if (node.boxes.length > 0) {
      out.push(line(2, '칸'))
      for (const box of node.boxes) {
        const classes = [box.backgroundClass, box.borderClass].filter(Boolean).join(' ')
        out.push(line(4, `${JSON.stringify(box.content)}  →  ${classes}`))
      }
    }

    if (node.assets.length > 0) {
      out.push(line(2, '그림'))
      for (const asset of node.assets) {
        out.push(line(4, `${asset.nodeId}  ${asset.name}`))
      }
    }

    if (node.texts.length + node.boxes.length + node.assets.length === 0) {
      out.push(line(2, '(대조할 것이 없다)'))
    }
    out.push('')
  }

  out.push('- 그릴 때 지킬 것 -')
  out.push('· 값 하나가 **제 요소**를 가져야 대조가 짚는다. 옆의 단추와 한 덩이로')
  out.push('  두면 그 글이 없는 것으로 보인다(실제로 겪었다: 자료 이름이 옆의')
  out.push("  '열기'와 붙어 있어 대조가 못 찾았다). 값마다 <span>으로 감싸라.")
  out.push('· 색은 코드에 박지 말고 design/tones.ts의 표를 쓴다. 표에 없으면')
  out.push('  만들 자리인지 먼저 묻는다 - 화면마다 표가 늘면 규칙이 아니게 된다.')
  out.push('· 여기 없는 것은 대조도 보지 않는다: 여백·크기·자리·글자 크기.')

  return out.join('\n')
}
