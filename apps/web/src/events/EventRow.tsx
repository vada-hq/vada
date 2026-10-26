import type { EventSummary } from '@vada/contracts'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { dateBlock, spanLabel, whenLabel } from './event-view'
import EventStatusChip from './EventStatusChip'

type Props = { event: EventSummary; onOpen: () => void }

const PAST = new Set<EventSummary['status']>(['ended', 'completed'])
// 기획 중(예정과 날짜 미정)은 묶음 제목과 날짜 칸이 이미 말하므로 배지를 달지 않는다.
const BADGED = new Set<EventSummary['status']>(['ongoing', 'ended', 'completed'])

// 왼쪽 날짜 칸. 날짜가 행을 가르는 첫 단서라 가장 크게 쓴다. 지난 행사는 옅게 둔다.
function DateBox({ event }: { event: EventSummary }) {
  const block = dateBlock(event.startsAt)
  const past = PAST.has(event.status)
  return (
    <div
      aria-hidden
      className={cn(
        'flex w-14 shrink-0 flex-col items-center rounded-md py-1',
        block ? 'bg-blue-50 text-blue-700' : 'border border-dashed text-gray-500',
        past && 'bg-gray-100 text-gray-500',
      )}
    >
      <span className="text-xs font-medium">{block?.month ?? '날짜'}</span>
      <span className="text-xl leading-7 font-bold">{block?.day ?? '미정'}</span>
    </div>
  )
}

// 행사 목록의 한 줄: 날짜 칸, 이름, 시각·장소, 진행 중·후속 정리 중·완료 배지. 줄 어디를 눌러도 행사가 열린다.
export default function EventRow({ event, onOpen }: Props) {
  const span = spanLabel(event)
  return (
    <div className="relative flex items-center gap-4 px-4 py-3 transition-colors hover:bg-gray-50">
      <DateBox event={event} />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <h3>
          <Button
            variant="link"
            className="h-auto max-w-full justify-start p-0 text-left text-base font-semibold whitespace-normal text-gray-900 wrap-anywhere after:absolute after:inset-0"
            onClick={onOpen}
          >
            {event.name}
          </Button>
        </h3>
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-gray-500">
          {/* 날짜 칸은 눈으로만 읽으므로 화면 읽기 프로그램에는 날짜까지 한 줄로 읽힌다. */}
          <span className="sr-only">{whenLabel(event)}</span>
          {span && <span aria-hidden>{span}</span>}
          {event.place && <span className="wrap-anywhere">{event.place}</span>}
        </p>
      </div>
      {BADGED.has(event.status) && <EventStatusChip status={event.status} />}
    </div>
  )
}
