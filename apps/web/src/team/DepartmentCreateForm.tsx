import { useEffect, useRef, type FormEvent } from 'react'
import { CreateDepartmentSchema } from '@vada/contracts'
import StateMessage from '@/components/StateMessage'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { isComposingKey } from '@/lib/composing-key'
import { requiredText, useFormCheck, withContract } from '@/lib/use-form-check'

type Props = {
  saving: boolean
  error: string
  // 적는 이름은 부모가 들고 있다. 권한이 빠져 칸이 사라졌다 돌아와도 적던 이름이 남아야 해서다.
  name: string
  onName: (name: string) => void
  // 만들었으면 true. 그때만 칸을 비운다.
  onCreate: (name: string) => Promise<boolean>
  onEdit: () => void
  onClose: () => void
}

// 조직 화면 목록 끝 [부서 추가]를 누르면 펼쳐지는 칸. 버튼은 끄지 않고 누를 때 확인한다(계약 검사도 보내기 전에 한 번 더 한다).
// 만든 뒤에도 칸을 열어 두어 여러 부서를 이어 만든다. [닫기]나 Esc로 접는다.
export function DepartmentCreateForm({ saving, error, name, onName, onCreate, ...on }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  useEffect(() => inputRef.current?.focus(), [])
  const created = CreateDepartmentSchema.safeParse({ name })
  const {
    formRef,
    errors: fieldErrors,
    attempt,
    reset,
  } = useFormCheck(() => withContract({ name: requiredText(name, '부서 이름을') }, created))
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!attempt()) return
    if (!created.success || saving || !(await onCreate(name))) return
    // 이어 만들 빈 칸이다. 앞 부서의 확인이 남으면 쓰기 전부터 문제로 보인다.
    onName('')
    reset()
  }
  return (
    <div className="flex flex-col gap-2">
      <form
        ref={formRef}
        noValidate
        aria-label="부서 추가"
        className="flex flex-col gap-2"
        onSubmit={event => {
          void submit(event)
        }}
        onKeyDown={event => {
          if (event.key !== 'Escape' || isComposingKey(event)) return
          event.preventDefault()
          on.onClose()
        }}
      >
        <Field label="새 부서 이름" error={fieldErrors.name}>
          <Input
            ref={inputRef}
            value={name}
            {...(error && { 'aria-invalid': true })}
            onChange={event => {
              onName(event.target.value)
              on.onEdit()
            }}
          />
        </Field>
        <div className="flex gap-2">
          <Button type="submit" size="sm" busy={saving}>
            부서 추가
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={on.onClose}>
            닫기
          </Button>
        </div>
      </form>
      {error && <StateMessage kind="error">{error}</StateMessage>}
    </div>
  )
}
