import { useState } from 'react'
import type { MeetingDetail, MeetingResponse } from '@vada/contracts'
import { getJson, postJson } from '@/lib/api'
import { meetingError } from './meeting-text'

// 고치기 충돌은 글을 그대로 둔 채 새 판을 읽는다. 다시 저장할 때만 그 판으로 시도한다.
export function useMinutesMutation(base: string, onSaved: (meeting: MeetingDetail) => void) {
  const [versions] = useState(() => new Map<string, number>())
  const submit = async (suffix: string, body: object) => {
    const version = versions.get(suffix)
    const value =
      'baseVersionNo' in body && version !== undefined ? { ...body, baseVersionNo: version } : body
    const result = await postJson<MeetingResponse>(`${base}${suffix}`, value)
    if (result.ok) {
      versions.delete(suffix)
      onSaved(result.data.meeting)
      return null
    }
    if (result.code === 'VERSION_CONFLICT') {
      const fresh = await getJson<MeetingResponse>(base)
      if (fresh.ok) {
        const id = suffix.split('/').at(-1)
        const item =
          fresh.data.meeting.agenda.find(a => a.id === id) ??
          fresh.data.meeting.agenda.flatMap(a => a.decisions).find(d => d.id === id)
        if (item) versions.set(suffix, item.versionNo)
        onSaved(fresh.data.meeting)
      }
    }
    return meetingError(result.code)
  }
  return submit
}
