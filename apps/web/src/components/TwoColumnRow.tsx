import type { ReactNode } from 'react'
import { ChevronRight, type LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { rowLinkTarget } from '@/components/ui/row-link'
import { cn } from '@/lib/utils'
import IconDot from './IconDot'

// 두 칸 줄(회장단 홈 ① f8): 아이콘 원 / 무엇(제목 + 사실·행사) | 누구 / 꺾쇠.
// 넓은 칸(@2xl 이상)은 무엇 | 누구 두 칸으로 펼쳐 줄 가운데를 채우고, 좁은 칸은 무엇 아래 누구를 쌓는다.
// 제목 단추가 줄 전체를 덮는다(줄 = 일 보기). 누구 칸에 누르는 것을 두면 그것에 relative z-10을 줘 덮개 위로 올린다.
export const ROW_BOX =
  'relative flex items-center gap-3 rounded-2xl px-3 py-2.5 @2xl:gap-4 @2xl:px-3.5 @2xl:py-3.5'
export const ROW_BODY = 'min-w-0 flex-1 @2xl:grid @2xl:grid-cols-2 @2xl:items-center @2xl:gap-x-6'

type Props = {
  icon: LucideIcon
  title: string
  // 제목 아래 사실('3일 지남'). danger면 위험 색(지남·오늘만)
  fact: string
  danger?: boolean
  // 사실 뒤 흐린 글(행사 이름, 말줄임)
  detail?: string | null | undefined
  who?: ReactNode
  // 줄 끝. 없으면 꺾쇠(일 보기). 있으면 고정 폭 칸(넓은 칸 7rem)에 두어 누구 칸이 같은 세로선에 선다(③의 확인하기 알약).
  trailing?: ReactNode
  onOpen: () => void
}

export default function TwoColumnRow(props: Props) {
  const { icon, title, fact, danger, detail, who, trailing, onOpen } = props
  return (
    <li
      className={cn(
        ROW_BOX,
        'hover:bg-muted/60 has-[[data-who]:hover]:bg-transparent has-[[data-title]:focus-visible]:ring-2 has-[[data-title]:focus-visible]:ring-primary-strong has-[[data-title]:focus-visible]:ring-inset',
      )}
    >
      <IconDot icon={icon} />
      <div className={ROW_BODY}>
        <div className="min-w-0">
          <Button
            variant="link"
            data-title
            className={cn(
              'h-auto max-w-full justify-start border-0 p-0 text-left text-row-title font-semibold tracking-tight whitespace-normal text-fg hover:no-underline',
              rowLinkTarget,
            )}
            onClick={onOpen}
          >
            <span className="line-clamp-2 break-keep wrap-anywhere @2xl:line-clamp-1">{title}</span>
          </Button>
          <p className="mt-0.5 flex min-w-0 items-baseline gap-1.5 text-row-sub">
            <span
              className={cn(
                'shrink-0 font-semibold whitespace-nowrap',
                danger ? 'text-danger' : 'text-fg-tertiary',
              )}
            >
              {fact}
            </span>
            {detail && (
              <>
                <span aria-hidden className="text-fg-muted">
                  ·
                </span>
                <span className="min-w-0 truncate text-fg-muted">{detail}</span>
              </>
            )}
          </p>
        </div>
        {who && <div className="mt-1.5 min-w-0 empty:hidden @2xl:mt-0">{who}</div>}
      </div>
      {trailing ? (
        <div className="flex shrink-0 justify-end @2xl:w-28">{trailing}</div>
      ) : (
        <ChevronRight aria-hidden className="size-5 shrink-0 text-fg-muted" />
      )}
    </li>
  )
}
