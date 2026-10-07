import { useId, type FormEvent } from 'react'
import { CreateEventSchema, EVENT_NAME_MAX, codePoints } from '@vada/contracts'
import StateMessage from '@/components/StateMessage'

type Props = { name: string; onNameChange: (name: string) => void; saving: boolean; disabled: boolean; error: string; onSubmit: (event: FormEvent<HTMLFormElement>) => void }
export default function CreateEventForm({ name, onNameChange, saving, disabled, error, onSubmit }: Props) {
  const inputId = useId()
  const valid = CreateEventSchema.safeParse({ name }).success
  return <form className="create-event" aria-label="행사 만들기" onSubmit={onSubmit}>
    <label htmlFor={inputId}>행사 이름</label>
    <input id={inputId} value={name} required disabled={saving} placeholder="새 행사 이름" onChange={event => onNameChange(event.target.value)} />
    <p className="hint">{codePoints(name.trim())} / {EVENT_NAME_MAX}자</p>
    <button type="submit" disabled={!valid || disabled || saving}>{saving ? '만드는 중…' : '행사 만들기'}</button>
    {error && <StateMessage kind="error">{error}</StateMessage>}
  </form>
}
