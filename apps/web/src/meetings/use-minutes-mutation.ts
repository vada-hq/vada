import { useState } from 'react'
import type { MeetingDetail, MeetingResponse } from '@vada/contracts'
import { getJson, postJson } from '@/lib/api'
import { useActive } from '@/lib/use-active'
import { meetingError } from './meeting-text'
import type { EntryUnchanged } from './minutes-entry'

// 주소 끝의 id가 가리키는 안건이나 결정.
function targetOf(meeting: MeetingDetail, suffix: string) {
  const id = suffix.split('/').at(-1)
  return (
    meeting.agenda.find(a => a.id === id) ??
    meeting.agenda.flatMap(a => a.decisions).find(d => d.id === id)
  )
}
// 고치기 충돌은 글을 그대로 둔 채 새 판을 읽는다. 다시 저장할 때만 그 판으로 시도한다.
// 다만 동시에 나간 논의 저장처럼 폼의 칸을 건드리지 않은 판(unchanged)이면 충돌이 아니므로 그 판으로 한 번 다시 보낸다.
export function useMinutesMutation(base: string, onSaved: (meeting: MeetingDetail) => void) {
  const [versions] = useState(() => new Map<string, number>())
  const isActive = useActive()
  // 새 판을 읽어 두고, 바로 다시 보내도 되는지 알린다. 화면을 떠났으면 보내지 않는다:
  // 다른 계정의 세션으로 나갈 수 있다(mtg-4 검토). 쓰던 글은 남긴 글로 되살린다.
  const reread = async (suffix: string, unchanged?: EntryUnchanged) => {
    const fresh = await getJson<MeetingResponse>(base)
    if (!fresh.ok) return false
    const item = targetOf(fresh.data.meeting, suffix)
    if (item) versions.set(suffix, item.versionNo)
    onSaved(fresh.data.meeting)
    return Boolean(item && unchanged?.(item)) && isActive()
  }
  const submit = async (
    suffix: string,
    body: object,
    unchanged?: EntryUnchanged,
  ): Promise<string | null> => {
    const version = versions.get(suffix)
    const value =
      'baseVersionNo' in body && version !== undefined ? { ...body, baseVersionNo: version } : body
    const result = await postJson<MeetingResponse>(`${base}${suffix}`, value)
    if (result.ok) {
      versions.delete(suffix)
      onSaved(result.data.meeting)
      return null
    }
    if (result.code === 'VERSION_CONFLICT' && (await reread(suffix, unchanged)))
      return submit(suffix, body)
    return meetingError(result.code)
  }
  return submit
}
