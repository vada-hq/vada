import { cloneElement, useId, type ReactElement, type ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { Label } from './label'

type Props = {
  label: string
  // 비워 둬도 되는 칸. 필수 칸이 적은 폼이 많아 선택 칸에만 표시한다(GOV.UK "(optional)").
  optional?: boolean
  // 꼭 넣는 칸. 선택 칸이 많은 폼에서는 필수 칸도 별표로 표시한다(NN/g "Marking Required Fields in Forms", 2019).
  required?: boolean
  // 형식처럼 대부분이 알아야 하는 것만 짧게(GOV.UK hint text). 라벨 아래에 둔다.
  hint?: string
  // 라벨 줄 오른쪽 끝에 두는 것(칸을 끄는 '미정' 체크 등, 와이어프레임 EVT-02B).
  aside?: ReactNode
  // 보낼 때 확인해 찾은 문제. 칸 바로 아래에 보인다(GOV.UK error message).
  error?: string | undefined
  className?: string
  // 입력칸 하나. Field가 id를 붙여 라벨과 잇는다.
  children: ReactElement<{
    id?: string
    'aria-required'?: boolean
    'aria-invalid'?: boolean
    'aria-describedby'?: string
  }>
}

// 라벨 줄: 라벨, 별표나 '(선택)', 오른쪽 끝의 aside.
function LabelRow({
  id,
  label,
  optional,
  required,
  aside,
}: {
  id: string
  label: string
  optional: boolean | undefined
  required: boolean | undefined
  aside: ReactNode
}) {
  return (
    <div className="flex items-baseline gap-1">
      <Label htmlFor={id}>{label}</Label>
      {required && (
        // 라벨(text-xs)과 줄 높이를 맞춘다. 아니면 별표 칸이 '(선택)' 칸보다 4px 높아 나란한 칸이 어긋난다.
        <span aria-hidden className="text-sm leading-4 text-danger-emphasis">
          *
        </span>
      )}
      {optional && <span className="text-xs text-fg-muted">(선택)</span>}
      {aside !== undefined && <div className="ml-auto">{aside}</div>}
    </div>
  )
}

// 라벨과 입력칸 한 묶음. '(선택)'과 별표는 라벨 요소 밖에 두어 입력칸의 이름은 라벨 글 그대로다.
// 이름에 넣으면 화면 읽기 프로그램이 "장소 (선택)"으로 읽어 좋지만, 라벨로 칸을 찾는 시험이 모두 바뀌어 시안에서는 미룬다.
// 필수는 aria-required로 읽힌다.
export function Field({
  label,
  optional,
  required,
  hint,
  aside,
  error,
  className,
  children,
}: Props) {
  const id = useId()
  const errorId = `${id}-error`
  const hintId = `${id}-hint`
  const describedBy = [hint && hintId, error && errorId].filter(Boolean).join(' ')
  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <LabelRow id={id} label={label} optional={optional} required={required} aside={aside} />
      {hint && (
        <p id={hintId} className="-mt-1 text-xs text-fg-muted">
          {hint}
        </p>
      )}
      {cloneElement(children, {
        id,
        ...(required && { 'aria-required': true }),
        ...(error && { 'aria-invalid': true }),
        ...(describedBy && { 'aria-describedby': describedBy }),
      })}
      {error && (
        <p id={errorId} className="text-xs text-danger-emphasis">
          {error}
        </p>
      )}
    </div>
  )
}
