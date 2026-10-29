import { ChevronRight, CircleCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { headLinkTouch, rowLinkBox, rowLinkTarget } from '@/components/ui/row-link'
import { cn } from '@/lib/utils'
import { C1R_SHOWN, C1R_TITLE, type C1rRow } from '../c1r-data'
import type { C1rProps } from '../c1r-props'
import { Avatar, contactsOf, FaceStage, type Contact } from './faces'
import { F4 } from './tokens'

// f4 '얼굴로 묶기'(c1f 형태 라, 레퍼런스 f08 Messages 고정 대화 · f09 Flighty 친구 · f10 Duolingo 친구 퀘스트).
// 테두리 없는 둥근 흰 카드 = 머리 / 회색 무대 위 얼굴 줄(누구에게) / 작은 얼굴을 앞에 둔 선 없는 일 목록(무엇이 막혔나).
// 얼굴은 줄 전체를 사람 단위로 묶어 배지 합 = 머리 건수, 목록은 급한 차례로 상한 5줄.

const HEAD_ID = 'c1r-f4-head'
const WRAP = 'break-keep wrap-anywhere'

function SeeAll({
  total,
  onSeeAll,
  className,
}: {
  total: number
  onSeeAll: () => void
  className: string
}) {
  return (
    <Button
      variant="link"
      className={cn('h-auto gap-0.5 p-0 text-sm text-primary-strong', className)}
      onClick={onSeeAll}
    >
      {`전체 ${total}건 보기`}
      <ChevronRight />
    </Button>
  )
}

function Head({ total, more, onSeeAll }: { total: number; more: boolean; onSeeAll: () => void }) {
  return (
    <div className={cn('flex items-center gap-2 px-5', total === 0 ? 'py-4' : 'pt-4 pb-3')}>
      {total === 0 && <CircleCheck aria-hidden className="size-5 shrink-0 text-fg-muted" />}
      <h2 id={HEAD_ID} className={cn('min-w-0 text-base font-semibold text-fg', WRAP)}>
        {C1R_TITLE}
      </h2>
      {total > 0 && (
        <span className="text-base font-semibold text-fg-muted tabular-nums">{total}</span>
      )}
      <span className="ml-auto" />
      {total === 0 ? (
        <span className="text-sm text-fg-muted">없음</span>
      ) : (
        more && (
          <SeeAll
            total={total}
            onSeeAll={onSeeAll}
            className={cn('hidden @2xl:inline-flex', headLinkTouch)}
          />
        )
      )}
    </div>
  )
}

// 사실 알약: 지남·오늘만 위험 면·글자, 나머지는 중립 면. 글로 다 읽힌다(색만으로 말하지 않음).
function Fact({ row }: { row: C1rRow }) {
  return (
    <span
      className={cn(
        'shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap',
        row.danger ? 'bg-danger-surface text-danger' : 'bg-muted text-fg-secondary',
      )}
    >
      {row.fact}
    </span>
  )
}

// 둘째 줄: 연락할 사람 + 물어본 상태(누르면 그 대화) 또는 '· 행사'. 물어본 상태 꼴 안에 가운뎃점이 있어 앞에 점을 더 붙이지 않는다. 좁으면 물어본 상태는 자르지 않고 다음 줄로 내린다.
function Meta({ row, onOpenAsked }: { row: C1rRow; onOpenAsked: (row: C1rRow) => void }) {
  return (
    <p className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-1.5 text-xs text-fg-muted">
      <span className="shrink-0 text-fg-secondary">{row.contact}</span>
      {row.askedText ? (
        <Button
          variant="link"
          touch={false}
          className={cn(
            'relative z-10 h-auto p-0 text-xs font-normal text-primary-strong',
            headLinkTouch,
          )}
          onClick={() => onOpenAsked(row)}
        >
          {row.askedText}
        </Button>
      ) : (
        row.event && (
          <>
            <span aria-hidden>·</span>
            <span className="min-w-0 flex-1 truncate">{row.event}</span>
          </>
        )
      )}
    </p>
  )
}

type RowProps = { row: C1rRow; contact: Contact } & Pick<
  C1rProps,
  'onOpen' | 'onOpenAsked' | 'onAssign'
>

// 줄 = 작은 얼굴 + 제목/둘째 줄 + 오른쪽 사실 알약. 선 없이 둥근 면, 줄 전체가 일 보기(미배정 줄은 배정하기).
function Row({ row, contact, onOpen, onOpenAsked, onAssign }: RowProps) {
  const open = () => (row.kind === 'unassigned' ? onAssign(row) : onOpen(row))
  return (
    <li
      className={cn(
        F4.rowRadius,
        'flex items-center gap-3 px-3 py-2.5 hover:bg-surface-subtle',
        rowLinkBox,
      )}
    >
      <Avatar contact={contact} size="row" />
      <div className="min-w-0 flex-1">
        <Button
          variant="link"
          touch={false}
          className={cn(
            'h-auto max-w-full justify-start p-0 text-left text-sm font-semibold whitespace-normal text-fg hover:no-underline',
            rowLinkTarget,
          )}
          onClick={open}
        >
          <span className={cn('line-clamp-2 @2xl:line-clamp-1', WRAP)}>{row.title}</span>
        </Button>
        <Meta row={row} onOpenAsked={onOpenAsked} />
      </div>
      <Fact row={row} />
    </li>
  )
}

export default function C1rF4({ data, onOpen, onAsk, onOpenAsked, onAssign, onSeeAll }: C1rProps) {
  const contacts = contactsOf(data.rows)
  const rows = data.rows.slice(0, C1R_SHOWN)
  const more = data.total > C1R_SHOWN
  return (
    <section aria-labelledby={HEAD_ID} className={cn(F4.cardRadius, F4.cardShadow, 'bg-card')}>
      <Head total={data.total} more={more} onSeeAll={onSeeAll} />
      {data.total > 0 && (
        <div className="pb-2">
          {/* 무대는 고를 사람이 둘 이상일 때만. 하나뿐이면 줄의 작은 얼굴과 같은 말을 되풀이한다(첫날 견본) */}
          {contacts.length > 1 && (
            <FaceStage contacts={contacts} onAsk={onAsk} onAssign={onAssign} />
          )}
          <ul className={cn('px-2', contacts.length > 1 && 'mt-2')}>
            {rows.flatMap(row => {
              const contact = contacts.find(c => c.rows.includes(row))
              return contact
                ? [
                    <Row
                      key={row.id}
                      row={row}
                      contact={contact}
                      onOpen={onOpen}
                      onOpenAsked={onOpenAsked}
                      onAssign={onAssign}
                    />,
                  ]
                : []
            })}
          </ul>
          {more && (
            <div className="flex justify-center @2xl:hidden">
              <SeeAll total={data.total} onSeeAll={onSeeAll} className="min-h-11 px-4" />
            </div>
          )}
        </div>
      )}
    </section>
  )
}
