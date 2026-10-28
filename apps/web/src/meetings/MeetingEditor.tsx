import {
  recordPath,
  statusOf,
  type CouncilView,
  type MeetingDetail,
  type MeetingOptionsResponse,
} from '@vada/contracts'
import { getJson } from '@/lib/api'
import { navigate } from '@/lib/app-location'
import { MeetingForm } from './MeetingForm'
import { useMeetingSave } from './use-meeting-save'
import { MeetingConflict } from './MeetingConflict'

type Props = {
  view: CouncilView
  item?: MeetingDetail | undefined
  onClose: () => void
  onForbidden: () => void
}
export function MeetingEditor({ view, item, onClose, onForbidden }: Props) {
  const base = `/api/organizations/${view.council.id}/meetings`
  const { save, saved, conflict } = useMeetingSave(base, item, onForbidden)
  const readOptions = async (eventId: string, departmentId: string) => {
    const query = new URLSearchParams()
    if (eventId) query.set('event', eventId)
    if (departmentId) query.set('hostDepartment', departmentId)
    const result = await getJson<MeetingOptionsResponse>(
      `${base}/options${query.size ? `?${query}` : ''}`,
    )
    if (!result.ok && result.status === statusOf('FORBIDDEN')) onForbidden()
    return result.ok ? result.data : null
  }
  return (
    <>
      {conflict && <MeetingConflict meeting={conflict} />}
      <MeetingForm
        memberId={view.me.memberId}
        creatorName={item ? (item.createdBy?.name ?? '떠난 운영진') : view.me.name}
        item={item}
        readOptions={readOptions}
        onSave={save}
        onClose={onClose}
        onSaved={() => {
          const meeting = saved()
          if (meeting)
            navigate(recordPath('meetings', view.council.id, meeting.id), { replace: true })
        }}
      />
    </>
  )
}
