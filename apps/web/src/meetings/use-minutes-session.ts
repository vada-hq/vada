import { useMemo } from 'react'
import type { MeetingDetail } from '@vada/contracts'
import { isMinutesDirty, lostEntries, type MinutesScope } from './minutes-drafts'
import { hasDirtyEntry } from './minutes-entry'
import { remainingEntryTexts, saveAllMinutes } from './minutes-confirm'
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
  const confirm = async () => {
    await saveAllMinutes(store)
    if (
      store.hasUnsaved() ||
      hasDirtyEntry() ||
      orphans.length ||
      remainingEntryTexts(scope).length
    )
      return T.confirmUnsaved
    return mutate('/confirm', {})
  }
  return { scope, drafts, store, submit, orphans, confirm }
}
