import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { S5Home } from './s5-data'
import { Empty, ListRow, M, R, RowTitle, Section, TextLink, WRAP, listClass, rowClass } from './S5Parts'
import { dateText, upcomingRow, type ListRow as Row } from './s5-view'

// 인사 띠(1.7): 상자 없는 한 줄. 날짜(M) + 인사(R), 오른쪽 메시지함(중립 알약, 안 읽은 수는 M).
export function S5Greeting({
  home,
  onOpenRoom,
  onSeeRooms,
}: {
  home: S5Home
  onOpenRoom: (roomId: string) => void
  onSeeRooms: () => void
}) {
  return (
    <section
      aria-labelledby="s5-greeting"
      className="flex min-w-0 flex-col gap-2 @2xl:flex-row @2xl:items-center @2xl:justify-between @2xl:gap-6"
    >
      <div className="flex min-w-0 flex-wrap items-baseline gap-x-2">
        <p className={M}>{dateText(home.today)}</p>
        <h2 id="s5-greeting" className={cn(R, WRAP)}>{`${home.name}님, 안녕하세요`}</h2>
      </div>
      {home.rooms.length > 0 && (
        <div aria-label="메시지함" role="group" className="flex min-w-0 items-center gap-2 overflow-x-auto">
          <span className={cn(M, 'shrink-0')}>메시지함</span>
          {home.rooms.map(room => (
            <Button
              key={room.id}
              variant="outline"
              className="h-8 shrink-0 gap-1 rounded-full border-gray-200 bg-white px-3 py-0 text-xs font-medium text-gray-900 max-sm:min-h-11"
              aria-label={`${room.name}, 안 읽은 메시지 ${room.unread}개`}
              onClick={() => onOpenRoom(room.id)}
            >
              {room.name}
              <span className="text-xs font-normal text-gray-500">{room.unread}</span>
            </Button>
          ))}
          <span className="shrink-0">
            <TextLink onClick={onSeeRooms}>전체 보기</TextLink>
          </span>
        </div>
      )}
    </section>
  )
}

function Rows({ rows, empty, onOpen }: { rows: Row[]; empty: string; onOpen: (row: Row) => void }) {
  if (rows.length === 0) return <Empty>{empty}</Empty>
  return (
    <ul className={listClass}>
      {rows.map(row => (
        <ListRow key={row.key} title={row.title} note={row.note} meta={row.meta} onOpen={() => onOpen(row)} />
      ))}
    </ul>
  )
}

export function S5Finish({ rows, className, onOpen }: { rows: Row[]; className?: string; onOpen: (row: Row) => void }) {
  return (
    <Section id="s5-finish" title="마무리할 일" className={className}>
      <Rows rows={rows} empty="마무리할 일 없음" onOpen={onOpen} />
    </Section>
  )
}

export function S5Finance({
  rows,
  className,
  onOpen,
  onSeeFinance,
}: {
  rows: Row[]
  className?: string
  onOpen: (row: Row) => void
  onSeeFinance: () => void
}) {
  return (
    <Section
      id="s5-finance"
      title="정산과 기록"
      className={className}
      right={<TextLink onClick={onSeeFinance}>재정 보기</TextLink>}
    >
      <Rows rows={rows} empty="남은 정리 없음" onOpen={onOpen} />
    </Section>
  )
}

type UpcomingProps = {
  home: S5Home
  // B·C의 반 폭 칸: 날짜를 왼쪽 96px 열로. A의 좁은 칸과 390은 제목 위 줄로.
  dateColumn: boolean
  shown: number
  className?: string
  onOpen: (item: S5Home['upcoming']['items'][number]) => void
  onSeeAll: () => void
}

export function S5Upcoming({ home, dateColumn, shown, className, onOpen, onSeeAll }: UpcomingProps) {
  const { items, total } = home.upcoming
  const right =
    total > shown ? (
      <TextLink onClick={onSeeAll}>{`전체 ${total}건 보기`}</TextLink>
    ) : total > 0 ? (
      <span className={M}>{`${total}건`}</span>
    ) : null
  return (
    <Section id="s5-upcoming" title="가까운 주요 일정" className={className} right={right}>
      {items.length === 0 ? (
        <Empty>7일 안 일정 없음</Empty>
      ) : (
        <ul className={listClass}>
          {items.slice(0, shown).map(item => {
            const row = upcomingRow(item)
            return (
              <li
                key={row.key}
                className={cn(rowClass, 'flex flex-col gap-1', dateColumn && '@2xl:flex-row @2xl:items-baseline @2xl:gap-4')}
              >
                <span className={cn(M, 'tabular-nums', dateColumn && '@2xl:flex @2xl:w-24 @2xl:shrink-0 @2xl:flex-col')}>
                  <span>{row.when.date}</span>
                  {row.when.time && <span>{` ${row.when.time}`}</span>}
                </span>
                <span className="flex min-w-0 flex-col gap-1">
                  <RowTitle onClick={() => onOpen(item)}>{row.title}</RowTitle>
                  <span className={cn(M, WRAP)}>{row.kind}</span>
                </span>
              </li>
            )
          })}
        </ul>
      )}
    </Section>
  )
}

