import {
  ArrowRight,
  Ban,
  CalendarClock,
  CircleX,
  FileOutput,
  Pause,
  Users,
  type LucideIcon,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { ClosedDataName } from '../form-data'
import type { FormProps } from '../form-props'
import { CLS } from './tokens'

// 받지 않을 때: 칸 자리에 회색 아이콘 원 + 제목 + 설명 한 줄 + 버튼. 테두리 상자는 버튼처럼 보여 쓰지 않는다.

const ICON: Record<ClosedDataName, LucideIcon> = {
  full: Users,
  before: CalendarClock,
  paused: Pause,
  ended: CircleX,
  cancelled: Ban,
  moved: FileOutput,
}

export default function ClosedSheet(props: FormProps) {
  const closed = props.data.closed
  if (!closed) return null
  const Icon = ICON[closed.kind]
  const moving = closed.action.href !== null
  return (
    <section
      aria-label={closed.title}
      className={`${CLS.pad} flex flex-col items-center gap-4 pt-9 pb-8 text-center sm:pt-12`}
    >
      <div className="flex size-14 items-center justify-center rounded-full bg-surface-muted">
        <Icon aria-hidden className="size-6 text-fg-secondary" />
      </div>
      <h2 className="-mt-1 text-xl leading-7 font-bold text-fg">{closed.title}</h2>
      <p className="-mt-2 max-w-80 text-sm leading-6 break-keep text-fg-secondary">{closed.line}</p>
      <Button
        variant={moving ? 'default' : 'outline'}
        className={`${CLS.primary} mt-2`}
        onClick={props.onClosedAction}
      >
        {closed.action.label}
        {moving && <ArrowRight aria-hidden />}
      </Button>
    </section>
  )
}
