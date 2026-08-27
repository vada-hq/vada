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
  spec?: {
    title?: string
    label?: string
    itemFields?: ElementEntry[]
    action?: { type?: string; note?: string }
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
export function pendingNoteOf(screenId: string, name: string): string {
  const spec = JSON.parse(
    readFileSync(join(SCREENS_DIR, screenId, 'screen.json'), 'utf-8'),
  ) as { elements?: ElementEntry[] }

  const walk = (entries: ElementEntry[]): ElementEntry[] =>
    entries.flatMap((entry) => [entry, ...walk(entry.spec?.itemFields ?? [])])

  const found = walk(spec.elements ?? []).find(
    (entry) => entry.spec?.title === name || entry.spec?.label === name,
  )
  const action =
    found?.spec?.action ?? found?.spec?.itemAction ?? found?.spec?.emptyAction
  if (action?.type !== 'pending' || action.note === undefined) {
    throw new Error(`${screenId}의 '${name}'는 pending이 아니거나 note가 없습니다.`)
  }
  return action.note
}
