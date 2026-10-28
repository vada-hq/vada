import { registrationStatusLabel, type RegistrationForm } from '@vada/contracts'
import { CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { FormLink } from './FormLink'

// 초안의 링크를 생성 완료 화면에서 나누지 않게 한다. 공개 링크는 활성화한 양식만 보인다.
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
          <Badge>{registrationStatusLabel(form.status, form.applicantCount)}</Badge>
        </div>
      </div>
      {!form.paused && (
        <Card className="p-4">
          <FormLink form={form} />
        </Card>
      )}
      <div>
        <Button variant="outline" onClick={onDone}>
          {doneLabel}
        </Button>
      </div>
    </div>
  )
}
