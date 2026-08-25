import type { DataRow, DataValue } from '../data-sources/catalog'

interface ActivityTimelineProps {
  nodeId?: string
  title: string
  rows: DataRow[]
  titleField: string
  noteField: string
  emptyMessage: string
}

function displayValue(value: DataValue | undefined, field: string): string {
  if (value === undefined || Array.isArray(value)) {
    throw new Error(`처리 기록의 '${field}' 조각은 한 줄의 값이어야 합니다.`)
  }
  return String(value)
}

// 시간순으로 받은 기록을 다시 정렬하지 않고 점과 두 줄의 글로 보여준다.
export function ActivityTimeline({
  nodeId,
  title,
  rows,
  titleField,
  noteField,
  emptyMessage,
}: ActivityTimelineProps) {
  return (
    <section
      data-node-id={nodeId}
      className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm"
    >
      <h2 className="text-sm font-bold text-gray-800">{title}</h2>
      {rows.length === 0 ? (
        <p className="pt-4 text-sm text-gray-500">{emptyMessage}</p>
      ) : (
        <ol className="space-y-4 pt-4">
          {rows.map((row, index) => (
            <li key={displayValue(row.id, 'id') || index} className="flex items-start gap-3">
              <span aria-hidden="true" className="mt-1.5 size-1.5 shrink-0 rounded-full bg-blue-400" />
              <span>
                <span className="block text-xs font-semibold text-gray-800">
                  {displayValue(row[titleField], titleField)}
                </span>
                <span className="block text-xs font-normal text-gray-400">
                  {displayValue(row[noteField], noteField)}
                </span>
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}
