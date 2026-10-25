import type { ReactNode } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { FieldErrors } from '@/lib/use-form-check'
import { cn } from '@/lib/utils'
import { canAddDepartment, suggestionsOf } from './council-draft'
import DepartmentCard from './DepartmentCard'
import { busEndClass, chartRows } from './org-chart-rows'
import { useDepartmentEditing, useRowFocus, type DepartmentEditing } from './useDepartmentEditing'
import type { CouncilDraftState } from './useCouncilDraft'

type Props = Pick<
  CouncilDraftState,
  'draft' | 'set' | 'renameDepartment' | 'removeDepartment' | 'addDepartment'
> & { errors: FieldErrors }

const line = 'border-gray-300'

// 조직도의 한 칸. 넓은 화면은 위 가로선에서 내려오는 짧은 선, 휴대폰은 왼쪽 세로선에서 꺾여 오는 선으로 잇는다.
function TreeItem({ last, children }: { last: boolean; children: ReactNode }) {
  return (
    <div role="listitem" className="relative flex pt-3 sm:px-1.5 sm:pt-4">
      <span
        aria-hidden
        className={cn('absolute top-0 left-1/2 h-4 border-l max-sm:hidden', line)}
      />
      <div className="relative flex min-w-0 flex-1">
        <span
          aria-hidden
          className={cn(
            'absolute -top-3 bottom-1/2 -left-4 w-4 rounded-bl-md border-b border-l sm:hidden',
            line,
          )}
        />
        {!last && (
          <span
            aria-hidden
            className={cn('absolute top-1/2 bottom-0 -left-4 border-l sm:hidden', line)}
          />
        )}
        {children}
      </div>
    </div>
  )
}

function cardsOf({ draft, errors }: Props, tree: DepartmentEditing) {
  const card = (row: 'finance' | number, label: string, name: string, error?: string) => (
    <DepartmentCard
      row={row}
      label={label}
      name={name}
      editing={tree.editingRow === row}
      error={tree.shownProblemOf(row) ?? error}
      onStart={() => tree.start(row)}
      onEnter={() => tree.enter(row)}
      onRename={next => tree.rename(row, next)}
      onCommit={refocus => tree.commit(row, refocus)}
      onCancel={() => tree.cancel(row)}
      onRemove={row === 'finance' ? undefined : () => tree.remove(row)}
    />
  )
  return [
    {
      key: 'finance',
      node: card('finance', '재정 부서 이름', draft.financeName, errors.financeDepartmentName),
    },
    ...draft.departments.map((department, index) => ({
      key: String(department.key),
      node: card(
        department.key,
        `부서 이름 ${index + 1}`,
        department.name,
        errors[`departments.${index}`],
      ),
    })),
  ]
}

// 조직 구조의 부서 조직도(와이어프레임 ORG-02, 기능 020 정한 것 6): 회장단 카드 아래로 선이 갈라져 부서 카드가 놓이고,
// 끝에 점선 [부서 추가], 그 아래 미리 둔 부서 더하기 단추. 재정 역할 부서는 늘 있고 뺄 수 없다.
// 넓은 화면은 가로 줄(넷씩 줄 바꿈), 휴대폰은 같은 카드를 세로로 쌓고 왼쪽 세로선으로 잇는다(조직도의 모바일 관례).
export default function DepartmentTree(props: Props) {
  const { containerRef, focusOn } = useRowFocus()
  const tree = useDepartmentEditing(props, focusOn)
  const canAdd = canAddDepartment(props.draft)
  const items = cardsOf(props, tree)
  if (canAdd)
    items.push({
      key: 'add',
      node: (
        <Button
          type="button"
          variant="outline"
          touch
          data-row="add"
          className="h-auto w-full flex-1 border-dashed text-gray-500 sm:flex-col sm:py-3"
          onClick={tree.addBlank}
        >
          <Plus />
          부서 추가
        </Button>
      ),
    })
  const rows = chartRows(items)
  const suggestions = canAdd ? suggestionsOf(props.draft) : []
  return (
    <div className="flex flex-col gap-4">
      <div
        ref={containerRef}
        role="list"
        aria-label="부서"
        className="relative flex flex-col max-sm:pl-8 sm:mt-4"
      >
        <span
          aria-hidden
          className={cn('absolute -top-4 left-1/2 h-4 border-l max-sm:hidden', line)}
        />
        {rows.map((row, at) => {
          const lastRow = at === rows.length - 1
          return (
            <div
              key={row[0]!.key}
              className={cn(
                'relative max-sm:contents sm:grid sm:grid-cols-4',
                !lastRow && 'sm:pb-3',
              )}
            >
              <span
                aria-hidden
                className={cn(
                  'absolute top-0 left-1/8 border-t max-sm:hidden',
                  line,
                  busEndClass(row.length),
                )}
              />
              {!lastRow && (
                <span
                  aria-hidden
                  className={cn('absolute top-0 bottom-0 left-1/2 border-l max-sm:hidden', line)}
                />
              )}
              {row.map((item, index) => (
                <TreeItem key={item.key} last={lastRow && index === row.length - 1}>
                  {item.node}
                </TreeItem>
              ))}
            </div>
          )
        })}
      </div>
      {suggestions.length > 0 && (
        <div className="flex flex-wrap gap-2 sm:justify-center">
          {suggestions.map(name => (
            <Button
              key={name}
              type="button"
              variant="outline"
              size="sm"
              touch
              onClick={() => tree.addNamed(name)}
            >
              <Plus />
              {name}
            </Button>
          ))}
        </div>
      )}
    </div>
  )
}
