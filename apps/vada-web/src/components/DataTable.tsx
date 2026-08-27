import type { ReactNode } from 'react'
import type { DataRow, DataValue } from '../data-sources/catalog'
import { NEUTRAL_CHIP, STATE_CHIP } from '../design/tones'

// 한 줄 안에서도 조각마다 무게가 다르다. 이름은 뜻이고, 그 뜻을 어떤 색으로
// 옮길지는 design/tones가 아니라 여기서 한 번에 정한다 — 표 안의 위계다.
// 'label'은 **줄을 가리키는 이름 칸**이다. title만큼 앞세우지는 않는다 -
// 권한 표의 '기능 영역'처럼 그 줄이 무엇에 대한 것인지를 말할 뿐 제목은 아니다.
type FieldPresentation =
  | 'title'
  | 'label'
  | 'strong'
  | 'body'
  | 'muted'
  | 'faint'
  | 'status'

interface DataColumn {
  label?: string
  // 읽는 열에는 조각이, 고치는 열에는 칸 이름이 온다. 둘 중 하나다.
  fields?: string[]
  fieldKey?: string
  // 딱지의 색 이름이 든 조각. 색이 아니라 어느 조각에 이름이 들었는가를
  // 명세가 가리킨다 — 화면이 'statusTone'을 짐작하지 않는다.
  toneField?: string
}

interface DataTableProps {
  nodeId?: string
  // 섹션 제목이 없는 표가 있다. 표 자체가 그 자리의 전부이면 제목을 그릴 자리가
  // 없고, 없는 제목을 명세가 지어내면 디자인에 없는 카피가 된다.
  title?: string
  /** 표를 부르는 이름. 제목이 그려지지 않을 때도 표에는 이름이 있어야 한다. */
  label: string
  columns: DataColumn[]
  rows: DataRow[]
  headerAction?: ReactNode
  // 행 하나를 눌렀을 때. 어느 행인지는 눌린 그 행만 알므로 호출부가 받는다.
  itemActionLabel?: string
  onItemAction?: (row: DataRow) => void
  emptyMessage: string
  fieldPresentation?: Record<string, FieldPresentation>
  columnWidths?: string[]
  /** 표 아래에 붙는 덧붙임. 카드 안이라 표와 한 칸이다(ORG-04의 '—' 설명). */
  footer?: ReactNode
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

  const className = {
    title: 'font-semibold text-gray-800',
    label: 'font-medium text-gray-800',
    strong: 'font-normal text-gray-700',
    body: 'font-normal text-gray-600',
    muted: 'font-normal text-gray-500',
    faint: 'font-normal text-gray-400',
    status: '',
  }[presentation]
  return <span className={className}>{value}</span>
}

// itemList의 열·행을 그대로 그리는 읽기 전용 표. 값의 순서나 필터링은 바꾸지 않는다.
export function DataTable({
  nodeId,
  title,
  label,
  columns,
  rows,
  headerAction,
  itemActionLabel,
  onItemAction,
  emptyMessage,
  fieldPresentation = {},
  columnWidths,
  footer,
}: DataTableProps) {
  return (
    <section
      data-node-id={nodeId}
      className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm"
    >
      {title === undefined && headerAction === undefined ? null : (
        <header className="flex items-center justify-between gap-4 border-b border-gray-100 px-6 py-4">
          {title === undefined ? <span /> : (
            <h2 className="text-sm font-bold text-gray-800">{title}</h2>
          )}
          {headerAction}
        </header>
      )}
      <div className="overflow-x-auto">
        <table aria-label={label} className="w-full min-w-[720px] table-fixed">
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
              {itemActionLabel === undefined ? null : <th scope="col" />}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length + (itemActionLabel === undefined ? 0 : 1)}
                  className="px-6 py-8 text-center text-sm text-gray-500">
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
                        {(column.fields ?? []).map((field) => (
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
                  {itemActionLabel === undefined ? null : (
                    <td className="px-6 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => onItemAction?.(row)}
                        aria-label={`${displayValue(row[columns[0]?.fields?.[0] ?? 'id'], 'title')} ${itemActionLabel}`}
                        className="rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 focus-visible:ring-2 focus-visible:ring-blue-600/50 focus-visible:outline-none"
                      >
                        {itemActionLabel}
                      </button>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {footer}
    </section>
  )
}
