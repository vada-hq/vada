import { useId, type FormEvent } from 'react'
import { CreateEventSchema, EVENT_NAME_MAX, codePoints } from '@vada/contracts'
import StateMessage from '@/components/StateMessage'
import { Button } from '@/components/ui/button'
import { DialogFooter } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

type Props = {
  name: string; onNameChange: (name: string) => void; saving: boolean; disabled: boolean; error: string
  onSubmit: (event: FormEvent<HTMLFormElement>) => void; onCancel?: () => void
}
export default function CreateEventForm({ name, onNameChange, saving, disabled, error, onSubmit, onCancel }: Props) {
  const inputId = useId()
  const valid = CreateEventSchema.safeParse({ name }).success
  return <form className="flex flex-col gap-5" aria-label="행사 만들기" onSubmit={onSubmit}>
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={inputId}>행사 이름</Label>
      <Input id={inputId} value={name} required disabled={saving} placeholder="새 행사 이름" onChange={event => onNameChange(event.target.value)} />
      <p className="text-xs text-gray-400">{codePoints(name.trim())} / {EVENT_NAME_MAX}자</p>
    </div>
    {error && <StateMessage kind="error">{error}</StateMessage>}
    <DialogFooter className="pt-3">
      {onCancel && <Button type="button" variant="outline" disabled={saving} onClick={onCancel}>취소</Button>}
      <Button type="submit" disabled={!valid || disabled || saving}>{saving ? '만드는 중…' : '행사 만들기'}</Button>
    </DialogFooter>
  </form>
}
