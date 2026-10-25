import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { Plus, X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { FieldErrors } from '@/lib/use-form-check'
import { canAddDepartment, suggestionsOf } from './council-draft'
import { orgGroupClass } from './org-group'
import type { CouncilDraftState } from './useCouncilDraft'

type RowProps = {
  label: string
  value: string
  error: string | undefined
  rowKey: number | 'finance'
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
          aria-required
          value={value}
          data-row={rowKey}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          onChange={event => onChange(event.target.value)}
        />
        {/* 재정 배지와 빼기 단추의 폭이 달라도 이름 칸 끝이 맞게 같은 폭 칸에 넣는다. */}
        <span className="flex w-11 shrink-0 justify-center">{children}</span>
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

type Row = number | 'finance'
// 줄을 빼면 그 자리에 온 줄, 마지막 줄이었으면 앞 줄, 줄이 없으면 재정 부서 칸으로 초점을 옮긴다.
// 누른 빼기 단추가 사라져 초점이 페이지 맨 앞으로 가지 않게 한다.
function rowAfterRemove(rows: { key: number }[], key: number): Row {
  const index = rows.findIndex(row => row.key === key)
  return rows[index + 1]?.key ?? rows[index - 1]?.key ?? 'finance'
}

// 조직 구조의 부서 목록(기능 020 정한 것 6): 재정 역할 부서(뺄 수 없음), 미리 둔 부서, 더하기 단추와 [부서 추가].
// 재정 부서만 남겨도 만든다. 줄을 더하면 새 줄로 초점을 옮긴다. 칸 이름은 줄 차례('부서 이름 1')로 가른다.
export default function DepartmentListFields({ draft: value, set, errors, ...on }: Props) {
  const listRef = useRef<HTMLUListElement>(null)
  // turn은 같은 줄로 다시 옮길 때도 효과가 돌게 하는 번호다.
  const [focus, setFocus] = useState<{ row: Row; turn: number } | null>(null)
  const focusRow = (row: Row) => setFocus(current => ({ row, turn: (current?.turn ?? 0) + 1 }))
  useEffect(() => {
    if (!focus) return
    listRef.current?.querySelector<HTMLElement>(`[data-row="${focus.row}"]`)?.focus()
  }, [focus])
  return (
    <section className={orgGroupClass}>
      <h3 className="text-sm font-semibold text-gray-900">부서</h3>
      <ul ref={listRef} className="flex flex-col gap-2">
        <DepartmentRow
          label="재정 부서 이름"
          value={value.financeName}
          rowKey="finance"
          error={errors.financeDepartmentName}
          onChange={name => set('financeName')({ target: { value: name } })}
        >
          <Badge tone="info">재정</Badge>
        </DepartmentRow>
        {value.departments.map((row, index) => (
          <DepartmentRow
            key={row.key}
            label={`부서 이름 ${index + 1}`}
            value={row.name}
            rowKey={row.key}
            error={errors[`departments.${index}`]}
            onChange={name => on.renameDepartment(row.key, name)}
          >
            <Button
              type="button"
              variant="ghost"
              size="icon"
              touch
              aria-label={`${row.name.trim() || '빈 부서'} 빼기`}
              onClick={() => {
                focusRow(rowAfterRemove(value.departments, row.key))
                on.removeDepartment(row.key)
              }}
            >
              <X />
            </Button>
          </DepartmentRow>
        ))}
      </ul>
      {canAddDepartment(value) && (
        <>
          <div className="flex flex-wrap gap-2">
            {suggestionsOf(value).map(name => (
              <Button
                key={name}
                type="button"
                variant="outline"
                size="sm"
                touch
                onClick={() => focusRow(on.addDepartment(name))}
              >
                <Plus />
                {name}
              </Button>
            ))}
          </div>
          {/* 이름을 직접 쓰는 새 줄은 미리 둔 부서 단추와 다른 일이라 따로 둔다(와이어프레임 ORG-02의 점선 '부서 추가'). */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            touch
            className="w-full border-dashed"
            onClick={() => focusRow(on.addDepartment())}
          >
            <Plus />
            부서 추가
          </Button>
        </>
      )}
    </section>
  )
}
