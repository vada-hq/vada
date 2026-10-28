import { useRef, useState } from 'react'
import {
  statusOf,
  type CreateMeetingRequest,
  type MeetingDetail,
  type MeetingResponse,
} from '@vada/contracts'
import { getJson, postJson, type ApiResult } from '@/lib/api'
import { useActive } from '@/lib/use-active'
import { meetingBase, meetingUpdate, sameAttendees } from './meeting-form'
import { meetingError } from './meeting-text'

type Failure = Extract<ApiResult<MeetingResponse>, { ok: false }>
type SaveState = {
  previous: ReturnType<typeof meetingBase> | null
  version: number
  people: string[]
  saved: MeetingDetail | null
}
type SaveContext = { state: SaveState; fail: (result: Failure) => Promise<string> }
async function createMeeting(
  base: string,
  value: CreateMeetingRequest,
  { state, fail }: SaveContext,
) {
  const result = await postJson<MeetingResponse>(base, value)
  if (!result.ok) return fail(result)
  state.saved = result.data.meeting
  return null
}
async function saveMeeting(
  base: string,
  item: MeetingDetail | undefined,
  value: CreateMeetingRequest,
  context: SaveContext,
) {
  if (!item) return createMeeting(base, value, context)
  const { state, fail } = context
  const parsed = meetingUpdate(value, state.previous!, state.version)
  if (!parsed.success) return meetingError('INVALID_INPUT')
  const result = await postJson<MeetingResponse>(`${base}/${item.id}`, parsed.data)
  if (!result.ok) return fail(result)
  state.saved = result.data.meeting
  state.previous = value
  state.version = result.data.meeting.versionNo
  const previousPeople = state.people.filter(id => id !== item.createdBy?.id)
  if (sameAttendees(value.attendeeIds, previousPeople)) return null
  const attendees = await postJson<MeetingResponse>(`${base}/${item.id}/attendees`, {
    attendeeIds: value.attendeeIds,
  })
  if (!attendees.ok) return fail(attendees)
  state.saved = attendees.data.meeting
  state.version = attendees.data.meeting.versionNo
  state.people = value.attendeeIds
  return null
}
export function useMeetingSave(
  base: string,
  item: MeetingDetail | undefined,
  onForbidden: () => void,
) {
  const state = useRef<SaveState>({
    previous: item ? meetingBase(item) : null,
    version: item?.versionNo ?? 1,
    people: item?.attendees.map(person => person.id) ?? [],
    saved: null,
  })
  const [conflict, setConflict] = useState<MeetingDetail | null>(null)
  const active = useActive()
  const fail = async (result: Failure) => {
    if (result.status === statusOf('FORBIDDEN')) onForbidden()
    if (item && result.code === 'VERSION_CONFLICT') {
      const fresh = await getJson<MeetingResponse>(`${base}/${item.id}`)
      if (fresh.ok && active()) {
        state.current.version = fresh.data.meeting.versionNo
        setConflict(fresh.data.meeting)
      }
    }
    return meetingError(result.code)
  }
  return {
    save: (value: CreateMeetingRequest) =>
      saveMeeting(base, item, value, { state: state.current, fail }),
    saved: () => state.current.saved,
    conflict,
  }
}
