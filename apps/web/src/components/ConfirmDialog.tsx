import type { ReactNode } from 'react'
import StateMessage from '@/components/StateMessage'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useFormCheck, withContract, type FieldErrors, type Parsed } from '@/lib/use-form-check'

type Props = {
  // 부모가 열고 닫는 창만 준다. 없으면 이 컴포넌트가 있는 동안 열려 있다.
  open?: boolean
  title: string
  // 되돌릴 수 없는 결과처럼 대부분이 모르면 막히는 것만 적는다. 없으면 두지 않는다.
  description?: string
  // 기록을 없애는 동작은 '○○ 취소'로 대상을 붙인다. 나가는 버튼은 늘 '닫기'라 바꾸는 속성이 없다.
  confirmLabel: string
  // 되돌리기 어려운 동작은 빨간 버튼이다.
  destructive?: boolean
  touch?: boolean
  busy?: boolean
  error?: string | null | undefined
  // 설명과 칸 사이에 두는 안내(상태 글 등).
  children?: ReactNode
  // 칸 하나(사유, 금액). 칸 확인의 문제 글을 받아 Field의 error로 그린다.
  field?: (errors: FieldErrors) => ReactNode
  // 칸 이름 → 문제 글. 누를 때 확인한다.
  check?: () => FieldErrors
  // 칸 확인이 못 잡는 계약 실패(너무 긴 글)를 칸 아래에 보인다.
  parse?: () => Parsed
  onConfirm: () => void
  onClose: () => void
  // 닫을 때 포커스를 어디로 돌릴지. 메뉴 항목으로 연 대화상자는 연 버튼으로 직접 돌려줘야 한다.
  onCloseAutoFocus?: (event: Event) => void
}

const VALID: Parsed = { success: true }
const touchClassOf = (touch: boolean) =>
  touch ? '[&_button]:max-sm:min-h-11 [&>button]:max-sm:min-w-11' : undefined

// 공용 확인 창: 되돌리기 어려운 동작 앞에 한 번 묻는다. 칸이 없거나 사유·금액 한 칸을 받는다.
// 확인 버튼은 끄지 않고 누를 때 확인한다(보내는 중에만 막는다). 보내는 동안에는 창을 닫지 않는다.
export function ConfirmDialog({
  open = true,
  title,
  description,
  confirmLabel,
  destructive = false,
  touch = false,
  busy = false,
  error,
  children,
  field,
  check,
  parse,
  onConfirm,
  onClose,
  onCloseAutoFocus,
}: Props) {
  const {
    formRef,
    errors: fieldErrors,
    attempt,
  } = useFormCheck<HTMLDivElement>(() => withContract(check?.() ?? {}, parse?.() ?? VALID))
  return (
    <Dialog
      open={open}
      onOpenChange={next => {
        if (!next && !busy) onClose()
      }}
    >
      <DialogContent
        className={touchClassOf(touch)}
        {...(description ? {} : { 'aria-describedby': undefined })}
        onCloseAutoFocus={onCloseAutoFocus}
      >
        <DialogHeader>
          <DialogTitle className="wrap-anywhere">{title}</DialogTitle>
          {description && (
            <DialogDescription className="wrap-anywhere">{description}</DialogDescription>
          )}
        </DialogHeader>
        {children}
        {field && (
          <div ref={formRef} className="flex flex-col gap-4">
            {field(fieldErrors)}
          </div>
        )}
        {error && <StateMessage kind="error">{error}</StateMessage>}
        <DialogFooter>
          <Button variant="outline" touch busy={busy} onClick={onClose}>
            닫기
          </Button>
          <Button
            variant={destructive ? 'destructive' : 'default'}
            touch
            busy={busy}
            onClick={() => attempt() && onConfirm()}
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
