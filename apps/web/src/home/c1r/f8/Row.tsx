import { ChevronRight } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { rowLinkTarget } from '@/components/ui/row-link'
import { cn } from '@/lib/utils'
import type { C1rRow } from '../c1r-data'
import type { C1rProps } from '../c1r-props'
import { Face, type FaceTints } from './faces'
import { REASON_ICON } from './reasons'
import {
  ANSWER_DOT,
  ASKED_PILL,
  ICON_DOT,
  ICON_GLYPH,
  ROW,
  ROW_BODY,
  ROW_FOCUS,
  TEXT_PILL,
  TEXT_SUB,
  TEXT_TITLE,
  WHO,
} from './tokens'

type Actions = Pick<C1rProps, 'onOpen' | 'onAsk' | 'onOpenAsked' | 'onAssign'>

const WRAP = 'break-keep wrap-anywhere'
// Button 기본 모양(테두리·모서리·크기)을 지우고 글 단추로 쓴다
const BARE = 'border-0 p-0 font-medium'

// 줄 앞 이유 아이콘 원(중립 회색, reasons.ts 참고)
function ReasonDot({ icon: Icon }: { icon: LucideIcon }) {
  return (
    <span
      aria-hidden
      className={cn('flex shrink-0 items-center justify-center rounded-full', ICON_DOT)}
    >
      <Icon className={ICON_GLYPH} strokeWidth={2} />
    </span>
  )
}

// 무엇: 제목(줄 전체 = 일 보기) + 그 아래 사실·행사. 사실이 제목 바로 밑에 붙어 977에서도 줄 오른쪽 끝으로 떨어지지 않는다.
function What({ row, open }: { row: C1rRow; open: () => void }) {
  return (
    <div className="min-w-0">
      <Button
        variant="link"
        data-title
        className={cn(
          BARE,
          'h-auto max-w-full justify-start text-left whitespace-normal text-fg hover:no-underline',
          TEXT_TITLE,
          rowLinkTarget,
        )}
        onClick={open}
      >
        <span className={cn('line-clamp-2 @2xl:line-clamp-1', WRAP)}>{row.title}</span>
      </Button>
      <p className={cn('mt-0.5 flex min-w-0 items-baseline gap-1.5', TEXT_SUB)}>
        <span
          className={cn(
            'shrink-0 font-semibold whitespace-nowrap',
            row.danger ? 'text-danger' : 'text-fg-tertiary',
          )}
        >
          {row.fact}
        </span>
        {row.event && (
          <>
            <span aria-hidden className="text-fg-muted">
              ·
            </span>
            <span className="min-w-0 truncate text-fg-muted">{row.event}</span>
          </>
        )}
      </p>
    </div>
  )
}

// 물어봄 말풍선 알약: '10월 28일 물어봄'과 답 표시. 답 있음은 새 소식이라 파란 면 + 점 + 굵게, 답 없음은 회색 면.
function AskedPill({ text, answered }: { text: string; answered: boolean }) {
  const [date, answer] = text.split(' · ')
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center whitespace-nowrap',
        ASKED_PILL,
        TEXT_PILL,
        answered ? 'bg-primary-surface text-primary-strong' : 'bg-muted text-fg-secondary',
      )}
    >
      {answered && <span aria-hidden className={cn('rounded-full bg-primary', ANSWER_DOT)} />}
      <span className={answered ? 'text-fg-secondary' : undefined}>{date}</span>
      <span aria-hidden className={answered ? 'text-fg-secondary' : undefined}>
        ·
      </span>
      <span className={answered ? 'font-semibold' : 'font-normal'}>{answer}</span>
      <ChevronRight aria-hidden className="-mr-1 size-4" />
    </span>
  )
}

