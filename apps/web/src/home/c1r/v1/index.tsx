import { ChevronRight, MessageCircle, UserPlus } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cardClass } from '@/components/ui/card'
import { headLinkTouch, rowLinkBox, rowLinkTarget } from '@/components/ui/row-link'
import { cn } from '@/lib/utils'
import { C1R_SHOWN, C1R_TITLE, type C1rRow } from '../c1r-data'
import type { C1rProps } from '../c1r-props'

// v1: 끝에 사실을 세운 한 목록(갈래 1: Linear Inbox, Zendesk SLA 보기, GOV.UK task list).
// 묶지 않고 급한 순 그대로 상한 5줄. 줄 오른쪽 끝에 객관적 사실이 한 세로 줄로 서고(지남·오늘만 위험 칩, 나머지는 맨글),
// 그 바로 왼쪽에 연락할 사람이 한 세로 줄로 선다. 사람 이름 자체가 묻기 단추라 hover 없이도 늘 보인다.
// 977·716은 한 줄(제목 · 행사 | 사람 | 사실), 358은 두 줄(제목 + 사실 / 사람 · 행사).

const HEAD_ID = 'c1r-v1-head'
const WRAP = 'break-keep wrap-anywhere'
// 줄 안 작은 링크: 줄 덮개 위로 올리고, 휴대폰에서만 누르는 자리를 44px로 키운다(줄 높이는 그대로).
const INLINE_LINK = cn('relative z-10 h-auto p-0 font-normal', headLinkTouch)

// 배정 줄(부서 미정·미배정)은 회장단이 직접 하는 일이라 줄을 누르면 배정하러 간다.
const isAssign = (row: C1rRow) => row.person === null

function Head({ total }: { total: number }) {
  return (
    <div className="flex items-baseline gap-2 px-4 py-3">
      <h2 id={HEAD_ID} className={cn('min-w-0 text-sm font-semibold text-gray-900', WRAP)}>
        {C1R_TITLE}
      </h2>
      <span className="shrink-0 text-sm text-gray-500">{total === 0 ? '없음' : `${total}건`}</span>
    </div>
  )
}

// 사실: 지남·오늘만 위험 칩, 나머지는 칩 없이 같은 자리·같은 글자 크기의 맨글(GOV.UK의 '손댈 일만 칩'과 같은 생각,
// Zendesk처럼 넘긴 것만 진하게). 글 오른쪽 끝을 칩 글과 맞추려고 맨글에도 칩과 같은 좌우 여백을 준다.
function Fact({ row }: { row: C1rRow }) {
  return (
    <span className="order-2 flex shrink-0 justify-end @2xl:order-4 @2xl:w-24">
      {row.danger ? (
        <Badge tone="danger">{row.fact}</Badge>
      ) : (
        <span className="border border-transparent px-2 py-0.5 text-xs font-medium whitespace-nowrap text-gray-700">
          {row.fact}
        </span>
      )}
    </span>
  )
}

// 연락할 사람: 이름 자체가 행동이다. 사람이 있으면 말풍선 + 이름 = 묻기(이미 물었으면 그 대화),
// 배정 줄은 사람 더하기 + '회장단' = 배정하기(줄을 눌러도 같은 곳). 둘 다 늘 보이는 같은 자리·같은 모양이다.
function Contact({
  row,
  onAsk,
  onOpenAsked,
  onAssign,
}: { row: C1rRow } & Pick<C1rProps, 'onAsk' | 'onOpenAsked' | 'onAssign'>) {
  const assign = isAssign(row)
  const Icon = assign ? UserPlus : MessageCircle
  return (
    <span className="flex shrink-0 @2xl:order-3 @2xl:w-40">
      <Button
        variant="link"
        touch={false}
        className={cn(
          INLINE_LINK,
          'gap-1 text-xs font-medium @2xl:gap-1.5 @2xl:text-sm [&_svg]:size-3.5 @2xl:[&_svg]:size-4',
        )}
        aria-label={assign ? `${row.contact} 배정하기` : `${row.contact}에게 묻기`}
        onClick={() => (assign ? onAssign(row) : row.asked ? onOpenAsked(row) : onAsk(row))}
      >
        <Icon aria-hidden />
        {row.contact}
      </Button>
    </span>
  )
}

