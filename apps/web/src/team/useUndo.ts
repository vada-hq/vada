import { useState } from 'react'
import { PEOPLE_ERRORS, SAVE_FAILED } from '@/lib/messages'
import type { TeamChange, Undoable } from './person-changes'
import type { Team } from './useTeam'

type Shown = {
  text: string
  undo: TeamChange
  changesMe: boolean
  error: string | null
  at: number
}

// 확인 창 없이 저장한 바꾸기와 되돌리기 토스트(기능 023 정한 것 5). 한 번에 하나이고 새 것이 옛 것을 바꾼다.
// run은 바꾸기를 보내고 실패하면 오류 코드를 돌려주는 사람 화면의 요청(문구는 거기서 보인다)이다.
// 되돌리기도 같은 편성 API로 보내고, 실패하면 토스트 자리에 오류를 보인다. 내 소속을 되돌렸으면 학생회를 다시 읽는다.
export function useUndo(
  team: Team,
  run: (path: string, body: unknown, changesMe: boolean) => Promise<string | null>,
  onOwnChange: () => void,
) {
  const [shown, setShown] = useState<Shown | null>(null)
  async function save(item: Undoable, changesMe: boolean) {
    if (team.saving) return
    setShown(null)
    const code = await run(item.change.path, item.change.body, changesMe)
    if (code === null)
      setShown({ text: item.text, undo: item.undo, changesMe, error: null, at: Date.now() })
  }
  async function undo() {
    if (!shown || team.saving) return
    const code = await team.change(shown.undo.path, shown.undo.body)
    if (code === null) {
      setShown(null)
      if (shown.changesMe) onOwnChange()
      return
    }
    setShown({ ...shown, error: PEOPLE_ERRORS[code] ?? SAVE_FAILED })
  }
  return { shown, save, undo, dismiss: () => setShown(null) }
}
