import { useState } from 'react'
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
import { myNameErrors } from '@/lib/my-name'
import { useFormCheck } from '@/lib/use-form-check'

type Props = {
  name: string
  busy: boolean
  error: string | null
  onSave: (name: string) => void
  onClose: () => void
}

// '내 이름' 창: 운영진 이름 고치기. 같은 이름이면 보내지 않고 닫는다(서버도 판을 남기지 않는다).
// 칸 하나라 Enter로도 저장하도록 form이다. 저장 버튼은 끄지 않고 누를 때 확인한다.
export default function MyNameDialog({ name: current, busy, error, onSave, onClose }: Props) {
  const [name, setName] = useState(current)
  const { formRef, errors, attempt } = useFormCheck(() => myNameErrors(name))
  return (
    <Dialog
      open
      onOpenChange={open => {
        if (!open && !busy) onClose()
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
          {error && <StateMessage kind="error">{error}</StateMessage>}
          <DialogFooter>
            <Button type="button" variant="outline" busy={busy} onClick={onClose}>
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
