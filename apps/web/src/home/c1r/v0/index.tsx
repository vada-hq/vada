import { ChevronRight, CircleAlert } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cardClass } from '@/components/ui/card'
import { headLinkTouch, rowLinkBox, rowLinkTarget } from '@/components/ui/row-link'
import { cn } from '@/lib/utils'
import { C1R_SHOWN, C1R_TITLE, type C1rRow } from '../c1r-data'
import type { C1rProps } from '../c1r-props'

// v0 기준안: 와이어프레임 HOME-01C '확인이 필요한 운영 상황' 카드의 표현 그대로(명세 10절).
// 카드 머리 = 아이콘 + 제목 + 오른쪽 '전체 n건 보기', 줄 = 제목 / 메타 두 줄 + 오른쪽 상태 칩, 맨 아래 미배정 구성원 줄.
// 명세 1~8절만 얹었다: 칩 글은 객관적 사실, 메타 줄은 연락할 사람, 칩 색은 지남·오늘만 위험, 나머지 중립.
// 미배정 줄은 와이어프레임처럼 카드 맨 아래 한 줄로 두고, 상한 5줄 안에 센다.

const HEAD_ID = 'c1r-v0-head'
const WRAP = 'break-keep wrap-anywhere'
const LINK_XS = cn('relative z-10 h-auto p-0 text-xs font-medium', headLinkTouch)

function Head({ total, more, onSeeAll, divided }: { total: number; more: boolean; onSeeAll: () => void; divided: boolean }) {
  return (
    <div className={cn('flex items-center gap-2 px-4 py-3', divided && 'border-b border-gray-200')}>
      <CircleAlert aria-hidden className="size-4 shrink-0 text-gray-500" />
      <h2 id={HEAD_ID} className={cn('min-w-0 flex-1 text-sm font-semibold text-gray-900', WRAP)}>
        {C1R_TITLE}
      </h2>
      {total === 0 ? (
        <span className="text-xs text-gray-500">없음</span>
      ) : more ? (
        <Button variant="link" className={cn('h-auto gap-0.5 p-0 text-xs', headLinkTouch)} onClick={onSeeAll}>
          {`전체 ${total}건 보기`}
          <ChevronRight />
        </Button>
      ) : (
        <span className="text-xs text-gray-500">{`${total}건`}</span>
      )}
    </div>
  )
}

// 메타 줄: 연락할 사람(누르면 묻기) + 물어본 상태(누르면 그 대화) 또는 '· 행사'. 물어본 상태는 꼴 안에 가운뎃점이 있어
// 앞에 점을 더 붙이지 않는다(한 줄 가운뎃점 1개).
function Meta({ row, onAsk, onOpenAsked }: { row: C1rRow } & Pick<C1rProps, 'onAsk' | 'onOpenAsked'>) {
  return (
    <p className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-1.5 text-xs text-gray-500">
      {row.person ? (
        <Button variant="link" touch={false} className={LINK_XS} aria-label={`${row.contact}에게 묻기`} onClick={() => onAsk(row)}>
          {row.contact}
        </Button>
      ) : (
        <span>{row.contact}</span>
      )}
      {row.askedText ? (
        <Button variant="link" touch={false} className={cn(LINK_XS, 'ml-1.5 font-normal')} onClick={() => onOpenAsked(row)}>
          {row.askedText}
        </Button>
      ) : (
        row.event && (
          <span className="flex min-w-0 flex-1 gap-x-1.5">
            <span aria-hidden>·</span>
            <span className="truncate">{row.event}</span>
          </span>
        )
      )}
    </p>
  )
}

function Row({ row, onOpen, onAsk, onOpenAsked }: { row: C1rRow } & Pick<C1rProps, 'onOpen' | 'onAsk' | 'onOpenAsked'>) {
  return (
    <li className={cn('flex items-center gap-3 px-4 py-3 hover:bg-gray-50', rowLinkBox)}>
      <div className="min-w-0 flex-1">
        <Button
          variant="link"
          touch={false}
          className={cn(
            'h-auto max-w-full justify-start p-0 text-left text-sm font-semibold whitespace-normal text-gray-900 hover:no-underline',
            rowLinkTarget,
          )}
          onClick={() => onOpen(row)}
        >
          <span className={cn('line-clamp-2 @2xl:line-clamp-1', WRAP)}>{row.title}</span>
        </Button>
        <Meta row={row} onAsk={onAsk} onOpenAsked={onOpenAsked} />
      </div>
      {row.danger ? (
        <Badge tone="danger">{row.fact}</Badge>
      ) : (
        <Badge tone="neutral" className="text-gray-700">
          {row.fact}
        </Badge>
      )}
    </li>
  )
}

// 와이어프레임 맨 아래 줄: '미배정 구성원 1명 · 조직 관리에서 배정 >'. 줄 전체가 운영진 > 사람으로 간다.
function Unassigned({ row, onAssign }: { row: C1rRow; onAssign: (row: C1rRow) => void }) {
  return (
    <div className="border-t border-gray-100">
      <Button
        variant="ghost"
        className="h-auto w-full justify-between rounded-none px-4 py-3 text-xs font-normal text-gray-500 hover:text-gray-500 max-sm:min-h-11"
        onClick={() => onAssign(row)}
      >
        <span className={WRAP}>
          {'미배정 구성원 '}
          <span className="font-semibold text-gray-900">{`${row.count}명`}</span>
          {' · '}
          <span className="text-blue-700">조직 관리에서 배정</span>
        </span>
        <ChevronRight className="text-gray-500" />
      </Button>
    </div>
  )
}

export default function C1rV0({ data, onOpen, onAsk, onOpenAsked, onAssign, onSeeAll }: C1rProps) {
  const unassigned = data.rows.find(row => row.kind === 'unassigned') ?? null
  const rows = data.rows.filter(row => row.kind !== 'unassigned').slice(0, C1R_SHOWN - (unassigned ? 1 : 0))
  return (
    <section aria-labelledby={HEAD_ID} className={cn(cardClass, 'overflow-hidden bg-white')}>
      <Head total={data.total} more={data.total > C1R_SHOWN} onSeeAll={onSeeAll} divided={data.total > 0} />
      {rows.length > 0 && (
        <ul className="divide-y divide-gray-100">
          {rows.map(row => (
            <Row key={row.id} row={row} onOpen={onOpen} onAsk={onAsk} onOpenAsked={onOpenAsked} />
          ))}
        </ul>
      )}
      {unassigned && <Unassigned row={unassigned} onAssign={onAssign} />}
    </section>
  )
}
