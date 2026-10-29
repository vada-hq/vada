import { ChevronRight, ClipboardCheck, FileImage, NotebookPen, type LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { rowLinkTarget } from '@/components/ui/row-link'
import { cn } from '@/lib/utils'
import { Face, type FaceTints } from '../c1r/f8/faces'
import { REASON_ICON } from '../c1r/f8/reasons'
import {
  ICON_DOT,
  ICON_GLYPH,
  ROW,
  ROW_BODY,
  ROW_FOCUS,
  TEXT_SUB,
  TEXT_TITLE,
  WHO,
} from '../c1r/f8/tokens'
import type { TodoKind, TodoRow as Row } from './c35-data'
import { ACTION_PILL, ACTION_SLOT, ACTION_TOUCH } from './tokens'

// ③ 줄: ①f8의 줄(아이콘 원 / 무엇 | 누구 / 오른쪽)을 그대로 쓰고, 오른쪽만 다르다.
// ①은 '…에게 묻기'(파란 글)가 누구 칸에 있고 줄 끝은 꺾쇠, ③은 줄 끝에 파란 면을 채운 '확인하기'·'보기' 알약이다(업무 줄은 꺾쇠).
// 누구 칸에는 회장단 업무의 담당자 얼굴, 행사 정리의 정산 남음이면 재정부장 얼굴 + 묻기(①과 같은 생김새)를 둔다.

export type TodoActions = {
  // 줄·확인하기·보기: 원래 화면(회의록 / 행사 정리 / 결과물 / 업무 패널)
  onOpen: (row: Row) => void
  // 정산 남음 묻기: 재정부장과의 대화(행사 정리가 붙은 채로)
  onAsk: (row: Row) => void
}

const WRAP = 'break-keep wrap-anywhere'
const BARE = 'border-0 p-0 font-medium'

// 초안·결과물은 새 그림, 업무 줄은 ①과 같은 그림(지남·오늘)을 쓴다
const ICON: Record<TodoKind, LucideIcon> = {
  minutes: NotebookPen,
  'event-report': ClipboardCheck,
  review: FileImage,
  late: REASON_ICON.late,
  today: REASON_ICON.today,
}

function KindDot({ icon: Icon }: { icon: LucideIcon }) {
  return (
    <span
      aria-hidden
      className={cn('flex shrink-0 items-center justify-center rounded-full', ICON_DOT)}
    >
      <Icon className={ICON_GLYPH} strokeWidth={2} />
    </span>
  )
}

function What({ row, open }: { row: Row; open: () => void }) {
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
      <p className={cn('mt-0.5 min-w-0', TEXT_SUB)}>
        <span
          data-c35-danger={row.danger || undefined}
          className={cn('font-semibold', row.danger ? 'text-danger' : 'text-fg-tertiary', WRAP)}
        >
          {row.fact}
        </span>
      </p>
    </div>
  )
}

// 누구 칸: 회장단 업무 담당자(얼굴 + 이름, 글) 또는 정산 남음의 재정부장 묻기(①과 같은 파란 글 단추)
function Who({ row, tints, onAsk }: { row: Row; tints: FaceTints; onAsk: () => void }) {
  if (row.settlement) {
    const { contact } = row.settlement
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
        onClick={onAsk}
      >
        <Face person={contact} tints={tints} />
        {`${contact.name} ${contact.role}에게 묻기`}
      </Button>
    )
  }
  if (!row.owner) return null
  return (
    <span className={cn('flex items-center gap-2 text-fg-secondary', TEXT_SUB)}>
      <Face person={row.owner} tints={tints} />
      {`${row.owner.name} ${row.owner.role}`}
    </span>
  )
}

// 오른쪽: 확인하기·보기 알약(덮개 위 따로 누르는 링크) 또는 업무 줄의 꺾쇠
function Action({ row, open }: { row: Row; open: () => void }) {
  if (!row.action) return <ChevronRight aria-hidden className="size-5 text-fg-muted" />
  return (
    <Button
      variant="ghost"
      data-who
      className={cn(
        BARE,
        ACTION_TOUCH,
        'group/act relative z-10 h-auto rounded-full bg-transparent hover:bg-transparent',
      )}
      onClick={open}
    >
      <span className={cn('inline-flex items-center whitespace-nowrap', ACTION_PILL, TEXT_SUB)}>
        {row.action}
        <ChevronRight aria-hidden className="-mr-1 size-4" />
      </span>
    </Button>
  )
}

export function TodoRow({
  row,
  tints,
  onOpen,
  onAsk,
}: { row: Row; tints: FaceTints } & TodoActions) {
  const open = () => onOpen(row)
  return (
    <li data-c35-row={row.id} className={cn('relative flex items-center', ROW, ROW_FOCUS)}>
      <KindDot icon={ICON[row.kind]} />
      <div className={ROW_BODY}>
        <What row={row} open={open} />
        <div className="mt-1.5 min-w-0 empty:hidden @2xl:mt-0">
          <Who row={row} tints={tints} onAsk={() => onAsk(row)} />
        </div>
      </div>
      <div className={ACTION_SLOT}>
        <Action row={row} open={open} />
      </div>
    </li>
  )
}
