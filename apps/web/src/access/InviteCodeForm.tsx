import { useState, type FormEvent } from 'react'
import { InviteCodeSchema } from '@vada/contracts'
import { inviteCodeFromText } from './invite-path'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

type Props = { initialCode: string; onSubmit: (code: string) => void }

// 와이어프레임 INV-00. 소속이 없을 때 보이는 첫 화면이다.
export default function InviteCodeForm({ initialCode, onSubmit }: Props) {
  const [value, setValue] = useState(initialCode)
  const parsed = InviteCodeSchema.safeParse(inviteCodeFromText(value))
  function submit(event: FormEvent) {
    event.preventDefault()
    if (parsed.success) onSubmit(parsed.data)
  }
  return <form aria-label="초대 코드 입력" className="flex flex-col gap-6" onSubmit={submit}>
    <div className="flex flex-col gap-1">
      <h2 className="text-lg font-semibold">초대 코드를 입력해 주세요</h2>
      <p className="text-sm text-gray-500">학생회에서 받은 초대 코드를 입력하면 학생회 정보를 확인할 수 있어요.</p>
    </div>
    <Label className="flex flex-col gap-2">초대 코드
      <Input value={value} onChange={event => setValue(event.target.value)} autoComplete="off" autoCapitalize="characters" spellCheck={false}
        className="px-4 py-3 text-center font-mono text-xl tracking-widest sm:text-xl" />
    </Label>
    <Button type="submit" className="mt-2" disabled={!parsed.success}>학생회 확인</Button>
  </form>
}
