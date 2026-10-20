import { useState, type FormEvent } from 'react'
import { Plus } from 'lucide-react'
import { CreateDepartmentSchema } from '@vada/contracts'
import StateMessage from '@/components/StateMessage'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

type Props = {
  saving: boolean
  error: string
  // 만들었으면 true. 그때만 칸을 비운다.
  onCreate: (name: string) => Promise<boolean>
  onEdit: () => void
}

// 부서 만들기 칸. 버튼은 서버와 같은 스키마로 판단한다.
export function DepartmentCreateForm({ saving, error, onCreate, onEdit }: Props) {
  const [newName, setNewName] = useState('')
  const created = CreateDepartmentSchema.safeParse({ name: newName })
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (created.success && !saving && (await onCreate(newName))) setNewName('')
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
          value={newName}
          aria-invalid={error ? true : undefined}
          onChange={event => {
            setNewName(event.target.value)
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
