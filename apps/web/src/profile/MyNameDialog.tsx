import { useState } from 'react'
import { Fact } from '@/components/Fact'
import StateMessage from '@/components/StateMessage'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { useUnsavedInput, useWindowLeave } from '@/lib/leave-guard'
import { myNameErrors } from '@/lib/my-name'
import { useFormCheck } from '@/lib/use-form-check'

type Props = {
  name: string
  // 로그인한 Google 계정. 학생회에 든 사람이 자기 계정을 보는 곳이 이 창뿐이라 보이기만 한다(개인정보 보호법 제35조 열람).
  email: string
  busy: boolean
  error: string | null
  onSave: (name: string) => void
  onClose: () => void
  // 계정을 다루는 창이 이것 하나라 탈퇴도 여기서 연다(기능 021 조각 7).
  onWithdraw: () => void
}

// '내 이름' 창: 운영진 이름 고치기, 로그인 이메일(고칠 수 없음), 탈퇴로 가는 버튼. 같은 이름이면 보내지 않고 닫는다(서버도 판을 남기지 않는다).
// 칸 하나라 Enter로도 저장하도록 form이다. 저장 버튼은 끄지 않고 누를 때 확인한다.
export default function MyNameDialog({
  name: current,
  email,
  busy,
  error,
  onSave,
  onClose,
  onWithdraw,
}: Props) {
  const [name, setName] = useState(current)
  const { formRef, errors, attempt } = useFormCheck(() => myNameErrors(name))
  const leave = useWindowLeave(onClose)
  // 보내는 동안은 풀어 둔다. 저장되면 부모가 닫고, 실패하면 다시 지킨다.
  useUnsavedInput(name !== current && !busy, leave.holder)
  return (
    <Dialog
      open
      onOpenChange={open => {
        if (!open && !busy) leave.close()
      }}
    >
      <DialogContent aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>내 이름</DialogTitle>
        </DialogHeader>
        <form
          ref={formRef}
          noValidate
          aria-label="내 이름 고치기"
          className="flex flex-col gap-4"
          onSubmit={event => {
            event.preventDefault()
            if (!attempt()) return
            if (name.trim() === current) onClose()
            else onSave(name)
          }}
        >
          <Field label="내 이름" required error={errors.name}>
            <Input
              value={name}
              autoComplete="name"
              disabled={busy}
              onChange={event => setName(event.target.value)}
            />
          </Field>
          <dl>
            <Fact label="로그인 이메일">{email}</Fact>
          </dl>
          {error && <StateMessage kind="error">{error}</StateMessage>}
          <DialogFooter>
            {/* 이름 저장과 떨어뜨려 왼쪽 끝에 둔다. 누르면 확인 창이 한 번 더 묻는다. */}
            <Button
              type="button"
              variant="ghost"
              className="mr-auto"
              busy={busy}
              onClick={onWithdraw}
            >
              탈퇴
            </Button>
            <Button type="button" variant="outline" busy={busy} onClick={leave.close}>
              닫기
            </Button>
            <Button type="submit" busy={busy}>
              이름 저장
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
