import type { ReactNode } from 'react'
import { BarChart2, ChevronRight, ClipboardList } from 'lucide-react'
import type { RoomSummary } from '@vada/contracts'
import { Button } from '@/components/ui/button'
import { cardClass } from '@/components/ui/card'
import EventStatusChip from '@/events/EventStatusChip'
import type { FeaturedTile, TilesRead } from '@/home/FeaturedEvents'
import type { CardRead } from '@/home/HomeCard'
import HomeChip from '@/home/HomeChip'
import { HomeShortcut } from '@/home/HomeGreeting'
import HomeProgress from '@/home/HomeProgress'
import HomeRow from '@/home/HomeRow'
import MessageInbox from '@/home/MessageInbox'
import { PUSH_OFF_CHAT } from '@/lib/messages'
import { cn } from '@/lib/utils'
import { PushOffAlert } from '@/push/PushOffBand'
import { longName } from './sample-text'

// 홈 틀 확인 화면(HomeFrameSections)의 견본. 줄 내용은 견본이고, 카드마다의 실제 줄은 기능 027 조각 6~9가 만든다.

export const noop = () => {}
export const today = '2026-10-26'

const room = (id: string, extra: Partial<RoomSummary>): RoomSummary => ({
  id,
  type: 'all_members',
  name: null,
  departmentId: null,
  readOnly: false,
  unread: 1,
  mentions: 0,
  lastMessageAt: '2026-10-26T03:00:00.000Z',
  lastMessage: null,
  memberCount: 3,
  ...extra,
})
export const inbox = (
  <MessageInbox
    inCard
    rooms={[
      room('a', { type: 'direct', name: '김민준', unread: 1 }),
      room('b', { unread: 3 }),
      room('c', { type: 'department', name: '기획부', departmentId: 'd1', unread: 2 }),
    ]}
    onOpenRoom={noop}
    onSeeAll={noop}
  />
)

export const ready = (rows: ReactNode[], total = rows.length): CardRead => ({
  kind: 'ready',
  total,
  rows,
})
export const loading: CardRead = { kind: 'loading' }

// 회장단 '전체 행사 진행 현황'의 칸 카드 견본: 상태 칩 · 행사명 · 날짜 / 업무 막대 / 이유 칩 / 다음 마감.
function EventTile({ id, name, overdue }: { id: string; name: string; overdue: number }) {
  return (
    <li key={id} className="flex min-w-0 flex-col gap-1.5 rounded-lg border p-3">
      <div className="flex items-center gap-2">
        <EventStatusChip status={overdue > 0 ? 'ongoing' : 'upcoming'} />
        <span className="min-w-0 flex-1 truncate text-sm font-bold text-gray-900">{name}</span>
        <span className="shrink-0 text-xs text-gray-500">10월 30일 · D-4</span>
      </div>
      <HomeProgress label="업무" done={2} total={5} />
      <div className="flex min-h-6 flex-wrap items-center gap-1.5">
        {overdue > 0 ? (
          <HomeChip label="지남" count={overdue} />
        ) : (
          <span className="text-xs text-gray-500">확인 필요 없음</span>
        )}
        {overdue > 0 && <HomeChip label="담당자 없음" count={1} />}
      </div>
      <p className="mt-auto truncate border-t border-gray-100 pt-2 text-xs text-gray-500">
        다음 마감 · <span className="text-gray-700">10월 28일 (수) 부스 배치안 확정</span>
      </p>
    </li>
  )
}
export const eventTiles = [
  <EventTile key="a" id="a" name="가을 축제" overdue={1} />,
  <EventTile key="b" id="b" name="2026 소프트웨어융합대학 체육대회" overdue={0} />,
  <EventTile key="c" id="c" name="진로 특강" overdue={0} />,
  <EventTile key="d" id="d" name="체육대회" overdue={0} />,
]
const issueRow = (id: string, title: string, chip: ReactNode) => (
  <HomeRow
    key={id}
    card
    title={title}
    meta={['기획부', '가을 축제', '10월 24일 (토)']}
    side={chip}
    onOpen={noop}
  />
)
export const issues = [
  issueRow('a', '체험 부스 구성안', <HomeChip label="지남" />),
  issueRow('b', '현장 운영 순서표', <HomeChip label="담당자 없음" />),
  issueRow('c', '행사 사진 정리', <HomeChip label="담당자 없음" />),
]
const scheduleRow = (id: string, date: string, title: string, meta: string) => (
  <HomeRow
    key={id}
    card
    lead={<span className="w-20 shrink-0 text-xs font-semibold text-gray-500">{date}</span>}
    title={title}
    meta={[meta]}
    onOpen={noop}
  />
)
export const schedule = [
  scheduleRow('a', '10월 27일 (화)', '부스 배치안 확정', '가을 축제 · 업무 마감'),
  scheduleRow('b', '10월 29일 (목)', '진로 특강 신청 마감', '참가 신청'),
  scheduleRow('c', '10월 30일 (금)', '가을 축제', '행사 시작 · 10:00'),
]
export const mineRows = [
  <HomeRow
    key="a"
    card
    title="내 업무 3"
    meta={['가장 가까운 마감 10월 27일 (화)', '부스 배치안 확정']}
    onOpen={noop}
  />,
]
export const shortcut = (
  <HomeShortcut icon={ClipboardList} label="내 업무 4 · 지남 1" onOpen={noop} />
)

