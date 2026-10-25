import { useState } from 'react'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { myNameErrors } from '@/lib/my-name'

type Props = {
  name: string
  busy: boolean
  error: string | null
  onSave: (name: string) => void
  onClose: () => void
}

// '내 이름' 창: 운영진 이름 고치기. 같은 이름이면 보내지 않고 닫는다(서버도 판을 남기지 않는다).
export default function MyNameDialog({ name: current, busy, error, onSave, onClose }: Props) {
  const [name, setName] = useState(current)
  return (
    <ConfirmDialog
      title="내 이름"
      confirmLabel="이름 저장"
      busy={busy}
      error={error}
      check={() => myNameErrors(name)}
      onConfirm={() => (name.trim() === current ? onClose() : onSave(name))}
      onClose={onClose}
      field={errors => (
        <Field label="내 이름" required error={errors.name}>
          <Input
            value={name}
            autoComplete="name"
            disabled={busy}
            onChange={event => setName(event.target.value)}
          />
        </Field>
      )}
    />
  )
}
