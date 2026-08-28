import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

// 시나리오 검사가 그리는 글을 손으로 옮겨 적으면 명세와 두 벌이 된다. 사람에게
// 보일 글은 명세가 갖고 있으므로 거기서 읽는다 — 준수 검사가 하는 것과 같다.
const SCREENS_DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../../specs/figma/vada-wireframe/screens',
)

interface ScreenParam {
  key: string
  optional?: boolean
  missingNote?: string
}

export function missingNoteOf(screenId: string, paramKey: string): string {
  const spec = JSON.parse(
    readFileSync(join(SCREENS_DIR, screenId, 'screen.json'), 'utf-8'),
  ) as { params?: ScreenParam[] }
  const note = (spec.params ?? []).find((param) => param.key === paramKey)?.missingNote
  if (note === undefined) {
    // 조용히 빈 문자열을 돌려주면 toContainText가 무엇이든 통과한다.
    throw new Error(`${screenId}의 인자 '${paramKey}'에 missingNote가 없습니다.`)
  }
  return note
}

interface ElementEntry {
  source?: { nodeId?: string }
  spec?: {
    title?: string
    label?: string
    itemFields?: ElementEntry[]
    action?: { type?: string; note?: string; onSuccess?: { note?: string } }
    itemAction?: { type?: string; note?: string }
    emptyAction?: { type?: string; note?: string }
  }
}

/**
 * 아직 명세되지 않은 화면으로 가는 자리의 글. 제목이나 이름으로 그 요소를 찾는다.
 *
 * 여기 있는 이유는 missingNoteOf와 같다 — 이 글을 검사에 옮겨 적으면 명세와
 * 두 벌이 되고, 명세를 고쳤을 때 검사가 조용히 낡는다.
 *
 * 되풀이되는 묶음 **안**도 본다. 조직도의 '＋ 부서장 지정'처럼 안쪽 목록이
 * 자기 동작을 갖는 자리가 있기 때문이다.
 */
/**
 * 등록 노드로 짚어 '아직 정해지지 않았다'는 글을 읽는다.
 *
 * 이름으로 찾는 pendingNoteOf가 못 가르는 자리가 있다 — EVT-03B에서 '부서 추가'가
 * 칸의 라벨이면서 단추의 이름이다(디자인이 그렇게 그렸다). 이름이 겹치면 첫 요소를
 * 집고 엉뚱한 것을 던진다. 노드 id는 겹치지 않는다.
 */
export function pendingNoteAt(screenId: string, nodeId: string): string {
  const spec = JSON.parse(
    readFileSync(join(SCREENS_DIR, screenId, 'screen.json'), 'utf-8'),
  ) as { elements?: ElementEntry[] }

  const walk = (entries: ElementEntry[]): ElementEntry[] =>
    entries.flatMap((entry) => [entry, ...walk(entry.spec?.itemFields ?? [])])

  const found = walk(spec.elements ?? []).find((entry) => entry.source?.nodeId === nodeId)
  const action = found?.spec?.action ?? found?.spec?.itemAction ?? found?.spec?.emptyAction
  if (action?.type !== 'pending' || action.note === undefined) {
    throw new Error(`${screenId}의 ${nodeId}는 pending이 아니거나 note가 없습니다.`)
  }
  return action.note
}

/**
 * **보내고 난 뒤**가 아직 정해지지 않았다는 글(action.onSuccess.note).
 *
 * pendingNoteOf가 읽는 것은 누르기 전의 pending이고 이것은 보낸 뒤의 자리다.
 * 검사가 그 글을 옮겨 적으면 두 벌이 되고, 명세를 고쳐도 초록이면 그 검사는
 * 아무것도 지키지 않는다.
 */
export function successNoteAt(screenId: string, nodeId: string): string {
  const spec = JSON.parse(
    readFileSync(join(SCREENS_DIR, screenId, 'screen.json'), 'utf-8'),
  ) as { elements?: ElementEntry[] }

  const walk = (entries: ElementEntry[]): ElementEntry[] =>
    entries.flatMap((entry) => [entry, ...walk(entry.spec?.itemFields ?? [])])

  const found = walk(spec.elements ?? []).find((entry) => entry.source?.nodeId === nodeId)
  const note = found?.spec?.action?.onSuccess?.note
  if (note === undefined) {
    throw new Error(`${screenId}의 ${nodeId}에는 onSuccess.note가 없습니다.`)
  }
  return note
}

export function pendingNoteOf(screenId: string, name: string): string {
  const spec = JSON.parse(
    readFileSync(join(SCREENS_DIR, screenId, 'screen.json'), 'utf-8'),
  ) as { elements?: ElementEntry[] }

  const walk = (entries: ElementEntry[]): ElementEntry[] =>
    entries.flatMap((entry) => [entry, ...walk(entry.spec?.itemFields ?? [])])

  // **빈 상태의 단추는 이름이 emptyAction 안에 있다.** 제목 없는 목록이 비었을 때가
  // 그 자리인데, title·label만 보면 짚지 못해 검사가 명세의 글을 옮겨 적게 된다.
  const entries = walk(spec.elements ?? [])
  const byEmpty = entries.find((entry) => entry.spec?.emptyAction?.label === name)
  const found =
    byEmpty ??
    entries.find((entry) => entry.spec?.title === name || entry.spec?.label === name)
  const action =
    byEmpty === undefined
      ? (found?.spec?.action ?? found?.spec?.itemAction ?? found?.spec?.emptyAction)
      : byEmpty.spec?.emptyAction
  if (action?.type !== 'pending' || action.note === undefined) {
    throw new Error(`${screenId}의 '${name}'는 pending이 아니거나 note가 없습니다.`)
  }
  return action.note
}
