import type { TaskSummary } from '@vada/contracts'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type Props = {
  event: NonNullable<TaskSummary['event']>
  // 없으면 이름은 글자일 뿐이다(행사의 업무 탭 안).
  onOpen?: ((eventId: string) => void) | undefined
  className?: string
  // 표 안에서는 칸이 초점을 서므로 Tab 순서에서 뺀다.
  tabIndex?: number
}

// 업무에 이어진 행사 이름. 누르면 그 행사가 열린다.
export function TaskEventLink({ event, onOpen, className, tabIndex }: Props) {
  if (!onOpen) return <span className={cn('wrap-anywhere', className)}>{event.name}</span>
  return (
    <Button
      variant="link"
      className={cn(
        'h-auto max-w-full justify-start p-0 text-left whitespace-normal wrap-anywhere',
        className,
      )}
      tabIndex={tabIndex}
      onClick={() => onOpen(event.id)}
    >
      {event.name}
    </Button>
  )
}
