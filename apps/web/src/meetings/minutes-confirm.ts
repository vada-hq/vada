import type { MeetingDetail } from '@vada/contracts'
import { keptEntry, lostEntries, type minutesDrafts, type MinutesScope } from './minutes-drafts'

export function minutesCounts(meeting: MeetingDetail) {
  return meeting.agenda.reduce(
    (total, item) => ({
      decisions: total.decisions + item.decisions.length,
      followUps: total.followUps + item.followUps.length,
      empty:
        total.empty +
        Number(!item.notes?.trim() && !item.decisions.length && !item.followUps.length),
    }),
    { decisions: 0, followUps: 0, empty: 0 },
  )
}

// 저장 중 이어 쓴 글은 저장소가 다음 요청으로 보낸다. 그 요청까지 끝나야 확정한다.
export async function saveAllMinutes(store: ReturnType<typeof minutesDrafts>) {
  let ids = [...store.snapshot().keys()]
  while (ids.length) {
    await Promise.all(ids.map(id => store.save(id)))
    ids = [...store.snapshot()].filter(([, draft]) => draft.saving).map(([id]) => id)
  }
}

// 완료 화면에서는 살아 있는 안건에 남은 확정 전 폼 글도 읽을 수 있게 보인다.
export function remainingEntryTexts(scope: MinutesScope, activeForm?: string) {
  const added = keptEntry(scope, 'agenda:new')
  const active = activeForm ? keptEntry(scope, activeForm)?.text : undefined
  return [...lostEntries(scope, []), ...(added ? [added.text] : [])].filter(text => text !== active)
}
