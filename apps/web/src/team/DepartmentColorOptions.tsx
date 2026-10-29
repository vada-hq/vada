import { useId } from 'react'
import { DEPARTMENT_COLORS, type DepartmentColorKey } from '@vada/contracts'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { departmentColorOf } from '@/lib/department-color'
import { cn } from '@/lib/utils'
const LABEL: Record<DepartmentColorKey, string> = {
  teal: '청록',
  violet: '보라',
  emerald: '초록',
  pink: '분홍',
  sky: '하늘',
  orange: '주황',
  indigo: '남색',
  lime: '연두',
}
export function DepartmentColorOptions({
  color,
  busy = false,
  onColor,
}: {
  color: DepartmentColorKey
  busy?: boolean
  onColor: (color: DepartmentColorKey) => void
}) {
  const id = useId()
  return (
    <RadioGroup
      aria-label="색상"
      value={color}
      disabled={busy}
      onValueChange={value => {
        const selected = DEPARTMENT_COLORS.find(item => item === value)
        if (selected) onColor(selected)
      }}
      className="grid-cols-2"
    >
      {DEPARTMENT_COLORS.map(key => (
        <Label
          key={key}
          htmlFor={`${id}-${key}`}
          className={cn(
            'flex min-h-11 cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm text-fg',
            color === key
              ? 'border-border-selected ring-1 ring-border-selected'
              : 'border-border-default',
          )}
        >
          <RadioGroupItem id={`${id}-${key}`} value={key} />
          <span
            aria-hidden
            className={cn(
              'size-4 rounded-full',
              departmentColorOf('preview', [{ id: 'preview', color: key }]).dot,
            )}
          />
          {LABEL[key]}
        </Label>
      ))}
    </RadioGroup>
  )
}
