import { useEffect, type ReactNode } from 'react'
import { eventRecordPath, type EventDetail } from '@vada/contracts'
import { HistoryMenu } from '@/components/HistoryMenu'
import PageActions from '@/components/PageActions'
import PageHeading from '@/components/PageHeading'
import { Button } from '@/components/ui/button'
import { navigate } from '@/lib/app-location'
import { PERMISSION_CHANGED } from '@/lib/messages'
import { eventTrail } from '../workspace/pages'
import { ApprovalNote } from './ApprovalNote'
import { versionLine } from './event-history'
import { EventCompletion } from './EventCompletion'
import { EventEditDialog } from './EventEditDialog'
import type { EventFieldFocus } from './EventFields'
import { EventStatusBar } from './EventStatusBar'
import type { EventDialogHandlers } from './useEventSubmit'

export type EventEditing = { focus: EventFieldFocus | undefined }

type Props = EventDialogHandlers & {
  councilId: string
  // 아직 읽지 못했으면 null이다. 그동안은 탭만 보인다.
  event: EventDetail | null
  // 열린 고치기와 포커스를 둘 칸. 개요의 준비 단계도 여므로 부모가 가진다.
  editing: EventEditing | null
  onEdit: (editing: EventEditing | null) => void
  // 내 변경(고치기, 완료, 완료 취소)이 돌려준 행사. 부모가 화면의 값으로 놓고 목록을 다시 읽는다.
  onChanged: (event: EventDetail) => void
  // 서버가 이미 바뀐 상태라며 완료를 거절했다. 행사를 다시 읽는다.
  onStale: () => void
  // 이름 줄과 요약 줄 사이의 탭 줄(와이어프레임: 제목 → 탭 → 행사 요약 줄).
  // 행사를 읽기 전후로 같은 자리에 둬, 읽는 사이 누른 탭과 초점이 사라지지 않는다.
  tabs: ReactNode
  // 열린 탭의 이름. 머리글 경로 줄의 끝 칸이다(DEC-96).
  tabLabel: string
  // 요약 줄 대신 둘 줄. 메시지 탭은 요약 줄 대신 방 전환이다(022 정한 것 28). 없으면(undefined) 요약 줄이다.
  bar?: ReactNode
}

// 이름 줄: 이름, '⋯' 이력, 완료 사유(DEC-80). 와이어프레임의 [행사 설정]은 요약 줄의 [기본정보 수정]과 같은 곳으로 가서 두지 않는다.
// 작업 공간에서는 이름과 경로 칸(행사명 > 탭)을 공통 머리글 제목으로, '⋯'를 머리글 오른쪽 행동 칸으로 보낸다
// (와이어프레임 EVT-02: 머리글 제목이 행사명이고 그 아래 바로 탭 줄). 그러면 이 줄은 비어 숨는다.
// 완료한 행사는 완료 사유 옆에 [기록 보기]로 기록 메뉴의 그 행사 기록에 간다(DEC-110). 읽기 링크라 모든 운영진에게 보인다.
function EventTitle({
  councilId,
  event,
  tabLabel,
}: {
  councilId: string
  event: EventDetail
  tabLabel: string
}) {
  return (
    <>
      <div className="flex items-start gap-3 empty:hidden">
        <PageHeading trail={eventTrail(event.name, tabLabel)}>
          <h2 className="min-w-0 flex-1 text-xl font-semibold text-fg wrap-anywhere">
            {event.name}
          </h2>
        </PageHeading>
        <PageActions>
          <HistoryMenu history={event.history} line={versionLine} />
        </PageActions>
      </div>
      <div className="flex flex-wrap items-start gap-x-3 gap-y-1 empty:hidden">
        <ApprovalNote approvals={event.approvals} />
        {event.status === 'completed' && (
          <Button
            variant="link"
            size="sm"
            className="h-auto p-0 text-sm"
            onClick={() => navigate(eventRecordPath(councilId, event.id))}
          >
            기록 보기
          </Button>
        )}
      </div>
    </>
  )
}

// 요약 줄 오른쪽의 행동: [기본정보 수정]과 상태 행동 자리(완료·완료 취소, 막힌 까닭).
function BarActions({
  canEdit,
  onEdit,
  onChanged,
  ...props
}: Pick<Props, 'councilId' | 'onChanged' | 'onStale' | 'onLost' | 'onForbidden'> & {
  event: EventDetail
  canEdit: boolean
  onEdit: () => void
}) {
  return (
    <>
      {canEdit && (
        <Button variant="outline" size="sm" onClick={onEdit}>
          기본정보 수정
        </Button>
      )}
      <EventCompletion onDone={onChanged} {...props} />
    </>
  )
}

// 행사 공통 머리(와이어프레임 EVT-02): 이름 줄, 탭, 요약 줄. 어느 탭에서나 보인다.
// 요약 줄의 행동은 [기본정보 수정](event.update)과 상태 행동 자리의 [완료]·[완료 취소](회장단)뿐이다.
// '행사 시작'·'행사 종료'는 없다(DEC-93: 상태는 일시로 센다).
export function EventHeader({
  councilId,
  event,
  editing,
  onEdit: setEditing,
  onChanged,
  onStale,
  tabs,
  tabLabel,
  bar,
  ...handlers
}: Props) {
  const canEdit = event?.actions.includes('event.update') ?? false
  // 열려 있는 동안 다시 읽은 actions에서 권한이 빠지면 닫고 이유를 보인다.
  const allowed = editing === null || event === null || canEdit
  const { onLost } = handlers
  useEffect(() => {
    if (allowed) return
    setEditing(null)
    onLost(PERMISSION_CHANGED)
  }, [allowed, onLost, setEditing])
  return (
    <div className="flex flex-col gap-4">
      {event && <EventTitle councilId={councilId} event={event} tabLabel={tabLabel} />}
      <div className="flex flex-col">
        {tabs}
        {bar !== undefined
          ? bar
          : event && (
              <EventStatusBar
                event={event}
                actions={
                  <BarActions
                    councilId={councilId}
                    event={event}
                    canEdit={canEdit}
                    onEdit={() => setEditing({ focus: undefined })}
                    onChanged={onChanged}
                    onStale={onStale}
                    {...handlers}
                  />
                }
              />
            )}
      </div>
      {event && editing && (
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
