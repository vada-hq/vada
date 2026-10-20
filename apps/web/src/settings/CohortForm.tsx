import type { FormEvent, ReactNode } from 'react'
import { endsBeforeStart, TERM_ORDER_MESSAGE } from '../councils/term'
import StateMessage from '@/components/StateMessage'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { CohortDraft } from './council-settings-form'

type Props = {
  value: CohortDraft
  canEdit: boolean
  saveable: boolean
  saving: boolean
  busy: boolean
  note: ReactNode
  onEdit: (patch: Partial<CohortDraft>) => void
  onSubmit: (event: FormEvent) => void
}

type TermProps = {
  value: CohortDraft
  canEdit: boolean
  onEdit: (patch: Partial<CohortDraft>) => void
}
function TermFields({ value, canEdit, onEdit }: TermProps) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <Label className="flex flex-col gap-2">
        임기 시작
        <Input
          type="date"
          value={value.startsOn}
          readOnly={!canEdit}
          onChange={event => onEdit({ startsOn: event.target.value })}
        />
      </Label>
      <Label className="flex flex-col gap-2">
        임기 끝
        <Input
          type="date"
          value={value.endsOn}
          readOnly={!canEdit}
          onChange={event => onEdit({ endsOn: event.target.value })}
        />
      </Label>
    </div>
  )
}

// 설정 > 지금 기수 양식: 기수 이름과 임기.
export default function CohortForm({
  value,
  canEdit,
  saveable,
  saving,
  busy,
  note,
  onEdit,
  onSubmit,
}: Props) {
  return (
    <Card className="p-6">
      <form aria-label="지금 기수" className="flex flex-col gap-4" onSubmit={onSubmit}>
        <h2 className="text-base font-semibold text-gray-900">지금 기수</h2>
        <Label className="flex flex-col gap-2">
          기수 이름
          <Input
            value={value.name}
            readOnly={!canEdit}
            onChange={event => onEdit({ name: event.target.value })}
          />
        </Label>
        <TermFields value={value} canEdit={canEdit} onEdit={onEdit} />
        {canEdit && endsBeforeStart(value) && (
          <StateMessage kind="error">{TERM_ORDER_MESSAGE}</StateMessage>
        )}
        {note}
        {canEdit && (
          <Button type="submit" className="self-start" disabled={!saveable || busy}>
            {saving ? '저장하는 중…' : '기수 저장'}
          </Button>
        )}
      </form>
    </Card>
  )
}
