import type { DataRow, DataValue } from '../data-sources/catalog'
import { NEUTRAL_CHIP, NEUTRAL_VALUE, STATE_TEXT, TABLE_STATE_CHIP } from '../design/tones'
import type { ItemListSpec } from '../spec/types'

type Column = NonNullable<ItemListSpec['columns']>[number]
type Group = NonNullable<ItemListSpec['group']>
type ColumnPresentation = 'title' | 'body' | 'amount' | 'chip' | 'toneText'

interface GroupedDataTableProps {
  /** 반복되는 틀의 등록 노드라 첫 묶음에만 붙인다. */
  firstGroupNodeId?: string
  columns: Column[]
  columnPresentations: ColumnPresentation[]
  group: Group
  groups: DataRow[]
  emptyMessage: string
}

function scalar(value: DataValue | undefined, field: string): string {
  if (value === undefined || Array.isArray(value)) {
    throw new Error(`묶음 표의 '${field}' 조각은 한 줄의 값이어야 합니다.`)
  }
  return String(value)
}

function fieldsOf(row: DataRow, descriptor: Column): string[] {
  if (descriptor.fields === undefined) {
    throw new Error('읽기 전용 묶음 표의 열에는 fields가 필요합니다.')
  }
  return descriptor.fields.map((field) => scalar(row[field], field))
}

function HeaderValue({ row, descriptor }: { row: DataRow; descriptor: Column }) {
  return (
    <span className="flex flex-col gap-0.5">
      {descriptor.label && <span className="text-xs text-gray-400">{descriptor.label}</span>}
      {fieldsOf(row, descriptor).map((value, index) => (
        <span key={`${descriptor.fields?.[index] ?? index}-${value}`}>{value}</span>
      ))}
    </span>
  )
}

function CellValue({
  row,
  column,
  presentation,
}: {
  row: DataRow
  column: Column
  presentation: ColumnPresentation
}) {
  const values = fieldsOf(row, column)
  const tone = column.toneField === undefined ? undefined : scalar(row[column.toneField], column.toneField)

  if ((presentation === 'chip' || presentation === 'toneText') && tone === undefined) {
    throw new Error(`톤 표현 열 '${column.label ?? ''}'에 toneField가 없습니다.`)
  }

  const className = {
    title: 'font-semibold text-gray-800',
    body: 'font-normal text-gray-500',
    amount: 'font-normal text-gray-600',
    chip: '',
    toneText: '',
  }[presentation]

  return (
    <span className="flex flex-col gap-1">
      {values.map((value, index) => {
        const key = `${column.fields?.[index] ?? index}-${value}`
        if (presentation === 'chip') {
          return (
            <span
              key={key}
              data-design-state
              data-design-rule="table-state-chip"
              className={`inline-flex self-start rounded px-2 py-0.5 font-bold ${
                TABLE_STATE_CHIP[tone ?? ''] ?? NEUTRAL_CHIP
              }`}
            >
              {value}
            </span>
          )
        }
        if (presentation === 'toneText') {
          return (
            <span
              key={key}
              data-design-state
              data-design-rule="state-text"
              className={`font-semibold ${STATE_TEXT[tone ?? ''] ?? NEUTRAL_VALUE}`}
            >
              {value}
            </span>
          )
        }
        return (
          <span key={key} className={className}>
            {value}
          </span>
        )
      })}
    </span>
  )
}

// 바깥 행이 묶음 머리, itemsField의 안쪽 행이 같은 열을 공유하는 읽기 전용 표다.
// 등록 노드는 첫 묶음뿐이지만 데이터가 주는 묶음은 모두 같은 틀로 그린다.
export function GroupedDataTable({
  firstGroupNodeId,
  columns,
  columnPresentations,
  group,
  groups,
  emptyMessage,
}: GroupedDataTableProps) {
  if (columns.length !== columnPresentations.length) {
    throw new Error('묶음 표의 열과 표현 방식 수가 다릅니다.')
  }
  if (group.headerFields === undefined) {
    throw new Error('묶음 표의 머리에 그릴 headerFields가 없습니다.')
  }
  const headerFields = group.headerFields

  if (groups.length === 0) {
    return <p className="rounded-xl border border-gray-200 bg-white p-6 text-sm text-gray-500">{emptyMessage}</p>
  }

  return (
    <div className="flex flex-col gap-6">
      {groups.map((row, groupIndex) => {
        const id = scalar(row.id, 'id')
        const items = row[group.itemsField]
        if (!Array.isArray(items)) {
          throw new Error(`묶음의 '${group.itemsField}' 조각은 목록이어야 합니다.`)
        }
        const [headline, ...afterHeadline] = headerFields
        if (headline === undefined) {
          throw new Error('묶음 표의 첫 머리 조각이 없습니다.')
        }
        const trailing = afterHeadline.length === 0 ? undefined : afterHeadline.at(-1)
        const supporting = trailing === undefined ? [] : afterHeadline.slice(0, -1)
        const tableLabel = fieldsOf(row, headline).join(' ')

        return (
          <section
            key={id}
            data-node-id={groupIndex === 0 ? firstGroupNodeId : undefined}
            aria-label={tableLabel}
            className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm"
          >
            <header className="flex items-center justify-between gap-6 border-b border-gray-100 bg-gray-50 px-6 py-4">
              <div className="min-w-0">
                <h2 className="text-xs font-bold text-gray-700">
                  <HeaderValue row={row} descriptor={headline} />
                </h2>
                {supporting.map((descriptor, index) => (
                  <p key={descriptor.fields?.join('-') ?? index} className="pt-0.5 text-xs text-gray-400">
                    <HeaderValue row={row} descriptor={descriptor} />
                  </p>
                ))}
              </div>
              {trailing && (
                <p className="shrink-0 text-sm font-bold text-gray-900">
                  <HeaderValue row={row} descriptor={trailing} />
                </p>
              )}
            </header>

            <div className="overflow-x-auto">
              <table aria-label={tableLabel} className="w-full min-w-[800px] table-fixed">
                <thead>
                  <tr className="border-b border-gray-100">
                    {columns.map((column, index) => (
                      <th
                        key={column.label ?? index}
                        scope="col"
                        className="px-6 py-3 text-left text-xs font-bold text-gray-400"
                      >
                        {column.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, itemIndex) => (
                    <tr
                      key={scalar(item.id, 'id') || itemIndex}
                      className="border-b border-gray-50 last:border-b-0"
                    >
                      {columns.map((column, columnIndex) => (
                        <td
                          key={column.label ?? columnIndex}
                          className="px-6 py-3 text-xs align-middle"
                        >
                          <CellValue
                            row={item}
                            column={column}
                            presentation={columnPresentations[columnIndex] ?? 'body'}
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )
      })}
    </div>
  )
}
