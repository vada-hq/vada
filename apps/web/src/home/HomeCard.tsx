import { useId, type ReactNode } from 'react'
import { ChevronRight, type LucideIcon } from 'lucide-react'
import { HOME_CARD_ROWS } from '@vada/contracts'
import { Button } from '@/components/ui/button'
import { cardClass } from '@/components/ui/card'
import { cn } from '@/lib/utils'

// 카드 자료의 상태. 아직 읽지 못했거나 읽기에 실패한 카드는 0으로 세지 않는다(DEC-95, 기획자 D-11 ③).
// 줄은 서버가 정한 차례 그대로이고 카드는 다시 줄 세우지 않는다. total은 줄 수가 아니라 전체 수다.
export type CardRead =
  | { kind: 'loading' }
  | { kind: 'failed'; onRetry: () => void }
  | { kind: 'ready'; total: number; rows: ReactNode[] }

// 카드 아래 조건부 줄(미배정 구성원, 마감 몰림). 대상이 없으면 null로 넘겨 줄째 없앤다.
type CardFootnote = { label: string; text: string; onOpen: () => void }

type Props = {
  title: string
  // 와이어프레임 카드 머리의 회색 아이콘
  icon: LucideIcon
  read: CardRead
  // 0건일 때 가운데 한 줄('○○ 없음')
  empty: string
  // 0건일 때 빈 문구 아래(할 수 있는 사람의 [새 행사], 할 수 없는 사람에게 누가 하는지)
  emptyAction?: ReactNode
  unit?: '건' | '개'
  // 원래 화면의 그 거르기. 도착할 화면 하나가 없는 카드(가까운 일정)는 넘기지 않아 수만 둔다.
  onSeeAll?: (() => void) | undefined
  footnote?: CardFootnote | null | undefined
  // 읽었을 때 수 대신 둘 머리 글(회장단 행사 머리의 상태별 수, '바로가기')
  aside?: ReactNode
  // 줄 대신 칸 카드로 늘어놓는다(가로 전체 카드). 본문이 좁으면 한 단이다.
  tiles?: boolean | undefined
}

// 머리 오른쪽: 3건 이하면 회색 '{n}건'(0도 '0건'), 넘으면 파란 '전체 {n}건 보기'. 읽지 못했으면 '집계 전'만이다.
// aside(회장단 행사 머리의 상태별 수, '바로가기')는 수 자리에 두고 전체 보기와 함께 나온다.
function CardCount({
  read,
  unit,
  onSeeAll,
  aside,
}: Pick<Props, 'read' | 'onSeeAll' | 'aside'> & { unit: string }) {
  if (read.kind !== 'ready') return <span className="shrink-0 text-xs text-gray-500">집계 전</span>
  const seeAll = read.total > HOME_CARD_ROWS && onSeeAll !== undefined
  return (
    <div className="flex min-w-0 flex-wrap items-center justify-end gap-x-3 gap-y-1 text-right">
      {aside !== undefined && <span className="text-xs break-keep text-gray-500">{aside}</span>}
      {aside === undefined && !seeAll && (
        <span className="shrink-0 text-xs text-gray-500">{`${read.total}${unit}`}</span>
      )}
      {seeAll && (
        // 휴대폰에서 누르는 영역을 44px로 키우되 머리 바 높이는 그대로 둔다(WCAG 2.5.8).
        <Button
          variant="link"
          size="sm"
          className="h-auto shrink-0 gap-0.5 p-0 text-xs max-sm:-my-3 max-sm:min-h-11"
          onClick={onSeeAll}
        >
          {`전체 ${read.total}${unit} 보기`}
          <ChevronRight aria-hidden />
        </Button>
      )}
    </div>
  )
}

const centerClass = 'flex flex-col items-center justify-center gap-3 px-5 py-8 text-center'

function CardBody({
  read,
  empty,
  emptyAction,
  tiles,
}: Pick<Props, 'read' | 'empty' | 'emptyAction' | 'tiles'>) {
  // 읽는 동안은 머리의 '집계 전'만 두고 자리를 지킨다(줄이 들어와도 카드 높이가 크게 뛰지 않게).
  if (read.kind === 'loading') return <div className={centerClass} aria-hidden />
  if (read.kind === 'failed')
    return (
      <div className={centerClass}>
        <Button variant="outline" size="sm" onClick={read.onRetry}>
          다시 불러오기
        </Button>
      </div>
    )
  if (read.total === 0)
    return (
      <div className={centerClass}>
        <p className="text-sm break-keep text-gray-500">{empty}</p>
        {emptyAction}
      </div>
    )
  const listClass = tiles ? 'grid gap-3 p-4 @2xl:grid-cols-3' : 'divide-y divide-gray-100'
  return <ul className={listClass}>{read.rows.slice(0, HOME_CARD_ROWS)}</ul>
}

// 와이어프레임 HomePrototypeFootnote: 카드 아래 옅은 회색 줄. 어디를 눌러도 그 화면으로 간다.
function Footnote({ label, text, onOpen }: CardFootnote) {
  return (
    <div className="border-t border-gray-100 bg-gray-50">
      <Button
        variant="ghost"
        className="h-auto w-full justify-start gap-2 rounded-none px-5 py-2.5 text-left text-xs font-normal whitespace-normal text-gray-700 max-sm:min-h-11"
        onClick={onOpen}
      >
        <span className="shrink-0 text-gray-500">{label}</span>
        <span className="min-w-0 flex-1 break-keep wrap-anywhere">{text}</span>
        <ChevronRight aria-hidden className="text-gray-400" />
      </Button>
    </div>
  )
}

// 홈 카드(와이어프레임 HomePrototypeSection, DEC-95): 회색 머리 바(아이콘·제목·수) 아래 앞 3줄, 비면 가운데 한 줄, 아래 조건부 줄.
// 줄(<li>)은 부르는 쪽이 만든다. 카드는 자료 모양(계약)을 모른다.
export default function HomeCard({
  title,
  icon: Icon,
  read,
  empty,
  emptyAction,
  unit = '건',
  onSeeAll,
  footnote,
  aside,
  tiles,
}: Props) {
  const titleId = useId()
  return (
    <section
      aria-labelledby={titleId}
      aria-busy={read.kind === 'loading' || undefined}
      className={cn(cardClass, 'flex min-w-0 flex-col overflow-hidden')}
    >
      {/* 머리 바는 한 줄이다. 좁으면 제목만 어절로 접혀 같은 줄 카드의 머리 아래선이 덜 어긋난다. */}
      <div className="flex items-start justify-between gap-2 border-b border-gray-100 bg-gray-50 px-5 py-3">
        <h2
          id={titleId}
          className="flex min-w-0 items-center gap-1.5 text-sm font-semibold break-keep text-gray-700 wrap-anywhere"
        >
          <Icon aria-hidden className="size-4 shrink-0 text-gray-400" />
          {title}
        </h2>
        <CardCount read={read} unit={unit} onSeeAll={onSeeAll} aside={aside} />
      </div>
      <div className="flex-1">
        <CardBody read={read} empty={empty} emptyAction={emptyAction} tiles={tiles} />
      </div>
      {/* 조건부 줄의 수도 같은 응답에서 오므로 읽지 못했으면 함께 두지 않는다. */}
      {footnote && read.kind === 'ready' && <Footnote {...footnote} />}
    </section>
  )
}
