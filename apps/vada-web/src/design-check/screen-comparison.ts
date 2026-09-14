import { assetsIn, boxesIn, findNode, textsIn, type DesignAsset, type DesignFile } from './design-model'
import { ASSET_ATTRIBUTE, compareBoxes, compareTexts, type Difference } from './dom-comparison'

/** 화면이 등록 노드를 어디에 그렸는지 알리는 표시. 대조는 이 표시를 따라간다. */
export const NODE_ATTRIBUTE = 'data-node-id'

export function nodeSelector(nodeId: string): string {
  return `[${NODE_ATTRIBUTE}="${nodeId}"]`
}

interface RegisteredElement {
  // alsoDrawnAt은 **같은 자리를 다른 값으로 그린 사본들**이다. 하나만 등록하고
  // 나머지를 사본으로 본다(itemFields가 목록에서 하는 것과 같은 생각).
  //
  // **없을 수 있다.** 그림에 없는데 사람이 두기로 정한 요소는 source 대신
  // addedByDecision을 갖는다(EXT-01B의 '다시 입력'). 견줄 그림이 없으므로
  // 대조는 그런 요소를 통째로 건너뛴다 — 여기서 빠지면 그 뒤가 전부 빠진다.
  source?: { nodeId: string; alsoDrawnAt?: string[] }
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
  // 되풀이되는 항목의 칸도 등록 노드다. design은 항목을 넷 그렸지만 명세가 적은
  // 것은 첫째 하나이고, 화면도 그 자리에만 끈을 단다 — 둘째부터는 같은 틀이라
  // 대조할 새 사실이 없다.
  const drawn = screen.elements.filter(
    (element): element is RegisteredElement & { source: { nodeId: string } } =>
      element.source !== undefined,
  )
  const itemFields = drawn.flatMap(
    (element) => (element.spec as { itemFields?: RegisteredElement[] })?.itemFields ?? [],
  )
  return [
    ...drawn.map((element) => element.source.nodeId),
    // 한 자리를 여러 번 그린 그림. 나머지 사본은 **같은 요소**가 덮는다 —
    // 되풀이되는 묶음의 첫 벌만 등록하는 것과 같은 생각이다.
    ...drawn.flatMap((element) => element.source.alsoDrawnAt ?? []),
    ...itemFields
      .map((element) => element.source?.nodeId)
      .filter((nodeId): nodeId is string => typeof nodeId === 'string'),
    ...drawn
      .map((element) => (element.spec as { paging?: { source?: string } })?.paging?.source)
      .filter((nodeId): nodeId is string => typeof nodeId === 'string'),
    ...Object.values(screen.workspace?.source ?? {}).filter(
      (nodeId): nodeId is string => typeof nodeId === 'string',
    ),
    ...(typeof screen.breadcrumb?.source === 'string' ? [screen.breadcrumb.source] : []),
  ]
}

export interface ComparableScreen {
  screenId: string
  elements: RegisteredElement[]
  workspace?: { source: Record<string, string | undefined> }
  breadcrumb?: { source: string }
}

export function compareScreen(
  container: Element,
  screen: ComparableScreen,
  design: DesignFile,
): Difference[] {
  const differences: Difference[] = []
  const nodeIds = registeredNodeIds(screen)
  const registered = new Set(nodeIds)
  // **한 자리를 여러 값으로 그린 사본은 한 번에 하나만 그려진다.** 그것이 그
  // 어휘의 뜻이다 — 참석 확인의 결과 여섯은 서로 배타적이라 한 사람에게 하나만
  // 온다. 그래서 사본이 화면에 없는 것은 어긋남이 아니다.
  //
  // 다만 **있으면 대조한다.** 지금 그려진 것이 어느 사본이든 그 자리의 글과 색은
  // 그림과 같아야 한다. 자산 대조가 이미 같은 규칙으로 돈다.
  const copies = new Set(
    screen.elements.flatMap((element) => element.source?.alsoDrawnAt ?? []),
  )
  for (const nodeId of nodeIds) {
    const exclude = new Set([...registered].filter((id) => id !== nodeId))
    const node = findNode(design.root, nodeId)
    const holder = container.querySelector(nodeSelector(nodeId))
    if (holder === null) {
      if (copies.has(nodeId)) {
        continue
      }
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
