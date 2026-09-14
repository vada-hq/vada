import { MUTED_CHIP } from '../../design/tones'
import type { DataRow } from '../../data-sources/definitions'
import { NODE } from './spec'
import { TaskChip } from './TaskChip'
import type { EventTaskDetailModel } from './useEventTaskDetail'

export function EventTaskDetailCard({ model }: { model: EventTaskDetailModel }) {
  return (
    <div data-node-id={NODE.detail} className="rounded-xl border border-gray-200 bg-white px-6 py-5">
      <span className="flex items-center gap-2">
        <span className="text-xs text-gray-400">{String(model.detail.code)}</span>
        <TaskChip label={String(model.detail.status)} tone={String(model.detail.statusTone)} />
        <TaskChip label={String(model.detail.priority)} tone={String(model.detail.priorityTone)} />
      </span>
      <h2 className="pt-2 text-xl font-bold text-gray-900">
        {String(model.detail[model.detailSpec.titleField ?? ''])}
      </h2>

      <div className="mt-4 border-t border-gray-100 pt-4">
        <dl className="grid grid-cols-2 gap-x-6 gap-y-4 md:grid-cols-4">
          {(model.detailSpec.items ?? []).slice(0, 4).map((item) => (
            <span key={item.label}>
              <dt className="text-xs font-semibold text-gray-400">{item.label}</dt>
              <dd className="pt-1 text-sm text-gray-700">
                {String(model.detail[item.field ?? ''])}
              </dd>
            </span>
          ))}
        </dl>
        {(model.detailSpec.items ?? []).slice(4, 5).map((item) => (
          <span key={item.label} className="block pt-4">
            <span className="block text-xs font-semibold text-gray-400">{item.label}</span>
            <span className="block pt-1 text-sm text-gray-700">
              {String(model.detail[item.field ?? ''])}
            </span>
          </span>
        ))}
      </div>

      <div className="mt-4 border-t border-gray-100 pt-4">
        {(model.detailSpec.items ?? []).slice(5).map((item) => (
          <span key={item.label} className="block">
            <span className="block text-xs font-semibold text-gray-400">{item.label}</span>
            <span className="block pt-1 text-sm text-gray-700">
              {String(model.detail[item.field ?? ''])}
            </span>
          </span>
        ))}
        <span className="grid grid-cols-1 gap-4 pt-4 md:grid-cols-2">
          <span>
            <span className="block text-xs font-semibold text-gray-400">예상 결과물</span>
            <span className="flex flex-wrap gap-2 pt-1.5">
              <span className="rounded border border-blue-100 bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700">
                {String(model.detail.expectedOutput)}
              </span>
            </span>
          </span>
          <span>
            <span className="block text-xs font-semibold text-gray-400">연결된 항목</span>
            <span className="flex flex-wrap gap-2 pt-1.5">
              {((model.detail.linkedItems ?? []) as DataRow[]).map((linked) => (
                <span
                  key={String(linked.label)}
                  className={`rounded px-2 py-1 text-xs font-medium ${MUTED_CHIP}`}
                >
                  {String(linked.label)}
                </span>
              ))}
            </span>
          </span>
        </span>
      </div>
    </div>
  )
}
