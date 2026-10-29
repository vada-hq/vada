import { useId } from 'react'
import { CalendarCheck2, FileUp, Landmark, Plus, Users, type LucideIcon } from 'lucide-react'
import { CALENDAR_KIND_LABELS, type HomeWeek, type HomeWeekItem } from '@vada/contracts'
import IconBand from '@/components/IconBand'
import SeeAllButton from '@/components/SeeAllButton'
import { Button } from '@/components/ui/button'
import { greetingDate } from './home-time'

// ⑤ 이번 주(c35 안 b 확정, '아이콘 띠 모양'): 일정마다 ① 0건 띠와 같은 회색 띠 한 줄(흰 원 아이콘 | 제목 · 날짜 글 | 회의의 [안건 올리기]).
// 0건이면 '이번 주 일정 없음' 띠 한 줄이다. 줄이 넘치면 '전체 n건 보기'로 캘린더에 잇는다.
const WEEK_TITLE = '이번 주'
// 'YYYY-MM-DDTHH:mm'의 날짜·시각 자리
const DATE_LENGTH = 10
const TIME_START = 11

type Props = {
  week: HomeWeek
  onOpen: (item: HomeWeekItem) => void
  // 안건 올리기: 그 회의의 회의록 화면(시연 동안 홈 위 창 대신 지금 있는 화면)
  onAgenda: (meetingId: string) => void
  onSeeCalendar: () => void
}

const iconOf = (item: HomeWeekItem): LucideIcon =>
  item.kind === 'meeting' ? Users : item.item.type === 'external' ? Landmark : FileUp

function partsOf(item: HomeWeekItem) {
  if (item.kind === 'meeting') {
    const { heldAt, title, agendaCount } = item.meeting
    const when = `${greetingDate(heldAt.slice(0, DATE_LENGTH))} ${heldAt.slice(TIME_START)}`
    return { title, when, rest: `안건 ${agendaCount}` }
  }
  const when = [greetingDate(item.date), item.time].filter(Boolean).join(' ')
  return { title: item.item.title, when, rest: CALENDAR_KIND_LABELS[item.item.type] }
}

function Band({
  item,
  onOpen,
  onAgenda,
}: { item: HomeWeekItem } & Omit<Props, 'week' | 'onSeeCalendar'>) {
  const { title, when, rest } = partsOf(item)
  const agenda =
    item.kind === 'meeting' && item.meeting.actions.includes('meeting.minutes')
      ? item.meeting.id
      : null
  return (
    <IconBand
      as="li"
      icon={iconOf(item)}
      interactive
      trailing={
        agenda && (
          <Button
            variant="link"
            className="relative z-10 h-9 shrink-0 gap-1 rounded-full border-0 px-3 py-0 text-sm text-primary-strong hover:bg-primary-surface hover:no-underline max-sm:-my-1 max-sm:min-h-11 [&_svg]:size-4"
            onClick={() => onAgenda(agenda)}
          >
            <Plus aria-hidden />
            안건 올리기
          </Button>
        )
      }
    >
      <div className="py-1.5 @2xl:flex @2xl:items-baseline @2xl:gap-2">
        <Button
          variant="link"
          className="h-auto max-w-full min-w-0 justify-start border-0 p-0 text-left text-base leading-5.5 font-semibold tracking-tight whitespace-normal text-fg after:absolute after:inset-0 hover:no-underline"
          onClick={() => onOpen(item)}
        >
          <span className="line-clamp-1 break-keep wrap-anywhere">{title}</span>
        </Button>
        <p className="min-w-0 text-sm text-fg-tertiary">
          <span className="whitespace-nowrap text-fg-secondary">{when}</span>
          <span aria-hidden> · </span>
          <span className="whitespace-nowrap">{rest}</span>
        </p>
      </div>
    </IconBand>
  )
}

export default function WeekCard({ week, onOpen, onAgenda, onSeeCalendar }: Props) {
  const headId = useId()
  if (week.items.length === 0)
    return (
      <div className="@container min-w-0">
        <IconBand icon={CalendarCheck2}>
          <h2 className="text-row-sub font-medium text-fg-secondary">{`${WEEK_TITLE} 일정 없음`}</h2>
        </IconBand>
      </div>
    )
  return (
    <section aria-labelledby={headId} className="@container min-w-0">
      <h2 id={headId} className="px-3 pb-1.5 text-row-sub font-bold text-fg-secondary">
        {WEEK_TITLE}
      </h2>
      <ul className="flex flex-col gap-1.5">
        {week.items.map(item => (
          <Band
            key={item.kind === 'meeting' ? item.meeting.id : item.item.id}
            item={item}
            onOpen={onOpen}
            onAgenda={onAgenda}
          />
        ))}
      </ul>
      {week.total > week.items.length && (
        <SeeAllButton total={week.total} hidden={null} onClick={onSeeCalendar} />
      )}
    </section>
  )
}
