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
