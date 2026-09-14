import { FigmaAsset } from '../../components/FigmaAsset'
import { ASSET, NODE, SCREEN } from './spec'
import { TaskChip } from './TaskChip'
import type { EventTaskDetailModel } from './useEventTaskDetail'

export function TaskReviewSummary({ model }: { model: EventTaskDetailModel }) {
  return (
    <section
      data-node-id={NODE.review}
      className="mt-6 rounded-lg border border-yellow-200 bg-yellow-50 p-4"
    >
      <span className="block text-sm font-bold text-gray-700">{model.reviewSpec.title}</span>
      <span className="flex flex-wrap gap-6 pt-3">
        {(model.reviewSpec.items ?? []).slice(0, 2).map((item) => (
          <span key={item.label} className="flex items-center gap-2">
            <span className="text-xs font-semibold text-gray-500">{item.label}</span>
            <TaskChip
              label={String(model.review[item.field ?? ''])}
              tone={String(model.review[`${item.field}Tone`])}
            />
          </span>
        ))}
      </span>
      {(model.reviewSpec.items ?? []).slice(2).map((item) => (
        <span key={item.label} className="block pt-3">
          <span className="block text-xs font-semibold text-gray-500">{item.label}</span>
          <span className="block pt-1 text-sm text-yellow-800">
            {String(model.review[item.field ?? ''])}
          </span>
        </span>
      ))}
      <span className="flex items-center gap-1.5 pt-3 text-sm font-medium text-red-600">
        <FigmaAsset screenId={SCREEN} nodeId={ASSET.nextStep} className="size-3.5" />
        {String(model.review.nextStepNote)}
      </span>
    </section>
  )
}
