import { useId } from 'react'
import { ChevronRight } from 'lucide-react'
import type { MeetingSummary } from '@vada/contracts'
import { Button } from '@/components/ui/button'
import { cardClass } from '@/components/ui/card'
import { headLinkTouch, rowLinkBox, rowLinkTarget } from '@/components/ui/row-link'
import { cn } from '@/lib/utils'
import { meetingTime, myMeetingRows } from './meeting-view'

type Props = {
  meetings: MeetingSummary[]
  onOpen: (id: string) => void
  // 학생회 회의 탭으로 간다.
  onAll: () => void
}

// 내 회의(MEET-MY-01): 한 카드 안에 줄마다 일시·회의명·소속(학생회 또는 행사)·내가 할 일. 줄은 그 회의를 연다.
export function MyMeetingList({ meetings, onOpen, onAll }: Props) {
  const rows = myMeetingRows(meetings)
  const titleId = useId()
  return (
    <section aria-labelledby={titleId} className={cn(cardClass, 'min-w-0')}>
      <div className="flex items-center justify-between gap-3 border-b px-5 py-3">
        <h2 id={titleId} className="text-sm font-semibold">
          내 회의
        </h2>
        <Button variant="link" size="sm" className={cn('p-0', headLinkTouch)} onClick={onAll}>
          학생회 회의 전체
        </Button>
      </div>
      {rows.length === 0 ? (
        <p className="px-5 py-6 text-sm text-muted-foreground">내 회의 없음</p>
      ) : (
        <ul className="divide-y">
          {rows.map(({ meeting, todo }) => (
            <li
              key={meeting.id}
              className={cn(
                rowLinkBox,
                'flex min-w-0 items-center gap-3 px-5 py-3 transition-colors hover:bg-gray-50 max-sm:flex-wrap',
              )}
            >
              <span className="w-36 shrink-0 text-xs text-muted-foreground tabular-nums max-sm:w-full">
                {meetingTime(meeting.heldAt, null)}
              </span>
              <div className="min-w-0 flex-1">
                <Button
                  variant="link"
                  className={cn(
                    'h-auto min-w-0 p-0 text-left text-sm font-medium whitespace-normal text-foreground',
                    rowLinkTarget,
                  )}
                  onClick={() => onOpen(meeting.id)}
                >
                  <span className="wrap-anywhere">{meeting.title}</span>
                </Button>
                <p className="text-xs wrap-anywhere text-muted-foreground">
                  {meeting.event?.name ?? '학생회'}
                </p>
              </div>
              <span className={cn('shrink-0 text-sm', todo.className)}>{todo.label}</span>
              <ChevronRight aria-hidden className="size-4 shrink-0 text-gray-300" />
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
