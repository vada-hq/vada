import { useState, type FormEvent } from 'react'
import { InviteCodeSchema } from '@vada/contracts'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { inviteCodeFromText } from './invite-path'

type Props = { onEnterCode: (code: string) => void; onCreate: () => void }

// 학생회가 없을 때: [초대 코드로 들어가기]와 [학생회 만들기] 둘을 보인다(바탕 spec '화면').
export default function NoCouncil({ onEnterCode, onCreate }: Props) {
  const [value, setValue] = useState('')
  const parsed = InviteCodeSchema.safeParse(inviteCodeFromText(value))
  function submit(event: FormEvent) {
    event.preventDefault()
    if (parsed.success) onEnterCode(parsed.data)
  }
  return (
    <div className="flex flex-col gap-6">
      <form aria-label="초대 코드로 들어가기" className="flex flex-col gap-4" onSubmit={submit}>
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-semibold">아직 들어간 학생회가 없어요</h2>
          <p className="text-sm text-gray-500">
            학생회에서 받은 초대 링크를 누르거나, 초대 코드를 입력해 주세요.
          </p>
        </div>
        <Label className="flex flex-col gap-2">
          초대 코드
          <Input
            value={value}
            onChange={event => setValue(event.target.value)}
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            className="px-4 py-3 text-center font-mono text-xl tracking-widest sm:text-xl"
          />
        </Label>
        <Button type="submit" disabled={!parsed.success}>
          초대 코드로 들어가기
        </Button>
      </form>
      <div className="flex flex-col items-center gap-2 border-t pt-4 text-center">
        <p className="text-sm text-gray-500">학생회를 처음 시작하나요?</p>
        <Button type="button" variant="outline" onClick={onCreate}>
          학생회 만들기
        </Button>
      </div>
    </div>
  )
}
