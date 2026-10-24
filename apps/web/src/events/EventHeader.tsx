import { useEffect, type ReactNode } from 'react'
import { CalendarDays, MapPin, Plus, type LucideIcon } from 'lucide-react'
import type { EventDetail } from '@vada/contracts'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { PERMISSION_CHANGED } from '@/lib/messages'
import { ApprovalNote } from './ApprovalNote'
import { EVENT_STATUS_LABEL, EVENT_STATUS_TONE, whenLabel } from './event-view'
import { EventEditDialog } from './EventEditDialog'
import type { EventFieldFocus } from './EventFields'
import type { EventDialogHandlers } from './useEventSubmit'

export type EventEditing = { focus: EventFieldFocus | undefined }

type Props = EventDialogHandlers & {
  councilId: string
  event: EventDetail
  // 열린 고치기와 포커스를 둘 칸. 개요의 준비 단계도 여므로 부모가 가진다.
  editing: EventEditing | null
  onEdit: (editing: EventEditing | null) => void
  // 내 변경이 돌려준 행사. 부모가 화면의 값으로 놓고 목록을 다시 읽는다.
  onChanged: (event: EventDetail) => void
}

// 이름 아래 한 줄의 칸 하나(일시, 장소). 비었으면 고칠 수 있을 때 그 자리에서 채우는 링크다(GOV.UK: 빈 값은 입력으로 가는 링크).
function MetaItem({
  icon: Icon,
  value,
  empty,
  fill,
  onFill,
}: {
  icon: LucideIcon
  value: string | null
  empty: string
  fill: string | null
  onFill: () => void
}): ReactNode {
  const body =
    value ??
    (fill === null ? (
      <span className="text-gray-500">{empty}</span>
    ) : (
      <Button variant="link" size="sm" className="h-auto p-0 text-sm" onClick={onFill}>
        <Plus aria-hidden />
        {fill}
      </Button>
    ))
  return (
    <span className="flex min-w-0 items-center gap-1.5">
      <Icon aria-hidden className="size-4 shrink-0 text-gray-400" />
      <span className="min-w-0 wrap-anywhere">{body}</span>
    </span>
  )
}

// 일시·장소 한 줄. 어느 탭에서나 언제·어디인지 보이게 이름 아래에 둔다(Luma·Eventbrite 행사 관리 화면).
function EventMeta({
  event,
  canEdit,
  onFill,
}: {
  event: EventDetail
  canEdit: boolean
  onFill: (focus: EventFieldFocus) => void
}) {
  const fill = (label: string) => (canEdit ? label : null)
  return (
    <p className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-gray-700">
      <MetaItem
        icon={CalendarDays}
        value={event.startsAt === null ? null : whenLabel(event)}
        empty={whenLabel(event)}
        fill={fill('일시 넣기')}
        onFill={() => onFill('startsAt')}
      />
      <MetaItem
        icon={MapPin}
        value={event.place}
        empty="장소 없음"
        fill={fill('장소 넣기')}
        onFill={() => onFill('place')}
      />
    </p>
  )
}

// 행사 머리: 이름과 상태, 일시·장소 한 줄, [고치기]. 어느 탭에서나 보인다.
// 상태는 이름 바로 뒤 한 곳에만 둔다(Polaris titleMetadata, Primer PageHeader). 고치는 입구는 [고치기] 하나와 빈 칸 채우기뿐이다.
export function EventHeader({
  councilId,
  event,
  editing,
  onEdit: setEditing,
  onChanged,
  ...handlers
}: Props) {
  const canEdit = event.actions.includes('event.update')
  // 열려 있는 동안 다시 읽은 actions에서 권한이 빠지면 닫고 이유를 보인다.
  const allowed = editing === null || canEdit
  const { onLost } = handlers
  useEffect(() => {
    if (allowed) return
    setEditing(null)
    onLost(PERMISSION_CHANGED)
  }, [allowed, onLost, setEditing])
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-start gap-3">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1">
          <h2 className="min-w-0 text-xl font-bold text-gray-900 wrap-anywhere">{event.name}</h2>
          <Badge tone={EVENT_STATUS_TONE[event.status]}>{EVENT_STATUS_LABEL[event.status]}</Badge>
          <ApprovalNote approvals={event.approvals} />
        </div>
        {canEdit && (
          <Button variant="outline" onClick={() => setEditing({ focus: undefined })}>
            고치기
          </Button>
        )}
      </div>
      <EventMeta event={event} canEdit={canEdit} onFill={focus => setEditing({ focus })} />
      {editing && (
        <EventEditDialog
          councilId={councilId}
          event={event}
          focus={editing.focus}
          onClose={() => setEditing(null)}
          onDone={next => {
            setEditing(null)
            onChanged(next)
          }}
          {...handlers}
        />
      )}
    </div>
  )
}
