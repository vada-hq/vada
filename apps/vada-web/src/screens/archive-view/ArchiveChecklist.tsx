import { Built } from '../../components/Built'
import { readListSource } from '../../data-sources/catalog'
import { findDataSource } from '../../data-sources/definitions'
import type { DataRow } from '../../data-sources/definitions'
import { scalarValue as scalar } from '../../data-sources/values'
import { resolveParams } from '../../spec/params'
import type { InputSpec, ItemListSpec } from '../../spec/types'
import type { ScopeDraft } from '../../state/scopes'
import { NODE, listAt, rowsOf, summaryAt } from './spec'

interface ArchiveChecklistProps {
  screenParams: Record<string, string>
  draft: ScopeDraft
  onChangeDraft: (next: ScopeDraft) => void
}

/** 부서별 인수인계 체크 상태를 화면 스코프 초안에 보관한다. */
export function ArchiveChecklist({ screenParams, draft, onChangeDraft }: ArchiveChecklistProps) {
  const checklist = listAt(NODE.checklist)
  const [checkColumn, checkLabel] = checklist.columns ?? []
  const checklistField = (checklist.itemFields ?? []).find(
    (entry) => (entry.spec as InputSpec).fieldKey === checkColumn?.fieldKey,
  )
  const checklistBox = checklistField?.spec as InputSpec
  const checkKey = (rowKey: string) =>
    `${checklist.fieldKey}.${rowKey}.${checklistBox.fieldKey}`
  const toggle = (rowKey: string, next: boolean) =>
    onChangeDraft({
      values: { ...draft.values, [checkKey(rowKey)]: next ? 'true' : null },
      labels: draft.labels,
    })
  const load = () =>
    readListSource(
      checklist.dataSourceKey,
      resolveParams(checklist.params, { screenParams }),
    )

  return (
    <aside className="h-fit rounded-xl border border-gray-200 bg-white">
      <div data-node-id={NODE.checklistHead} className="border-b border-gray-100 px-5 py-4">
        <h2 className="text-sm font-bold text-gray-800">{summaryAt(NODE.checklistHead).title}</h2>
        <p className="pt-0.5 text-xs text-gray-400">{summaryAt(NODE.checklistHead).description}</p>
      </div>
      <div data-node-id={NODE.checklist} className="px-5 py-4">
        <Built what="인수인계 체크리스트">
          <ChecklistRows
            checklist={checklist}
            load={load}
            registeredNodeId={checklistField?.source?.nodeId}
            inputType={checklistBox.inputType}
            labelField={(checkLabel?.fields ?? [])[0]}
            checkedOf={(rowKey, row) => {
              const stored = draft.values[checkKey(rowKey)]
              return stored === undefined || stored === null
                ? scalar(row, 'done') === 'true'
                : stored === 'true'
            }}
            onToggle={toggle}
          />
        </Built>
      </div>
    </aside>
  )
}

function ChecklistRows({
  checklist, load, registeredNodeId, inputType, labelField, checkedOf, onToggle,
}: {
  checklist: ItemListSpec
  load: () => DataRow[]
  registeredNodeId: string | undefined
  inputType: string | undefined
  labelField: string | undefined
  checkedOf: (rowKey: string, row: DataRow) => boolean
  onToggle: (rowKey: string, next: boolean) => void
}) {
  const groups = load()
  if (groups.length === 0) {
    return <p className="py-6 text-center text-xs text-gray-500">{findDataSource(checklist.dataSourceKey).messages.empty}</p>
  }
  return (
    <>
      {groups.map((group, groupIndex) => (
        <div key={scalar(group, 'groupLabel')} className="pb-4 last:pb-0">
          <span className="block text-xs font-bold text-blue-600">
            {scalar(group, ((checklist.group?.headerFields ?? [])[0]?.fields ?? [])[0])}
          </span>
          {rowsOf(group, checklist.group?.itemsField).map((row, rowIndex) => {
            const rowKey = scalar(row, 'key')
            return (
              <label
                key={rowKey}
                data-node-id={groupIndex === 0 && rowIndex === 0 ? registeredNodeId : undefined}
                className="flex items-center gap-2 pt-2"
              >
                <input
                  type={inputType}
                  checked={checkedOf(rowKey, row)}
                  aria-label={scalar(row, labelField)}
                  onChange={(event) => onToggle(rowKey, event.target.checked)}
                  className="size-3.5 shrink-0 rounded border-gray-300"
                />
                <span className="text-xs font-medium text-gray-600">{scalar(row, labelField)}</span>
              </label>
            )
          })}
        </div>
      ))}
    </>
  )
}
