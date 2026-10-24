import type { FormEvent } from 'react'
import { Plus } from 'lucide-react'
import { CreateDepartmentSchema } from '@vada/contracts'
import StateMessage from '@/components/StateMessage'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { requiredText, useFormCheck } from '@/lib/use-form-check'

type Props = {
  saving: boolean
  error: string
  // 적는 이름은 부모가 들고 있다. 권한이 빠져 칸이 사라졌다 돌아와도 적던 이름이 남아야 해서다.
  name: string
  onName: (name: string) => void
  // 만들었으면 true. 그때만 칸을 비운다.
  onCreate: (name: string) => Promise<boolean>
  onEdit: () => void
}

// 부서 만들기 칸. 버튼은 끄지 않고 누를 때 확인한다(계약 검사도 보내기 전에 한 번 더 한다).
export function DepartmentCreateForm({ saving, error, name, onName, onCreate, onEdit }: Props) {
  const created = CreateDepartmentSchema.safeParse({ name })
  const {
    formRef,
    errors: fieldErrors,
    attempt,
  } = useFormCheck(() => ({ name: requiredText(name, '부서 이름을') }))
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!attempt()) return
    if (created.success && !saving && (await onCreate(name))) onName('')
  }
  return (
    <div className="flex flex-col gap-2">
      <form
        ref={formRef}
        noValidate
        aria-label="부서 만들기"
        className="flex items-start gap-2"
        onSubmit={event => {
          void submit(event)
        }}
      >
        <Field label="새 부서 이름" error={fieldErrors.name} className="flex-1">
          <Input
            value={name}
            {...(error && { 'aria-invalid': true })}
            onChange={event => {
              onName(event.target.value)
              onEdit()
            }}
          />
        </Field>
        <Button type="submit" variant="outline" className="mt-7" disabled={saving}>
          <Plus />
          부서 만들기
        </Button>
      </form>
      {error && <StateMessage kind="error">{error}</StateMessage>}
    </div>
  )
}