const featured = (name: string): FeaturedTile => ({
  id: name,
  name,
  chip: <EventStatusChip status="upcoming" />,
  when: '10월 30일 (금) · D-4',
  onOpen: noop,
})
export const tilesRead: TilesRead = {
  kind: 'ready',
  tiles: [featured('가을 축제'), featured(longName), featured('체육대회')],
}
const PARTICIPATING_TOTAL = 6
const participatingRow = (id: string, name: string, done: number) => (
  <li key={id} className="flex flex-col gap-1.5 px-5 py-2.5">
    <div className="flex items-center gap-2">
      <EventStatusChip status="upcoming" />
      <span className="min-w-0 flex-1 text-sm font-bold break-keep text-gray-900 wrap-anywhere">
        {name}
      </span>
      <span className="shrink-0 text-xs text-gray-500">10월 30일 (금)</span>
    </div>
    <HomeProgress label="부서 업무" done={done} total={PARTICIPATING_TOTAL} />
  </li>
)
// 부서 업무 끝남 수(막대 견본). 전체는 participatingRow의 PARTICIPATING_TOTAL이다.
const FESTIVAL_DONE = 4
export const participatingRows = [
  participatingRow('a', '가을 축제', FESTIVAL_DONE),
  participatingRow('b', '진로 특강', 1),
]
// 카드가 그리는 3줄보다 많은 전체 수(머리의 '전체 {n}건 보기' 견본)
export const MORE_THAN_SHOWN = 5

// 첫날 막 들어온 운영진: 행사를 만들 수 없는 사람의 빈 상태에는 누가 만드는지 한 줄을 둔다(DEC-78 규칙 9).
export const whoCreates = <p className="text-xs text-gray-500">회장단과 부서장이 만들어요</p>

// 알림 꺼짐 띠 견본: PushOffBand의 보이는 부분 그대로다.
export const pushBand = <PushOffAlert message={PUSH_OFF_CHAT} onTurnOn={noop} />

// 회장단 맨 아래 '전체 재정 요약' 한 줄 자리 견본(줄 내용은 기능 027 조각 8, 와이어프레임 HOME-01C 맨 아래).
const SUMMARY = [
  ['총예산', '2,100,000원'],
  ['실제 지출', '770,000원'],
  ['지출 예정', '410,000원'],
  ['사용 가능', '920,000원'],
] as const
export const financeLine = (
  <section
    aria-label="전체 재정 요약"
    className={cn(cardClass, 'flex flex-wrap items-center gap-x-6 gap-y-1 px-5 py-3')}
  >
    <h2 className="flex items-center gap-1.5 text-sm font-semibold text-gray-700">
      <BarChart2 aria-hidden className="size-4 text-gray-400" />
      전체 재정 요약
    </h2>
    {SUMMARY.map(([label, value]) => (
      <span key={label} className="flex items-baseline gap-1.5 text-xs text-gray-500">
        {label}
        <strong className="text-sm font-bold text-gray-900">{value}</strong>
      </span>
    ))}
    <Button
      aria-label="전체 재정 요약"
      variant="link"
      size="sm"
      className="ml-auto h-auto gap-0.5 p-0 text-xs text-gray-500"
    >
      <ChevronRight aria-hidden />
    </Button>
  </section>
)

// 실제 화면의 본문 폭: 1280px 창은 옆 메뉴(240px)와 여백을 빼 약 992px, 1024px 창은 약 736px, 420px 창(옆 메뉴 없음)은 약 388px다.
export function Width({
  label,
  className,
  children,
}: {
  label: string
  className: string
  children: ReactNode
}) {
  return (
    <div className="flex max-w-full flex-col gap-1 overflow-x-auto">
      <p className="text-xs text-gray-400">{label}</p>
      <div className={className}>{children}</div>
    </div>
  )
}

export const failed: CardRead = { kind: 'failed', onRetry: noop }
