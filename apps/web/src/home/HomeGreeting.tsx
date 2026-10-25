import { useId, type ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cardClass } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { greetingDate } from './home-time'

type Props = {
  // 홈의 오늘(한국 날짜)
  today: string
  name: string
  // 이 홈에서 보는 것 한 줄(해요체)
  description: string
  // 메시지함(MessageInbox). 안 읽은 방이 없으면 메시지함이 스스로 빠진다.
  inbox?: ReactNode
  // 카드 왼쪽 아래 바로가기(HomeShortcut들)
  shortcuts?: ReactNode
  // 학생회 주요 행사 타일(FeaturedEvents). 회장단 홈에는 없다.
  featured?: ReactNode
}

// 인사 카드 아래쪽 바로가기(와이어프레임 HOME-01F '내 업무 2건'·'메시지 방 1개'): 아이콘 붙은 작은 파란 글.
export function HomeShortcut({
  icon: Icon,
  label,
  onOpen,
}: {
  icon: LucideIcon
  label: string
  onOpen: () => void
}) {
  return (
    <Button
      variant="link"
      size="sm"
      className="h-auto gap-1 p-0 text-xs max-sm:min-h-11"
      onClick={onOpen}
    >
      <Icon aria-hidden />
      {label}
    </Button>
  )
}

function GreetingText({
  today,
  title,
  titleId,
  description,
}: Pick<Props, 'today' | 'description'> & { title: string; titleId: string }) {
  return (
    <div className="min-w-0">
      <p className="text-xs text-gray-500">{greetingDate(today)}</p>
      <h2
        id={titleId}
        className="mt-0.5 text-lg font-semibold break-keep text-gray-900 wrap-anywhere"
      >
        {title}
      </h2>
      <p className="mt-1 text-sm break-keep text-gray-500">{description}</p>
    </div>
  )
}

const shortcutRow = (shortcuts: ReactNode) =>
  shortcuts && <div className="flex flex-wrap items-center gap-x-3 gap-y-1">{shortcuts}</div>

// 홈 첫 카드(와이어프레임 HomePrototypeWelcome, DEC-95): 날짜, 인사, 설명 한 줄, 메시지함, 바로가기 | 학생회 주요 행사 타일.
// 타일이 없는 회장단은 메시지함을 카드 오른쪽에 둬 높이를 늘리지 않는다. 인사 아래에 처리 건수를 붙이지 않는다.
// 본문이 좁으면(1024px 창 아래) 날짜·인사·설명 → 메시지함 → 바로가기 → 타일 차례로 세로로 쌓는다(와이어프레임 가로 배치는 390px에서 행사명이 잘린다).
export default function HomeGreeting({
  today,
  name,
  description,
  inbox,
  shortcuts,
  featured,
}: Props) {
  const title = `${name}님, 안녕하세요`
  const titleId = useId()
  const text = (
    <GreetingText today={today} title={title} titleId={titleId} description={description} />
  )
  if (!featured)
    return (
      // 넓으면 왼쪽 1/3에 글과 바로가기, 오른쪽 2/3에 두 줄을 차지하는 메시지함(와이어프레임처럼 메시지함이 남는 폭을 쓴다).
      // 좁으면 글 차례대로 한 단이다.
      <section
        aria-labelledby={titleId}
        className={cn(
          cardClass,
          'grid gap-x-6 gap-y-3 px-6 py-4 @2xl:grid-cols-3 @2xl:items-center',
        )}
      >
        {text}
        {inbox && (
          <div className="min-w-0 @2xl:col-span-2 @2xl:col-start-2 @2xl:row-span-2 @2xl:row-start-1 @2xl:justify-self-end">
            {inbox}
          </div>
        )}
        {shortcutRow(shortcuts)}
      </section>
    )
  return (
    <section
      aria-labelledby={titleId}
      className={cn(
        cardClass,
        'flex flex-col gap-4 px-6 py-4 @2xl:flex-row @2xl:items-center @2xl:gap-6',
      )}
    >
      <div className="flex min-w-0 flex-col gap-2 @2xl:w-2/5 @2xl:shrink-0">
        {text}
        {inbox}
        {shortcutRow(shortcuts)}
      </div>
      <div aria-hidden className="hidden w-px self-stretch bg-gray-100 @2xl:block" />
      {/* 타일 칸은 위에 붙인다(읽기 전 '집계 전' 라벨이 가운데 떴다가 타일이 오면 위로 튀지 않게). */}
      <div className="min-w-0 flex-1 @2xl:self-start">{featured}</div>
    </section>
  )
}
