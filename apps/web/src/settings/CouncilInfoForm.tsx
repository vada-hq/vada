import type { FormEvent, ReactNode } from 'react'
import { COUNCIL_UNITS, type CouncilUnit } from '@vada/contracts'
import { unitLabels } from '../councils/unit-labels'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NativeSelect } from '@/components/ui/native-select'
import { titleFields, type CouncilDraft, type TitleKey } from './council-settings-form'

type Props = {
  value: CouncilDraft
  canEdit: boolean
  saveable: boolean
  saving: boolean
  busy: boolean
  note: ReactNode
  onEdit: (patch: Partial<CouncilDraft>) => void
  onEditTitle: (key: TitleKey, value: string) => void
  onSubmit: (event: FormEvent) => void
}

type TitleProps = {
  titles: CouncilDraft['titles']
  canEdit: boolean
  onEdit: (key: TitleKey, value: string) => void
}
function TitleFields({ titles, canEdit, onEdit }: TitleProps) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 text-xs font-medium text-gray-700">직급 표시 이름</legend>
      <div className="grid grid-cols-2 gap-3">
        {titleFields.map(([key, label]) => (
          <Label key={key} className="flex flex-col gap-1.5 text-gray-500">
            {label}
            <Input
              value={titles[key]}
              readOnly={!canEdit}
              onChange={event => onEdit(key, event.target.value)}
            />
          </Label>
        ))}
      </div>
    </fieldset>
  )
}

type BasicProps = {
  value: CouncilDraft
  canEdit: boolean
  onEdit: (patch: Partial<CouncilDraft>) => void
}
function BasicFields({ value, canEdit, onEdit }: BasicProps) {
  return (
    <>
      <Label className="flex flex-col gap-2">
        학생회 이름
        <Input
          value={value.name}
          readOnly={!canEdit}
          onChange={event => onEdit({ name: event.target.value })}
        />
      </Label>
      <Label className="flex flex-col gap-2">
        단위
        <NativeSelect
          value={value.unit}
          disabled={!canEdit}
          onChange={event => onEdit({ unit: event.target.value as CouncilUnit })}
        >
          {COUNCIL_UNITS.map(unit => (
            <option key={unit} value={unit}>
              {unitLabels[unit]}
            </option>
          ))}
        </NativeSelect>
      </Label>
      <Label className="flex flex-col gap-2">
        학교
        <Input
          value={value.schoolName}
          readOnly={!canEdit}
          onChange={event => onEdit({ schoolName: event.target.value })}
        />
      </Label>
    </>
  )
}

// 설정 > 학생회 정보 양식: 이름, 단위, 학교, 직급 표시 이름 4개.
export default function CouncilInfoForm({
  value,
  canEdit,
  saveable,
  saving,
  busy,
  note,
  onEdit,
  onEditTitle,
  onSubmit,
}: Props) {
  return (
    <Card className="p-6">
      <form aria-label="학생회 정보" className="flex flex-col gap-4" onSubmit={onSubmit}>
        <h2 className="text-base font-semibold text-gray-900">학생회 정보</h2>
        <BasicFields value={value} canEdit={canEdit} onEdit={onEdit} />
        <TitleFields titles={value.titles} canEdit={canEdit} onEdit={onEditTitle} />
        {note}
        {canEdit && (
          <Button type="submit" className="self-start" disabled={!saveable || busy}>
            {saving ? '저장하는 중…' : '학생회 정보 저장'}
          </Button>
        )}
      </form>
    </Card>
  )
}
