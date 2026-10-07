import { useState, type FormEvent } from 'react'
import { InviteCodeSchema } from '@vada/contracts'

type Props = { initialCode: string; onSubmit: (code: string) => void }

// 와이어프레임 INV-00. 소속이 없을 때 보이는 첫 화면이다.
export default function InviteCodeForm({ initialCode, onSubmit }: Props) {
  const [value, setValue] = useState(initialCode)
  const parsed = InviteCodeSchema.safeParse(value)
  function submit(event: FormEvent) {
    event.preventDefault()
    if (parsed.success) onSubmit(parsed.data)
  }
  return <form aria-label="초대 코드 입력" onSubmit={submit}>
    <h2>초대 코드를 입력해 주세요</h2>
    <p className="hint">학생회에서 받은 초대 코드를 입력하면 학생회 정보를 확인할 수 있어요.</p>
    <label>초대 코드<input value={value} onChange={event => setValue(event.target.value)}
      autoComplete="off" autoCapitalize="characters" spellCheck={false} /></label>
    <button type="submit" disabled={!parsed.success}>학생회 확인</button>
  </form>
}
