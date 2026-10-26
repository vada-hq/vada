import type { MouseEvent } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type Props = {
  name: string
  // 그 사람과의 1:1을 연다. 없으면(나, 떠난 사람, 1:1을 열 수 없을 때) 누를 수 없는 글이다.
  onOpen?: (() => void) | undefined
  // 좁은 칸(업무 카드)에서는 한 줄로 줄이고 전체 이름은 title에 둔다. 누르면 패널 머리에 전체 이름이 보인다.
  truncate?: boolean
  className?: string
}

// 사람 이름(와이어프레임 MSG-04 PersonName): 누르면 그 사람과 1:1 대화를 연다. 점선 밑줄로 누를 수 있음을 보이고 글자색은 둘레를 따른다.
// 카드 안에서도 쓰므로 누르기가 카드로 번지지 않게 막는다. 휴대폰에서 누르는 칸이 44px이 되도록 위아래로 보이지 않는 칸을 늘린다(WCAG 2.5.8).
export default function PersonName({ name, onOpen, truncate = false, className }: Props) {
  const fit = truncate ? 'min-w-0 truncate' : 'wrap-anywhere'
  if (!onOpen) return <span className={cn(fit, className)}>{name}</span>
  // 버튼은 줄을 바꾸지 않는 것이 기본이라, 줄이지 않는 이름은 안에서 줄을 바꾼다.
  const text = (
    <span className={cn(fit, 'text-left', !truncate && 'whitespace-normal')}>{name}</span>
  )
  const open = (event: MouseEvent) => {
    event.stopPropagation()
    onOpen()
  }
  return (
    <Button
      type="button"
      variant="link"
      aria-label={`${name} 1:1 대화`}
      title={truncate ? name : undefined}
      className={cn(
        'relative h-auto max-w-full min-w-0 justify-start border-0 p-0 font-normal text-inherit underline decoration-dotted underline-offset-2 before:absolute before:inset-x-0 before:-inset-y-3.5 hover:text-amber-700',
        className,
      )}
      onClick={open}
    >
      {text}
    </Button>
  )
}
