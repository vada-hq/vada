import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'
import StateMessage from '@/components/StateMessage'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'

type Props = {
  label: string
  value: ReactNode
  // 값이 비었다(담당자 없음, 마감 없음 등). 흐리게 보인다.
  empty?: boolean | undefined
  // 서버가 이 칸을 바꾸는 동작을 줬다(DEC-38). 아니면 글자만 보인다.
  editable: boolean
  busy: boolean
  error?: string | undefined
  // 칸 오른쪽의 작은 단추(행사 열기 등)
  extra?: ReactNode
  // 고르기 창의 폭 등(달력은 일곱 칸이 들어가게 넓힌다)
  popoverClassName?: string | undefined
  // 창이 처음 열릴 때 선택지를 읽게 한다.
  onOpen?: (() => void) | undefined
  // 고르기 창 안. close를 부르면 창이 닫히고 초점이 칸으로 돌아간다.
  children: (close: () => void) => ReactNode
}

// 업무 상세의 사실 칸 하나(와이어프레임 OPS 패널의 2열 칸): 위에 라벨, 아래에 값.
// 값을 누르면 그 자리에 고르기 창이 열리고, 고르면 저장 버튼 없이 바로 바뀐다(Linear·Jira·GitHub Projects 상세의 관례).
export function TaskProperty({
  label,
  value,
  empty,
  editable,
  busy,
  error,
  extra,
  popoverClassName,
  onOpen,
  children,
}: Props) {
  const [open, setOpen] = useState(false)
  const trigger = useRef<HTMLButtonElement>(null)
  const [returnFocus, setReturnFocus] = useState(false)
  // 저장 중인 트리거는 꺼져 있어 고르기 창을 닫는 순간에는 초점을 돌릴 수 없다.
  useEffect(() => {
    if (open || busy || !returnFocus) return
    setReturnFocus(false)
    trigger.current?.focus()
  }, [open, busy, returnFocus])
  const labelId = useId()
  const valueId = useId()
  const shown = (
    <span
      id={valueId}
      className={cn('min-w-0 flex-1 text-left break-keep wrap-anywhere', empty && 'text-gray-400')}
    >
      {value}
    </span>
  )
  return (
    <div className="flex min-w-0 flex-col gap-1 bg-white px-3 py-2.5">
      <span id={labelId} className="text-xs text-gray-500">
        {label}
      </span>
      <div className="flex min-w-0 items-center gap-1">
        {editable ? (
          <Popover
            open={open}
            onOpenChange={next => {
              setOpen(next)
              if (next) onOpen?.()
            }}
          >
            <PopoverTrigger asChild>
              <Button
                ref={trigger}
                variant="ghost"
                busy={busy}
                aria-labelledby={`${labelId} ${valueId}`}
                className="group -mx-2 h-auto min-w-0 flex-1 justify-start gap-1 px-2 py-1 text-sm font-normal whitespace-normal text-gray-900 hover:bg-gray-100 hover:text-gray-900"
              >
                {shown}
                <ChevronDown aria-hidden className="text-gray-300 group-hover:text-gray-500" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className={popoverClassName}>
              {children(() => {
                setReturnFocus(true)
                setOpen(false)
              })}
            </PopoverContent>
          </Popover>
        ) : (
          <span className="flex min-w-0 flex-1 py-1 text-sm text-gray-900">{shown}</span>
        )}
        {extra}
      </div>
      {error && <StateMessage kind="error">{error}</StateMessage>}
    </div>
  )
}
