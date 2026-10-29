import { useMemo } from 'react'
import type { MeetingDetail } from '@vada/contracts'
import { isMinutesDirty, lostEntries, type MinutesScope } from './minutes-drafts'
import { hasDirtyEntry } from './minutes-entry'
import { saveAllMinutes } from './minutes-confirm'
import { useMinutesAutosave } from './use-minutes-autosave'
import { useMinutesMutation } from './use-minutes-mutation'
import { MINUTES_TEXT as T } from './minutes-text'

// 화면이 초안에서 완료 회의록으로 바뀌어도 저장소와 저장 중 요청의 수명은 같다.
export function useMinutesSession(
  key: MinutesScope,
  meeting: MeetingDetail,
  onSaved: (meeting: MeetingDetail) => void,
) {
  const scope = useMemo(
    () => ({ base: key.base, memberId: key.memberId }),
    [key.base, key.memberId],
  )
  const { drafts, store } = useMinutesAutosave(scope, meeting, onSaved)
  const mutate = useMinutesMutation(scope.base, onSaved)
  const submit = async (suffix: string, body: object) => {
    const problem = await mutate(suffix, body)
    // 안건 빼기를 확인하고 서버도 처리한 뒤에만 그 안건의 초안을 버린다.
    if (!problem && /^\/agenda\/[^/]+\/cancel$/.test(suffix)) store.forget(suffix.split('/')[2]!)
    return problem
  }
  const agendaIds = meeting.agenda.map(item => item.id)
  const orphans = [
    ...store.lostTexts(),
    ...[...drafts]
      .filter(([id, draft]) => isMinutesDirty(draft) && !agendaIds.includes(id))
      .map(([, draft]) => draft.text),
    ...lostEntries(scope, agendaIds),
  ]
  // 확정 전에 저장할 수 있는 글(살아 있는 안건의 논의 초안, 열린 폼)만 막는다. 빠진 안건의 글이나
  // 닫힌 폼에 남은 글은 저장할 곳이 없거나 지금 보이지 않아 막으면 확정할 길이 없다. 그 글은 완료 화면에도 그대로 보인다.
  const confirm = async () => {
    await saveAllMinutes(store, agendaIds)
    const live = [...store.snapshot()].some(
      ([id, draft]) => agendaIds.includes(id) && isMinutesDirty(draft),
    )
    if (live || hasDirtyEntry()) return T.confirmUnsaved
    return mutate('/confirm', {})
  }
  return { scope, drafts, store, submit, orphans, confirm }
}
