import type { RegistrationForm } from '@vada/contracts'
import { CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { FormLink } from './FormLink'

// 양식을 만든 바로 뒤. 운영진이 양식을 만드는 목적은 공지와 포스터에 붙일 링크와 QR이므로, 목록의 접힌 카드에 숨기지 않고 바로 보인다.
export function FormCreated({
  form,
  onDone,
  doneLabel = '목록으로',
}: {
  form: RegistrationForm
  onDone: () => void
  doneLabel?: string
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start gap-3">
        <CheckCircle2 aria-hidden className="mt-0.5 size-6 shrink-0 text-green-600" />
        <div className="flex flex-col gap-0.5">
          <h2 className="text-lg font-semibold text-gray-900">신청 양식 생성 완료</h2>
          <p className="text-sm text-gray-600 wrap-anywhere">{form.name}</p>
        </div>
      </div>
      <Card className="p-4">
        <FormLink form={form} />
      </Card>
      <div>
        <Button variant="outline" onClick={onDone}>
          {doneLabel}
        </Button>
      </div>
    </div>
  )
}
