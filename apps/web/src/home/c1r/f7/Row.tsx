import { ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { headLinkTouch, rowLinkBox, rowLinkTarget } from '@/components/ui/row-link'
import { cn } from '@/lib/utils'
import type { C1rRow } from '../c1r-data'
import type { C1rProps } from '../c1r-props'
import { reasonOf } from './reasons'
import { FACT_COL, ICON_DOT, ICON_GLYPH, ROW, TEXT_SUB, TEXT_TITLE } from './tokens'

type Actions = Pick<C1rProps, 'onOpen' | 'onAsk' | 'onOpenAsked' | 'onAssign'>

const WRAP = 'break-keep wrap-anywhere'
// 둘째 줄의 글 행동: 줄 덮개 위로 올리고(z-10), 390에서 누르는 자리만 44px로 키운다(글자 자리는 그대로).
const SUB_ACTION = cn('relative z-10 h-auto p-0 hover:underline', TEXT_SUB, headLinkTouch)

// 줄 앞 이유 아이콘 원(토스 혜택 줄의 둥근 그림 자리)
function ReasonDot({ row }: { row: C1rRow }) {
  const { icon: Icon, tint } = reasonOf(row)
  return (
    <span
      aria-hidden
      className={cn('flex shrink-0 items-center justify-center rounded-full', ICON_DOT, tint)}
    >
      <Icon className={ICON_GLYPH} strokeWidth={2} />
    </span>
  )
}

// 둘째 줄 = 행동(토스 혜택 줄의 파란 '포인트 받기' 자리). '누구에게 묻기'가 2순위 정보이자 행동이다.
// 배정 줄은 '회장단' + '배정하기'. 뒤에 물어본 상태(그 대화로)를 잇는다. 가운뎃점 대신 간격으로 나눈다.
function ActionLine({
  row,
  onAsk,
  onOpenAsked,
  onAssign,
}: { row: C1rRow } & Omit<Actions, 'onOpen'>) {
  return (
    <div className={cn('mt-0.5 flex min-w-0 flex-wrap items-center gap-x-3', TEXT_SUB)}>
      {row.person ? (
        <Button
          variant="link"
          touch={false}
          className={cn(SUB_ACTION, 'font-medium text-primary-strong')}
          onClick={() => onAsk(row)}
        >
          {`${row.contact}에게 묻기`}
        </Button>
      ) : (
        <span className="flex items-center gap-1.5">
          <span className="text-fg-tertiary">{row.contact}</span>
          <Button
            variant="link"
            touch={false}
            className={cn(SUB_ACTION, 'font-medium text-primary-strong')}
            onClick={() => onAssign(row)}
          >
            배정하기
          </Button>
        </span>
      )}
      {row.askedText && (
        <Button
          variant="link"
          touch={false}
          className={cn(SUB_ACTION, 'gap-0.5 font-normal text-fg-tertiary [&_svg]:size-4')}
          onClick={() => onOpenAsked(row)}
        >
          {row.askedText}
          <ChevronRight aria-hidden />
        </Button>
      )}
    </div>
  )
}

// 오른쪽 끝 = 사실(위험 색은 지남·오늘만) + 그 아래 행사. 왼쪽 두 줄과 줄을 맞춰 넓은 폭에서도 오른쪽이 한 줄만 떠 있지 않게 한다.
function FactColumn({ row }: { row: C1rRow }) {
  return (
    <div
      className={cn(
        'flex shrink-0 flex-col items-end self-start pt-0.5 text-right',
        FACT_COL,
        TEXT_SUB,
      )}
    >
      <span
        className={cn(
          'font-semibold whitespace-nowrap',
          row.danger ? 'text-danger' : 'text-fg-tertiary',
        )}
      >
        {row.fact}
      </span>
      {row.event && <span className="mt-0.5 max-w-full truncate text-fg-muted">{row.event}</span>}
    </div>
  )
}

// 줄: 테두리·선 없이 흰 묶음 안에 흐른다. 아이콘 원 / 큰 제목 + 파란 행동 줄 / 오른쪽 끝 사실.
// 줄 전체가 일 보기(미배정 구성원 줄은 배정하기)다.
export function Row({ row, ...actions }: { row: C1rRow } & Actions) {
  const { onOpen, onAsk, onOpenAsked, onAssign } = actions
  const open = row.kind === 'unassigned' ? onAssign : onOpen
  return (
    <li className={cn('flex items-center', ROW, rowLinkBox)}>
      <ReasonDot row={row} />
      <div className="min-w-0 flex-1">
        <Button
          variant="link"
          touch={false}
          className={cn(
            'h-auto max-w-full justify-start p-0 text-left whitespace-normal text-fg hover:no-underline',
            TEXT_TITLE,
            rowLinkTarget,
          )}
          onClick={() => open(row)}
        >
          <span className={cn('line-clamp-2 @2xl:line-clamp-1', WRAP)}>{row.title}</span>
        </Button>
        <ActionLine row={row} onAsk={onAsk} onOpenAsked={onOpenAsked} onAssign={onAssign} />
      </div>
      <FactColumn row={row} />
    </li>
  )
}
