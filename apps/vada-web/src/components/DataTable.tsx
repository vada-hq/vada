import type { ReactNode } from 'react'
import type { DataRow, DataValue } from '../data-sources/catalog'
import { NEUTRAL_CHIP, STATE_CHIP } from '../design/tones'

type FieldPresentation = 'title' | 'body' | 'muted' | 'status'

interface DataColumn {
  label?: string
  fields: string[]
  // 딱지의 색 이름이 든 조각. 색이 아니라 어느 조각에 이름이 들었는가를
  // 명세가 가리킨다 — 화면이 'statusTone'을 짐작하지 않는다.
  toneField?: string
}

interface DataTableProps {
  nodeId?: string
  title: string
  columns: DataColumn[]
  rows: DataRow[]
  headerAction?: ReactNode
  emptyMessage: string
  fieldPresentation?: Record<string, FieldPresentation>
  columnWidths?: string[]
}

function displayValue(value: DataValue | undefined, field: string): string {
  if (value === undefined || Array.isArray(value)) {
    throw new Error(`표의 '${field}' 조각은 한 줄의 값이어야 합니다.`)
  }
  return String(value)
}

function CellValue({
  row,
  field,
  presentation,
  toneField,
}: {
  row: DataRow
  field: string
  presentation: FieldPresentation
  toneField?: string
}) {
  const value = displayValue(row[field], field)

  if (presentation === 'status') {
    if (toneField === undefined) {
      throw new Error(`상태 조각 '${field}'의 톤 조각이 지정되지 않았습니다.`)
    }
    const tone = displayValue(row[toneField], toneField)
    return (
      <span
        data-design-state
        data-design-rule="state-chip"
        className={`inline-flex self-start rounded border px-2 py-0.5 text-xs font-medium ${
          STATE_CHIP[tone] ?? NEUTRAL_CHIP
        }`}
      >
        {value}
      </span>
    )
  }

  const className =
    presentation === 'title'
      ? 'font-semibold text-gray-800'
      : presentation === 'body'
        ? 'font-normal text-gray-600'
        : 'font-normal text-gray-500'
  return <span className={className}>{value}</span>
}

// itemList의 열·행을 그대로 그리는 읽기 전용 표. 값의 순서나 필터링은 바꾸지 않는다.
export function DataTable({
  nodeId,
  title,
  columns,
  rows,
  headerAction,
  emptyMessage,
  fieldPresentation = {},
  columnWidths,
}: DataTableProps) {
  return (
    <section
      data-node-id={nodeId}
      className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm"
    >
      <header className="flex items-center justify-between gap-4 border-b border-gray-100 px-6 py-4">
        <h2 className="text-sm font-bold text-gray-800">{title}</h2>
        {headerAction}
      </header>
      <div className="overflow-x-auto">
        <table aria-label={title} className="w-full min-w-[720px] table-fixed">
          {columnWidths && (
            <colgroup>
              {columnWidths.map((width, index) => (
                <col key={`${columns[index]?.label ?? index}-${width}`} style={{ width }} />
              ))}
            </colgroup>
          )}
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              {columns.map((column, columnIndex) => (
                <th
                  key={column.label ?? columnIndex}
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-bold text-gray-500"
                >
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-6 py-8 text-center text-sm text-gray-500">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              rows.map((row, rowIndex) => (
                <tr
                  key={displayValue(row.id, 'id') || rowIndex}
                  className="border-b border-gray-50 last:border-b-0"
                >
                  {columns.map((column, columnIndex) => (
                    <td key={column.label ?? columnIndex} className="px-6 py-3 text-xs align-middle">
                      <span className="flex flex-col gap-1">
                        {column.fields.map((field) => (
                          <CellValue
                            key={field}
                            row={row}
                            field={field}
                            presentation={fieldPresentation[field] ?? 'body'}
                            toneField={column.toneField}
                          />
                        ))}
                      </span>
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}
