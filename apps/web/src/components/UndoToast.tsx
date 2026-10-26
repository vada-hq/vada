import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { useLatest } from '@/lib/use-latest'
import { cn } from '@/lib/utils'

// 토스트가 머무는 시간. Material 3 snackbar의 4~10초 가운데 긴 쪽이다(되돌리기를 읽고 누를 시간).
export const UNDO_MS = 10_000

type Props = {
  text: string
  // 되돌리지 못했으면 글 자리에 오류를 보인다.
  error: string | null
  busy: boolean
  onUndo: () => void
  onDismiss: () => void
  className?: string | undefined
}

// 확인 창 없이 저장한 뒤의 되돌리기(기능 023 정한 것 5): 글 한 줄과 [되돌리기], 10초 뒤 사라진다.
// 초점이나 포인터가 안에 있으면 머문다(WCAG 2.2.1 시간 조절). 한 번에 하나이고 새 것이 옛 것을 바꾸는 것은 부모가 정한다
// (text가 바뀌면 시간을 다시 센다). API를 부르지 않는다.
export function UndoToast({ text, error, busy, onUndo, onDismiss, className }: Props) {
  const [focused, setFocused] = useState(false)
  const [pointed, setPointed] = useState(false)
  const dismiss = useLatest(onDismiss)
  const held = focused || pointed || busy
  useEffect(() => {
    if (held) return
    const timer = setTimeout(() => dismiss.current(), UNDO_MS)
    return () => clearTimeout(timer)
  }, [held, text, error, dismiss])
  return (
    <div
      role="status"
      className={cn(
        'flex items-center gap-3 rounded-lg bg-gray-900 px-4 py-2 text-sm text-white shadow-lg',
        className,
      )}
      onFocus={() => setFocused(true)}
      onBlur={event => {
        if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false)
      }}
      onPointerEnter={() => setPointed(true)}
      onPointerLeave={() => setPointed(false)}
    >
      <p className={cn('min-w-0 flex-1 break-keep wrap-anywhere', error && 'text-red-300')}>
        {error ?? text}
      </p>
      <Button
        variant="ghost"
        size="sm"
        touch
        busy={busy}
        className="shrink-0 text-blue-300 hover:bg-gray-800 hover:text-blue-200"
        onClick={onUndo}
      >
        되돌리기
      </Button>
    </div>
  )
}