// 제목 뒤(977·716) 또는 사람 뒤(358)의 덧글: 물어봤으면 물어본 상태(누르면 그 대화), 아니면 '· 행사'.
// 물어본 상태 꼴 안에 가운뎃점이 있어 행사를 함께 싣지 않는다(한 줄 가운뎃점 1개).
function Extra({ row, onOpenAsked }: { row: C1rRow } & Pick<C1rProps, 'onOpenAsked'>) {
  if (row.askedText)
    return (
      // 358에서는 바로 앞 이름 링크와 붙어 한 덩이로 읽히지 않게 사이를 넓힌다.
      <span className="ml-1.5 flex min-w-0 @2xl:order-2 @2xl:ml-0 @2xl:flex-1">
        <Button
          variant="link"
          touch={false}
          className={cn(INLINE_LINK, 'text-xs')}
          onClick={() => onOpenAsked(row)}
        >
          {row.askedText}
        </Button>
      </span>
    )
  if (!row.event) return <span aria-hidden className="hidden @2xl:order-2 @2xl:block @2xl:flex-1" />
  return (
    // 점 앞뒤 간격을 같게: 358은 둘째 줄 간격(6px), 977·716은 줄 간격(12px)에 맞춘다.
    <span className="flex min-w-0 flex-1 gap-1.5 text-xs text-gray-500 @2xl:order-2 @2xl:gap-3">
      <span aria-hidden>·</span>
      <span className="truncate">{row.event}</span>
    </span>
  )
}

function Row({
  row,
  onOpen,
  onAsk,
  onOpenAsked,
  onAssign,
}: { row: C1rRow } & Omit<C1rProps, 'data' | 'onSeeAll'>) {
  return (
    <li
      className={cn(
        'flex flex-wrap items-start gap-x-3 gap-y-1 px-4 py-3 hover:bg-gray-50 @2xl:flex-nowrap @2xl:items-center',
        rowLinkBox,
      )}
    >
      <Button
        variant="link"
        touch={false}
        className={cn(
          'order-1 h-auto min-w-0 flex-1 justify-start p-0 text-left text-sm font-semibold whitespace-normal text-gray-900 hover:no-underline @2xl:flex-initial',
          rowLinkTarget,
        )}
        onClick={() => (isAssign(row) ? onAssign(row) : onOpen(row))}
      >
        <span className={cn('line-clamp-2 @2xl:line-clamp-1', WRAP)}>{row.title}</span>
      </Button>
      <Fact row={row} />
      {/* 358: 제목 아래 둘째 줄(사람 · 덧글). 977·716: 상자를 풀어 사람과 덧글이 각자 세로 줄 자리로 간다. */}
      <div className="order-3 flex min-w-0 basis-full flex-wrap items-center gap-x-1.5 @2xl:contents">
        <Contact row={row} onAsk={onAsk} onOpenAsked={onOpenAsked} onAssign={onAssign} />
        <Extra row={row} onOpenAsked={onOpenAsked} />
      </div>
    </li>
  )
}

export default function C1rV1({ data, onOpen, onAsk, onOpenAsked, onAssign, onSeeAll }: C1rProps) {
  const rows = data.rows.slice(0, C1R_SHOWN)
  return (
    <section aria-labelledby={HEAD_ID} className={cn(cardClass, 'overflow-hidden bg-white')}>
      <Head total={data.total} />
      {rows.length > 0 && (
        <ul className="divide-y divide-gray-100 border-t border-gray-200">
          {rows.map(row => (
            <Row
              key={row.id}
              row={row}
              onOpen={onOpen}
              onAsk={onAsk}
              onOpenAsked={onOpenAsked}
              onAssign={onAssign}
            />
          ))}
        </ul>
      )}
      {data.total > C1R_SHOWN && (
        <div className="border-t border-gray-100">
          <Button
            variant="link"
            className="h-auto w-full justify-start gap-0.5 rounded-none px-4 py-3 text-sm max-sm:min-h-11"
            onClick={onSeeAll}
          >
            {`전체 ${data.total}건 보기`}
            <ChevronRight />
          </Button>
        </div>
      )}
    </section>
  )
}
