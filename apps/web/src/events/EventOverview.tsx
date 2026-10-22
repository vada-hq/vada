import { useEffect, useState } from 'react'
import type { EventDetail } from '@vada/contracts'
import { Fact } from '@/components/Fact'
import { PERMISSION_CHANGED } from '@/lib/messages'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { EVENT_STATUS_LABEL, EVENT_STATUS_TONE, ownerLabel, whenLabel } from './event-view'
import { EventEditDialog } from './EventEditDialog'
import { EventHistory } from './EventHistory'
import { EventOwnerDialog } from './EventOwnerDialog'
import type { EventDialogHandlers } from './useEventSubmit'

type Props = EventDialogHandlers & {
  councilId: string
  event: EventDetail
  // 내 변경이 돌려준 행사. 부모가 화면의 값으로 놓고 목록을 다시 읽는다.
  onChanged: (event: EventDetail) => void
}

// 개요 탭: 일시, 장소, 책임자, 상태, 업무 수, 이력. 버튼은 서버가 준 actions로만 보이거나 숨는다(DEC-38).
export function EventOverview({ councilId, event, onChanged, ...handlers }: Props) {
  const [dialog, setDialog] = useState<'edit' | 'owner' | null>(null)
  const done = (next: EventDetail) => {
    setDialog(null)
    onChanged(next)
  }
  // 열려 있는 동안 다시 읽은 actions에서 권한이 빠지면 닫고 이유를 보인다.
  const allowed =
    dialog === null ||
    event.actions.includes(dialog === 'edit' ? 'event.update' : 'event.set_owner')
  const { onLost } = handlers
  useEffect(() => {
    if (allowed) return
    setDialog(null)
    onLost(PERMISSION_CHANGED)
  }, [allowed, onLost])
  const shared = { councilId, event, onClose: () => setDialog(null), onDone: done, ...handlers }
  return (
    <div className="flex flex-col gap-6">
      <dl className="flex flex-col gap-4">
        <Fact label="상태">
          <Badge tone={EVENT_STATUS_TONE[event.status]}>{EVENT_STATUS_LABEL[event.status]}</Badge>
        </Fact>
        <Fact label="일시">{whenLabel(event)}</Fact>
        <Fact label="장소">{event.place ?? '장소 없음'}</Fact>
        <Fact label="책임자">{ownerLabel(event.owner)}</Fact>
        <Fact label="업무">
          {event.tasks.total === 0
            ? '업무 없음'
            : `끝나지 않은 업무 ${event.tasks.open}개 · 전체 ${event.tasks.total}개`}
        </Fact>
      </dl>
      <div className="flex flex-wrap items-center gap-2">
        {event.actions.includes('event.update') && (
          <Button variant="outline" onClick={() => setDialog('edit')}>
            고치기
          </Button>
        )}
        {event.actions.includes('event.set_owner') && (
          <Button variant="outline" onClick={() => setDialog('owner')}>
            책임자 바꾸기
          </Button>
        )}
      </div>
      {dialog === 'edit' && <EventEditDialog {...shared} />}
      {dialog === 'owner' && <EventOwnerDialog {...shared} />}
      <EventHistory history={event.history} />
    </div>
  )
}
