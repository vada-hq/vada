import { cloneElement, useId, type ReactElement } from 'react'
import { cn } from '@/lib/utils'
import { Label } from './label'

type Props = {
  label: string
  // 비워 둬도 되는 칸. 필수 칸이 적은 폼이 많아 선택 칸에만 표시한다(GOV.UK "(optional)", 별표는 쓰지 않는다).
  optional?: boolean
  className?: string
  // 입력칸 하나. Field가 id를 붙여 라벨과 잇는다.
  children: ReactElement<{ id?: string }>
}

// 라벨과 입력칸 한 묶음. '(선택)'은 라벨 요소 밖에 두어 입력칸의 이름은 라벨 글 그대로다.
// 이름에 넣으면 화면 읽기 프로그램이 "장소 (선택)"으로 읽어 좋지만, 라벨로 칸을 찾는 시험이 모두 바뀌어 시안에서는 미룬다.
export function Field({ label, optional, className, children }: Props) {
  const id = useId()
  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <div className="flex items-baseline gap-1">
        <Label htmlFor={id}>{label}</Label>
        {optional && <span className="text-xs text-gray-500">(선택)</span>}
      </div>
      {cloneElement(children, { id })}
    </div>
  )
}

// 값이 빈 필수 칸의 라벨들. 폼마다 필수 칸(계약에서 nullable이 아닌 칸)을 [라벨, 값]으로 넘긴다.
export const missingLabels = (fields: readonly (readonly [string, string])[]) =>
  fields.filter(([, value]) => value.trim() === '').map(([label]) => label)

type HintProps = {
  // 제출 버튼의 aria-describedby와 같은 값. 화면 읽기 프로그램이 꺼진 버튼에서 이유를 읽는다.
  id: string
  missing: readonly string[]
  // 계약(safeParse)이 받지 않아 버튼이 꺼졌는지.
  blocked: boolean
}

// 제출 버튼이 꺼진 이유. 버튼 줄 왼쪽에 두어, 회색 버튼만 보고 막히지 않게 한다.
// 조사(Atlassian, Fluent): 꺼진 버튼은 왜 꺼졌는지 말하지 않는다. 버튼을 켜 둘지는 저장소 규칙이라 따로 정한다.
// 빈 칸이 없는데도 꺼졌으면(순서, 짝, 길이) 값을 다시 보라고만 한다. 어느 규칙인지는 계약이 판단하므로 여기서 다시 따지지 않는다.
export function MissingHint({ id, missing, blocked }: HintProps) {
  if (!blocked) return null
  return (
    <p id={id} className="mr-auto self-center text-xs text-gray-500">
      {missing.length > 0
        ? `넣어야 할 칸: ${missing.join(', ')}`
        : '입력한 값을 다시 확인해 주세요.'}
    </p>
  )
}
