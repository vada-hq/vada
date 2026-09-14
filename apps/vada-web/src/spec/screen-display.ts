import { readObjectSource } from '../data-sources/catalog'
import { resolveParams } from './params'
import type { ScreenSpec } from './types'
import { workspaceOf } from './workspaces'

// 화면에 그려지는 제목.
//
// meta.title은 **화면의 이름**이다. 대개 그것이 그대로 제목으로 그려지지만,
// 무엇의 화면인지가 곧 제목인 자리가 있다 — 행사 업무 보드의 제목은 그 행사의
// 이름이고, 이름은 데이터에만 있다. 그럴 때 meta.titleFrom이 어디서 읽을지를
// 말하고, meta.title은 사람이 이 화면을 부르는 말로 남는다.
//
// 화면과 준수 검사가 같은 함수를 본다 — 두 곳에 적으면 언젠가 갈린다.
export function drawnTitleOf(
  screen: ScreenSpec,
  screenParams: Record<string, string> = {},
): string {
  // 작업 공간에 속하면 그 공간의 이름이 곧 제목이다 — 행사 개요의 제목도 행사
  // 업무 보드의 제목도 그 행사의 이름이다. 화면이 따로 정했으면 그것이 이긴다.
  //
  // 다만 **자기 아래에 다시 여러 화면을 거느리는 입구는 자기 이름을 앞세운다**
  // (EVT-FIN-01은 구매 요청·처리·증빙의 입구라 제목이 '행사 재정 — 개요'다).
  // 어느 쪽인지는 디자인이 말하고 명세가 workspace.ownTitle로 옮겨 적는다.
  const workspace = workspaceOf(screen)
  if (screen.workspace?.ownTitle === true) {
    return screen.meta?.title ?? screen.screenId
  }
  const from = screen.meta?.titleFrom ?? workspace?.titleFrom
  if (from === undefined) {
    return screen.meta?.title ?? screen.screenId
  }
  const params =
    screen.meta?.titleFrom !== undefined
      ? resolveParams(screen.meta.titleFrom.params, { screenParams })
      : { [workspace!.param]: screenParams[workspace!.param] ?? '' }
  return String(readObjectSource(from.dataSourceKey, params)[from.field])
}

// meta.title이 화면에 그려지기를 기대할 수 있는가.
//
// 예전에는 화면 이름을 손으로 적은 목록이었다. 이제 대부분은 규칙으로 답한다 —
// **제목이 데이터에서 오면 meta.title은 화면을 부르는 말일 뿐이다.** 행사 개요의
// 제목은 그 행사의 이름이고, `행사 개요`는 어디에도 그려지지 않는다. 그리는 자리가
// 따로 있는 화면도 있지만(EVT-TASK-01은 보드의 머리에 그린다) 그것은 화면의 선택이라
// 기대로 삼지 않는다.
//
// 규칙으로 답할 수 없는 것이 하나 남았다: INV-01의 design(14:1)에는 화면 제목이
// 아예 없고 그 자리를 요약 카드가 대신한다. 데이터에서 오는 것도 아니다.
const TITLE_NOT_DRAWN = new Set(['INV-01'])

export function drawsTitle(screen: ScreenSpec): boolean {
  if (TITLE_NOT_DRAWN.has(screen.screenId)) {
    return false
  }
  // 자기 이름을 앞세우는 입구는 제목이 곧 meta.title이다.
  if (screen.workspace?.ownTitle === true) {
    return true
  }
  return screen.meta?.titleFrom === undefined && workspaceOf(screen)?.titleFrom === undefined
}

