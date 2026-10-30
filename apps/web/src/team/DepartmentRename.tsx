import { useEffect, useRef, type FormEvent } from 'react'
import { UpdateDepartmentSchema, type TeamDepartment } from '@vada/contracts'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { isComposingKey } from '@/lib/composing-key'
import { requiredText, useFormCheck, withContract } from '@/lib/use-form-check'

const SAME_NAME = '지금과 다른 이름을 입력해 주세요'

type Props = {
  department: TeamDepartment
  name: string
  // 서버가 거절한 까닭(같은 이름의 부서).
  error: string
  saving: boolean
  onName: (name: string) => void
  // 칸 확인을 지난 뒤에만 부른다.
  onSubmit: (event: FormEvent) => void
  onClose: () => void
}

// 부서 묶음 머리의 제자리 이름 바꾸기(Atlassian inline edit): Enter 저장, Esc 닫기. 휴대폰에는 Esc가 없어 [닫기]를 둔다.
// 빈 이름과 지금 이름은 보내지 않고 칸 아래에 알린다. 서버의 거절(같은 이름의 부서)도 칸 아래다.
export function DepartmentRename({ department, name, error, saving, ...on }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    inputRef.current?.focus()
    inputRef.current?.select()
  }, [])
  const parsed = UpdateDepartmentSchema.safeParse({ name, role: department.role })
  const { formRef, errors, attempt } = useFormCheck(() =>
    withContract(
      {
        name:
          requiredText(name, '부서 이름을') ??
          (name.trim() === department.name ? SAME_NAME : undefined),
      },
      parsed,
    ),
  )
  return (
    <form
      ref={formRef}
      noValidate
      aria-label="부서 이름 바꾸기"
      className="flex min-w-0 flex-1 flex-col gap-2"
      onSubmit={event => {
        if (attempt()) on.onSubmit(event)
        else event.preventDefault()
      }}
      onKeyDown={event => {
        if (event.key !== 'Escape' || isComposingKey(event)) return
        event.preventDefault()
        on.onClose()
      }}
    >
      <Field label="부서 이름" required error={errors.name ?? (error || undefined)}>
        <Input ref={inputRef} value={name} onChange={event => on.onName(event.target.value)} />
      </Field>
      <div className="flex gap-2">
        <Button type="submit" size="sm" busy={saving}>
          바꾸기
        </Button>
        <Button type="button" variant="outline" size="sm" busy={saving} onClick={on.onClose}>
          닫기
        </Button>
      </div>
    </form>
  )
}
