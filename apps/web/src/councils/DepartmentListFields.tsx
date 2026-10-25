import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { Plus, X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { FieldErrors } from '@/lib/use-form-check'
import { canAddDepartment, suggestionsOf } from './council-draft'
import type { CouncilDraftState } from './useCouncilDraft'

type RowProps = {
  label: string
  value: string
  error: string | undefined
  rowKey?: number
  onChange: (value: string) => void
  children: ReactNode
}

// 부서 한 줄: 이름 칸과 오른쪽 표시(재정 배지나 빼기 단추), 문제는 그 줄 아래.
function DepartmentRow({ label, value, error, rowKey, onChange, children }: RowProps) {
  const errorId = useId()
  return (
    <li className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <Input
          aria-label={label}
          value={value}
          data-row={rowKey}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          onChange={event => onChange(event.target.value)}
        />
        {children}
      </div>
      {error && (
        <p id={errorId} className="text-xs text-red-600">
          {error}
        </p>
      )}
    </li>
  )
}

type Props = Pick<
  CouncilDraftState,
  'draft' | 'set' | 'renameDepartment' | 'removeDepartment' | 'addDepartment'
> & { errors: FieldErrors }

// 조직 구조의 부서 목록(기능 020 정한 것 6): 재정 역할 부서(뺄 수 없음), 미리 둔 부서, 더하기 단추와 [부서 추가].
// 재정 부서만 남겨도 만든다. [부서 추가]는 빈 줄을 더하고 그 칸으로 초점을 옮긴다.
export default function DepartmentListFields({ draft: value, set, errors, ...on }: Props) {
  const listRef = useRef<HTMLUListElement>(null)
  const [focusKey, setFocusKey] = useState<number | null>(null)
  useEffect(() => {
    if (focusKey === null) return
    listRef.current?.querySelector<HTMLElement>(`[data-row="${focusKey}"]`)?.focus()
  }, [focusKey])
  return (
    <section className="flex flex-col gap-3">
      <h3 className="text-sm font-semibold text-gray-900">부서</h3>
      <ul ref={listRef} className="flex flex-col gap-2">
        <DepartmentRow
          label="재정 부서 이름"
          value={value.financeName}
          error={errors.financeDepartmentName}
          onChange={name => set('financeName')({ target: { value: name } })}
        >
          <Badge tone="info">재정</Badge>
        </DepartmentRow>
        {value.departments.map((row, index) => (
          <DepartmentRow
            key={row.key}
            label="부서 이름"
            value={row.name}
            rowKey={row.key}
            error={errors[`departments.${index}`]}
            onChange={name => on.renameDepartment(row.key, name)}
          >
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={`${row.name.trim() || '빈 부서'} 빼기`}
              onClick={() => on.removeDepartment(row.key)}
            >
              <X />
            </Button>
          </DepartmentRow>
        ))}
      </ul>
      {canAddDepartment(value) && (
        <div className="flex flex-wrap gap-2">
          {suggestionsOf(value).map(name => (
            <Button
              key={name}
              type="button"
              variant="outline"
              size="sm"
              onClick={() => on.addDepartment(name)}
            >
              <Plus />
              {name}
            </Button>
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setFocusKey(on.addDepartment())}
          >
            <Plus />
            부서 추가
          </Button>
        </div>
      )}
    </section>
  )
}
