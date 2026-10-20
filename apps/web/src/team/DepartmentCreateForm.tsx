import type { FormEvent } from 'react'
import { Plus } from 'lucide-react'
import { CreateDepartmentSchema } from '@vada/contracts'
import StateMessage from '@/components/StateMessage'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

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

// 부서 만들기 칸. 버튼은 서버와 같은 스키마로 판단한다.
export function DepartmentCreateForm({ saving, error, name, onName, onCreate, onEdit }: Props) {
  const created = CreateDepartmentSchema.safeParse({ name })
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (created.success && !saving && (await onCreate(name))) onName('')
  }
  return (
    <div className="flex flex-col gap-2">
      <form
        aria-label="부서 만들기"
        className="flex gap-2"
        onSubmit={event => {
          void submit(event)
        }}
      >
        <Input
          aria-label="새 부서 이름"
          placeholder="새 부서 이름"
          value={name}
          aria-invalid={error ? true : undefined}
          onChange={event => {
            onName(event.target.value)
            onEdit()
          }}
        />
        <Button type="submit" variant="outline" disabled={!created.success || saving}>
          <Plus />
          부서 만들기
        </Button>
      </form>
      {error && <StateMessage kind="error">{error}</StateMessage>}
    </div>
  )
}
