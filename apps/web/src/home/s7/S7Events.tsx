import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { M, MP, R, RP, RowTitle, Section, TextLink, WRAP, rowClass } from '../s5/S5Parts'
import { StartButton } from './S7Start'
import type { S7Event } from './s7-data'
import { eventNext, eventSignals } from './s7-view'

// ② 전체 행사 진행 현황: 세로 구분선으로 나눈 3칸(옛 B를 잇는다). 업무 수·진행 막대·상태 글자는 없다(내용 확정 ②).
export const EVENTS_ID = 's7-events'

type Open = {
  onOpenEvent: (eventId: string) => void
  onOpenLate: (eventId: string) => void
  onPurchase: (card: S7Event) => void
}

function Cell({ card, today, ...open }: Open & { card: S7Event; today: string }) {
  const next = eventNext(card, today)
  const signals = eventSignals(card)
  return (
    <li
      className={cn(
        rowClass,
        'flex min-w-0 flex-1 items-start justify-between gap-3 @2xl:flex-col @2xl:items-stretch @2xl:py-0 @2xl:pr-4 @2xl:pl-4 @2xl:first:pl-0 @2xl:last:pr-0',
      )}
    >
      <div className="flex min-w-0 flex-1 flex-col gap-2 @2xl:flex-none">
      <RowTitle onClick={() => open.onOpenEvent(card.id)}>{card.name}</RowTitle>
      {/* 다음 일정: 모든 칸이 같은 기준(다음 날짜까지 남은 날)이고 기준 이름을 함께 쓴다. 오늘·내일만 강조. */}
      <p className="flex flex-col gap-1">
        <span className={cn(next.strong ? RP : R, 'tabular-nums')}>{next.head}</span>
        {next.date && <span className={cn(M, 'tabular-nums')}>{next.date}</span>}
      </p>
      {signals.length > 0 && (
        <div className="flex flex-col gap-1">
          {signals.map(signal => (
            <p key={signal.key} className={cn(signal.strong ? MP : M, WRAP)}>
              {signal.late ? (
                <Button
                  variant="link"
                  className={cn(MP, 'relative z-10 inline-flex h-auto gap-1 p-0 underline max-sm:-my-3 max-sm:min-h-11')}
                  onClick={() => open.onOpenLate(card.id)}
                >
                  {signal.text}
                </Button>
              ) : (
                signal.text
              )}
            </p>
          ))}
        </div>
      )}
      </div>
      {/* 넓으면 칸마다 버튼을 같은 아래 줄에 맞추고(justify-between), 390은 행사명 오른쪽에 둔다. */}
      <span className="flex">
        <StartButton label="구매 요청" onClick={() => open.onPurchase(card)} />
      </span>
    </li>
  )
}

type Props = Open & {
  cards: S7Event[]
  today: string
  total: number
  onSeeAll: () => void
  onNewEvent?: (() => void) | undefined
}

export default function S7Events({ cards, today, total, onSeeAll, onNewEvent, ...open }: Props) {
  const right = total > 0 && <TextLink onClick={onSeeAll}>{`전체 ${total}개 보기`}</TextLink>
  return (
    <Section id={EVENTS_ID} title="전체 행사 진행 현황" right={right}>
      {cards.length === 0 ? (
        <div className="flex flex-wrap items-center gap-4 py-3">
          <p className={M}>진행할 행사 없음</p>
          {onNewEvent && (
            <Button className="gap-2 bg-gray-900 text-sm font-medium text-white hover:bg-gray-700" onClick={onNewEvent}>
              새 행사
            </Button>
          )}
        </div>
      ) : (
        <ul className="flex flex-col divide-y divide-gray-200 @2xl:flex-row @2xl:divide-x @2xl:divide-y-0">
          {cards.map(card => (
            <Cell key={card.id} card={card} today={today} {...open} />
          ))}
        </ul>
      )}
    </Section>
  )
}
