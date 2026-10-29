import type { ReactNode } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { control, focusRing, radius, type } from './public-look'

// 아래에 붙는 꽉 찬 버튼 자리(TDS FixedBottomCTA). 휴대폰 폭에서는 sticky라 칸이 길면 화면 아래에 붙고,
// 끝까지 내리면 마지막 칸 뒤 제자리로 와서 어떤 칸도 덮지 않는다. 버튼 위 흰 흐림 면이 뒤 글을 가린다.
// 640px 이상에서는 고정을 풀고 제자리에만 둔다(데스크톱 창이 낮으면 고정한 버튼이 선택지를 덮었다, 시안 검토).
// 운영진 미리보기처럼 다른 화면 안에 들어가면 sticky를 끈다.
export function BottomBar({
  children,
  sticky = true,
  className,
}: {
  children: ReactNode
  sticky?: boolean
  className?: string
}) {
  return (
    <div
      className={cn(
        '-mx-6 flex flex-col gap-2 px-6',
        sticky
          ? 'sticky bottom-0 z-10 bg-linear-to-t from-white from-70% to-white/0 pt-6 safe-bottom-3 sm:static sm:bg-none sm:pt-0'
          : 'pb-3',
        className,
      )}
    >
      {children}
    </div>
  )
}

const TONE = {
  primary: 'bg-primary-emphasis text-white hover:bg-primary-strong active:bg-primary-strong',
  gray: 'bg-surface-muted text-fg-secondary hover:bg-muted-strong active:bg-muted-strong',
}

// 꽉 찬 큰 버튼 56px. 보내는 중에만 막고, 그동안 글을 busyLabel로 바꾼다.
export function BigButton({
  tone = 'primary',
  busy = false,
  busyLabel,
  children,
  onClick,
  submit = false,
}: {
  tone?: keyof typeof TONE
  busy?: boolean
  busyLabel?: string
  children: ReactNode
  onClick?: () => void
  submit?: boolean
}) {
  return (
    <Button
      type={submit ? 'submit' : 'button'}
      busy={busy}
      touch={false}
      onClick={onClick}
      className={cn(
        'w-full gap-2 border-0 font-semibold whitespace-normal disabled:opacity-100',
        control,
        radius.control,
        type.body,
        focusRing,
        'focus-visible:ring-4 focus-visible:ring-primary-border-strong',
        TONE[tone],
      )}
    >
      {busy && <Loader2 aria-hidden="true" className="size-5 animate-spin" />}
      {busy ? busyLabel : children}
    </Button>
  )
}
