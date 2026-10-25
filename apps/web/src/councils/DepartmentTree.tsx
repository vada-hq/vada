import type { ReactNode } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { FieldErrors } from '@/lib/use-form-check'
import { cn } from '@/lib/utils'
import { canAddDepartment, suggestionsOf } from './council-draft'
import DepartmentCard from './DepartmentCard'
import { busClass, carriesTrunk, chartCell, type ChartCell } from './org-chart-rows'
import { useDepartmentEditing, useRowFocus, type DepartmentEditing } from './useDepartmentEditing'
import type { CouncilDraftState } from './useCouncilDraft'

type Props = Pick<
  CouncilDraftState,
  'draft' | 'set' | 'renameDepartment' | 'removeDepartment' | 'addDepartment'
> & { errors: FieldErrors }

const line = 'border-gray-300'

// 조직도의 한 칸. 넓은 화면은 위 가로선(칸마다 나눠 그림)에서 내려오는 짧은 선, 휴대폰은 왼쪽 세로선에서 꺾여 오는 선으로 잇는다.
// 부서 카드는 목록 항목이고, [부서 추가]는 목록 밖 칸이다(화면 읽기 프로그램이 세는 부서 수가 맞게).
type TreeItemProps = { cell: ChartCell; last: boolean; listItem: boolean; children: ReactNode }
function TreeItem({ cell, last, listItem, children }: TreeItemProps) {
  return (
    <div
      role={listItem ? 'listitem' : undefined}
      className={cn('relative flex pt-3 sm:px-1.5 sm:pt-4', !cell.lastRow && 'sm:pb-3')}
    >
      <span
        aria-hidden
        className={cn('absolute top-0 border-t max-sm:hidden', line, busClass(cell))}
      />
      <span
        aria-hidden
        className={cn('absolute top-0 left-1/2 h-4 border-l max-sm:hidden', line)}
      />
      {carriesTrunk(cell) && (
        <span
          aria-hidden
          className={cn('absolute top-0 -right-px bottom-0 border-l max-sm:hidden', line)}
        />
      )}
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
  const cards = cardsOf(props, tree)
  const total = cards.length + (canAdd ? 1 : 0)
  const item = (index: number, listItem: boolean, node: ReactNode, key: string) => (
    <TreeItem
      key={key}
      cell={chartCell(index, total)}
      last={index === total - 1}
      listItem={listItem}
    >
      {node}
    </TreeItem>
  )
  const suggestions = canAdd ? suggestionsOf(props.draft) : []
  return (
    <div className="flex flex-col gap-4">
      {/* 칸 넷의 격자. 부서 목록(role="list")은 격자에 칸을 그대로 넘기고(contents), [부서 추가]는 목록 밖 마지막 칸이다. */}
      <div
        ref={containerRef}
        className="relative flex flex-col max-sm:pl-8 sm:mt-4 sm:grid sm:grid-cols-4"
      >
        <span
          aria-hidden
          className={cn('absolute -top-4 left-1/2 h-4 border-l max-sm:hidden', line)}
        />
        <div role="list" aria-label="부서" className="contents">
          {cards.map((card, index) => item(index, true, card.node, card.key))}
        </div>
        {canAdd &&
          item(
            cards.length,
            false,
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
            </Button>,
            'add',
          )}
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
