import { useEffect, useState, type ReactNode } from 'react'
import { Plus } from 'lucide-react'
import type { EventDetail } from '@vada/contracts'
import { Fact } from '@/components/Fact'
import { PERMISSION_CHANGED } from '@/lib/messages'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { EVENT_STATUS_LABEL, EVENT_STATUS_TONE, whenLabel } from './event-view'
import { EventEditDialog } from './EventEditDialog'
import type { EventFieldFocus } from './EventFields'
import { EventHistory } from './EventHistory'
import type { EventDialogHandlers } from './useEventSubmit'

type Props = EventDialogHandlers & {
  councilId: string
  event: EventDetail
  // 내 변경이 돌려준 행사. 부모가 화면의 값으로 놓고 목록을 다시 읽는다.
  onChanged: (event: EventDetail) => void
}

// 빈 칸. 고칠 수 있으면 그 칸을 채우는 버튼이고, 아니면 글자다. 만들기가 이름만 받아 빈 칸이 흔하다.
function EmptyFact({
  text,
  fill,
  onFill,
}: {
  text: string
  fill: string | null
  onFill: () => void
}): ReactNode {
  if (fill === null) return text
  return (
    <Button variant="link" size="sm" className="h-auto p-0" onClick={onFill}>
      <Plus aria-hidden />
      {fill}
    </Button>
  )
}

// 상태, 일시, 장소, 업무 수. 빈 일시·장소는 고칠 수 있으면 채우는 버튼이다.
function OverviewFacts({
  event,
  canEdit,
  onFill,
}: {
  event: EventDetail
  canEdit: boolean
  onFill: (field: EventFieldFocus) => void
}) {
  return (
    <dl className="flex flex-col gap-4">
      <Fact label="상태">
        <Badge tone={EVENT_STATUS_TONE[event.status]}>{EVENT_STATUS_LABEL[event.status]}</Badge>
      </Fact>
      <Fact label="일시">
        {event.startsAt === null ? (
          <EmptyFact
            text={whenLabel(event)}
            fill={canEdit ? '일시 넣기' : null}
            onFill={() => onFill('startsAt')}
          />
        ) : (
          whenLabel(event)
        )}
      </Fact>
      <Fact label="장소">
        {event.place ?? (
          <EmptyFact
            text="장소 없음"
            fill={canEdit ? '장소 넣기' : null}
            onFill={() => onFill('place')}
          />
        )}
      </Fact>
      <Fact label="업무">
        {event.tasks.total === 0
          ? '업무 없음'
          : `끝나지 않은 업무 ${event.tasks.open}개 · 전체 ${event.tasks.total}개`}
      </Fact>
    </dl>
  )
}

// 개요 탭: 일시, 장소, 상태, 업무 수, 이력. 버튼은 서버가 준 actions로만 보이거나 숨는다(DEC-38).
export function EventOverview({ councilId, event, onChanged, ...handlers }: Props) {
  const [dialog, setDialog] = useState<'edit' | null>(null)
  const [focus, setFocus] = useState<EventFieldFocus | undefined>(undefined)
  const canEdit = event.actions.includes('event.update')
  const openEdit = (field?: EventFieldFocus) => {
    setFocus(field)
    setDialog('edit')
  }
  const done = (next: EventDetail) => {
    setDialog(null)
    onChanged(next)
  }
  // 열려 있는 동안 다시 읽은 actions에서 권한이 빠지면 닫고 이유를 보인다.
  const allowed = dialog === null || canEdit
  const { onLost } = handlers
  useEffect(() => {
    if (allowed) return
    setDialog(null)
    onLost(PERMISSION_CHANGED)
  }, [allowed, onLost])
  const shared = { councilId, event, onClose: () => setDialog(null), onDone: done, ...handlers }
  return (
    <div className="flex flex-col gap-6">
      <OverviewFacts event={event} canEdit={canEdit} onFill={openEdit} />
      <div className="flex flex-wrap items-center gap-2">
        {canEdit && (
          <Button variant="outline" onClick={() => openEdit()}>
            고치기
          </Button>
        )}
      </div>
      {dialog === 'edit' && <EventEditDialog {...shared} focus={focus} />}
      <EventHistory history={event.history} />
    </div>
  )
}
