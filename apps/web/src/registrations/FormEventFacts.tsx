import type { EventDetail } from '@vada/contracts'
import { Button } from '@/components/ui/button'
import type { EventFieldFocus } from '@/events/EventFields'
import { whenLabel } from '@/events/event-view'
import { FormSection } from './FormSection'
import { useState } from 'react'

type Props = {
  event: EventDetail
  // 빈 칸을 넣는다. 행사 머리의 고치기를 그 칸에 포커스를 두고 연다. 고칠 권한이 없으면 링크를 두지 않는다.
  onEdit: (focus: EventFieldFocus) => void
}

// 신청 화면은 일시와 장소를 행사에서 가져온다. 비어 있으면 학생 화면에 '날짜 미정'으로 나가므로 링크를 만들기 전에 알린다.
// 와이어프레임 EVT-05의 '행사 기본정보(자동 반영)'다.
export function FormEventFacts({ event, onEdit }: Props) {
  const [open, setOpen] = useState(false)
  const canEdit = event.actions.includes('event.update')
  const rows: { label: string; value: string | null; focus: EventFieldFocus; empty: string }[] = [
    {
      label: '일시',
      value: event.startsAt === null ? null : whenLabel(event),
      focus: 'startsAt',
      empty: '미정',
    },
    { label: '장소', value: event.place, focus: 'place', empty: '미정' },
  ]
  return (
    <FormSection
      title="행사 기본정보"
      action={
        <Button variant="ghost" size="sm" touch aria-expanded={open} onClick={() => setOpen(!open)}>
          {open ? '접기' : '펼치기'}
        </Button>
      }
    >
      {open && (
        <dl className="flex flex-col gap-2 text-sm">
          {rows.map(row => (
            <div key={row.label} className="flex items-baseline gap-3">
              <dt className="w-10 shrink-0 text-fg-muted">{row.label}</dt>
              {row.value === null ? (
                <dd className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-3 text-warning">
                  {row.empty}
                  {canEdit && (
                    <Button
                      variant="link"
                      size="sm"
                      touch
                      className="text-sm"
                      onClick={() => onEdit(row.focus)}
                    >
                      입력
                    </Button>
                  )}
                </dd>
              ) : (
                <dd className="min-w-0 flex-1 text-fg wrap-anywhere">{row.value}</dd>
              )}
            </div>
          ))}
        </dl>
      )}
    </FormSection>
  )
}
