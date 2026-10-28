import { useRef, useState, type ReactNode } from 'react'
import { CALENDAR_KIND_LABELS, recordPath, type ScheduleItemDetail } from '@vada/contracts'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { Fact } from '@/components/Fact'
import { Button, buttonVariants } from '@/components/ui/button'
import { SidePanel, SidePanelBody, SidePanelContent } from '@/components/ui/side-panel'
import { googleCalendarUrl } from '@/lib/google-calendar'
import { openRecord } from '@/lib/go-to'
import { useActive } from '@/lib/use-active'
import { KIND_STYLE } from './kind-style'
import { scheduleCreator, scheduleDateLabel } from './schedule-text'

type Props = {
  councilId: string
  item: ScheduleItemDetail
  onEdit: () => void
  onDelete: () => Promise<string | null>
  onClose: () => void
}

export function ScheduleFrame({
  title,
  id,
  onClose,
  busy = false,
  children,
}: {
  title: string
  id: string
  onClose: () => void
  busy?: boolean
  children: ReactNode
}) {
  return (
    <SidePanel
      open
      onOpenChange={open => {
        if (!open && !busy) onClose()
      }}
    >
      <SidePanelContent
        title={title}
        record={{ kind: 'schedule', id }}
        className="break-keep sm:w-full sm:border-l-0 md:w-128 md:border-l [&>div>button]:max-sm:min-h-11 [&>div>button]:max-sm:min-w-11"
      >
        <SidePanelBody>{children}</SidePanelBody>
      </SidePanelContent>
    </SidePanel>
  )
}

function ScheduleFacts({ item, councilId }: Pick<Props, 'item' | 'councilId'>) {
  const { Icon, text } = KIND_STYLE[item.type]
  return (
    <>
      <div className={`flex items-center gap-2 text-sm ${text}`}>
        <Icon aria-hidden className="size-4" />
        {CALENDAR_KIND_LABELS[item.type]}
      </div>
      <dl className="flex flex-col gap-3">
        <Fact label="날짜">
          <span className="tabular-nums">{scheduleDateLabel(item)}</span>
        </Fact>
        {item.place && <Fact label="장소">{item.place}</Fact>}
        {item.department && (
          <Fact label="부서">
            {item.department.name}
            {item.visibility === 'department' && ' · 이 부서만'}
          </Fact>
        )}
        {item.event && (
          <Fact label="행사">
            <a
              href={recordPath('events', councilId, item.event.id)}
              className="inline-flex items-center text-primary underline-offset-4 hover:underline max-sm:min-h-11"
              onClick={event => {
                event.preventDefault()
                openRecord('events', councilId, item.event!.id, { overRecord: true })
              }}
            >
              {item.event.name}
            </a>
          </Fact>
        )}
        {item.memo && (
          <Fact label="메모">
            <span className="whitespace-pre-wrap">{item.memo}</span>
          </Fact>
        )}
      </dl>
      <p className="text-xs text-muted-foreground wrap-anywhere">{scheduleCreator(item)}</p>
    </>
  )
}

export function ScheduleDetail({ councilId, item, onEdit, onDelete, onClose }: Props) {
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const sending = useRef(false)
  const active = useActive()
  const cancel = async () => {
    if (sending.current) return
    sending.current = true
    setBusy(true)
    const problem = await onDelete()
    sending.current = false
    if (!active()) return
    setBusy(false)
    setError(problem)
    if (!problem) setConfirming(false)
  }
  const url = new URL(recordPath('schedule', councilId, item.id), window.location.origin).href
  return (
    <ScheduleFrame title={item.title} id={item.id} onClose={onClose} busy={busy}>
      <ScheduleFacts item={item} councilId={councilId} />
      <div className="flex flex-wrap gap-2">
        {item.actions.includes('schedule_item.update') && (
          <Button variant="outline" touch onClick={onEdit}>
            수정
          </Button>
        )}
        {item.actions.includes('schedule_item.cancel') && (
          <Button variant="outline" touch onClick={() => setConfirming(true)}>
            일정 취소
          </Button>
        )}
        <a
          href={googleCalendarUrl(item, url)}
          target="_blank"
          rel="noopener noreferrer"
          className={buttonVariants({ variant: 'outline', touch: true })}
        >
          Google 캘린더에 추가
        </a>
      </div>
      {confirming && item.actions.includes('schedule_item.cancel') && (
        <ConfirmDialog
          title="이 일정을 취소할까요?"
          confirmLabel="일정 취소"
          touch
          busy={busy}
          error={error}
          onConfirm={() => void cancel()}
          onClose={() => {
            setConfirming(false)
            setError(null)
          }}
        />
      )}
    </ScheduleFrame>
  )
}