// 누구: 작은 얼굴 + 사람. 안 물은 줄 = 파란 '…에게 묻기'(행동), 물은 줄 = 사람 이름 + 물어봄 알약(그 대화 열기).
// 이 단추는 줄 덮개 위에 따로 있어, 줄(일 보기)과 누르는 자리가 겹치지 않는다.
function Who({
  row,
  tints,
  onAsk,
  onOpenAsked,
}: { row: C1rRow; tints: FaceTints } & Pick<Actions, 'onAsk' | 'onOpenAsked'>) {
  if (!row.person) return null
  if (row.askedText && row.asked)
    return (
      <Button
        variant="ghost"
        data-who
        className={cn(
          BARE,
          WHO,
          'group/who max-w-full flex-wrap justify-start gap-x-2 gap-y-1.5 max-sm:-mt-1 max-sm:mb-0 bg-transparent text-left whitespace-normal hover:bg-transparent',
          TEXT_SUB,
        )}
        onClick={() => onOpenAsked(row)}
      >
        <Face person={row.person} tints={tints} />
        <span className="text-fg-secondary group-hover/who:underline">{row.contact}</span>
        <AskedPill text={row.askedText} answered={row.asked.answered} />
      </Button>
    )
  return (
    <Button
      variant="link"
      data-who
      className={cn(
        BARE,
        WHO,
        '-mx-1.5 gap-2 px-1.5 pr-2.5 text-primary-strong hover:bg-primary-surface hover:no-underline',
        TEXT_SUB,
      )}
      onClick={() => onAsk(row)}
    >
      <Face person={row.person} tints={tints} />
      {`${row.contact}에게 묻기`}
    </Button>
  )
}

// 일 줄: 아이콘 원 / 무엇(제목·사실) / 누구(얼굴·묻기) / 일 보기 꺾쇠.
export function TaskRow({
  row,
  tints,
  ...actions
}: { row: C1rRow; tints: FaceTints } & Omit<Actions, 'onAssign'>) {
  const { onOpen, onAsk, onOpenAsked } = actions
  return (
    <li className={cn('relative flex items-center', ROW, ROW_FOCUS)}>
      <ReasonDot icon={REASON_ICON[row.kind]} />
      <div className={ROW_BODY}>
        <What row={row} open={() => onOpen(row)} />
        <div className="mt-1.5 min-w-0 @2xl:mt-0">
          <Who row={row} tints={tints} onAsk={onAsk} onOpenAsked={onOpenAsked} />
        </div>
      </div>
      <ChevronRight aria-hidden className="size-5 shrink-0 text-fg-muted" />
    </li>
  )
}

// 배정 줄: 회장단이 직접 할 일(부서 미정 업무, 미배정 구성원)을 한 줄로 모아 늘 보인다.
// 가는 곳이 둘(업무 상세 / 운영진 > 사람)이라 줄 전체를 누르게 하지 않고, 누구 칸에 파란 글 단추를 갈래마다 하나씩 둔다.
export function AssignRow({ rows, onAssign }: { rows: C1rRow[] } & Pick<Actions, 'onAssign'>) {
  const noDepartment = rows.filter(row => row.kind === 'no-department')
  const unassigned = rows.find(row => row.kind === 'unassigned')
  const [firstTask] = noDepartment
  const link = cn(
    BARE,
    WHO,
    '-mx-1.5 gap-0.5 px-1.5 text-primary-strong hover:bg-primary-surface hover:no-underline [&_svg]:size-4',
    TEXT_SUB,
  )
  return (
    <li className={cn('relative flex items-center', ROW, 'hover:bg-transparent')}>
      <ReasonDot icon={REASON_ICON.unassigned} />
      <div className={ROW_BODY}>
        <p className={cn('text-fg', TEXT_TITLE)}>회장단이 배정할 일</p>
        <div className="mt-1.5 flex min-w-0 flex-wrap gap-x-4 gap-y-1 @2xl:mt-0">
          {firstTask && (
            <Button variant="link" className={link} onClick={() => onAssign(firstTask)}>
              {`부서 미정 업무 ${noDepartment.length}건`}
              <ChevronRight aria-hidden className="@max-2xl:hidden" />
            </Button>
          )}
          {unassigned && (
            <Button variant="link" className={link} onClick={() => onAssign(unassigned)}>
              {unassigned.title}
              <ChevronRight aria-hidden className="@max-2xl:hidden" />
            </Button>
          )}
        </div>
      </div>
      {/* 일 줄의 꺾쇠 칸과 폭을 맞춰 누구 칸이 같은 세로선에 선다 */}
      <span aria-hidden className="size-5 shrink-0 @max-2xl:hidden" />
    </li>
  )
}
