import { NODE } from './spec'
import { TaskReferenceDocuments } from './TaskReferenceDocuments'
import { TaskReviewSummary } from './TaskReviewSummary'
import { TaskWorkDocuments } from './TaskWorkDocuments'
import type { EventTaskDetailModel } from './useEventTaskDetail'

export function EventTaskDocuments({ model }: { model: EventTaskDetailModel }) {
  return (
    <div className="mt-6 rounded-xl border border-gray-200 bg-white">
      <div
        data-node-id={NODE.tab}
        role="radiogroup"
        aria-label={model.tab.label ?? '갈피'}
        className="flex gap-6 border-b border-gray-100 px-6"
      >
        {model.tabOptions.map((option) => {
          const value = String(option.value)
          const selected = value === model.tabValue
          return (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => model.setTabValue(value)}
              className={`border-b-2 py-3.5 text-sm font-semibold ${
                selected
                  ? 'border-blue-600 text-blue-700'
                  : 'border-transparent text-gray-400 hover:text-gray-600'
              }`}
            >
              {option.label}
            </button>
          )
        })}
      </div>

      {model.tabValue !== 'documents' ? (
        <p role="status" className="px-6 py-10 text-center text-sm text-gray-500">
          {model.selectedTab?.description}
        </p>
      ) : (
        <div className="px-6 py-5">
          <TaskReferenceDocuments model={model} />
          <TaskWorkDocuments model={model} />
          <TaskReviewSummary model={model} />
        </div>
      )}
    </div>
  )
}
