import { Built } from '../../components/Built'
import { FigmaAsset } from '../../components/FigmaAsset'
import { findDataSource } from '../../data-sources/definitions'
import { scalarValue as scalar } from '../../data-sources/values'
import { ReviewCommentBox, dropdown } from './fields'
import { ASSET, CONDITION_ICON, NODE, SCREEN } from './spec'
import type { ArchiveEditorModel } from './useArchiveEditor'

/** 발행 조건, 검토자, 서버의 검토 의견을 표시한다. */
export function ArchiveReviewSidebar({ model }: { model: ArchiveEditorModel }) {
  const { gate, conditions, summaryAt, selectAt, reviewComment } = model.specs
  const [conditionLabel] = conditions.columns ?? []
  const reviewCommentItem = (reviewComment.items ?? [])[0]

  return (
    <aside className="flex h-fit flex-col gap-4">
      <section className="rounded-xl border border-gray-200 bg-white px-5 py-4">
        <div data-node-id={NODE.gate} className="flex items-baseline justify-between">
          <h2 className="text-sm font-bold text-gray-800">{gate.title}</h2>
          <span className="text-xs font-semibold text-orange-600">
            {scalar(model.gateRow, (gate.items ?? [])[0]?.field)}
          </span>
        </div>
        <ul data-node-id={NODE.gateConditions} className="pt-3">
          {model.conditionRows.map((row) => (
            <li key={scalar(row, 'key')} className="flex items-center gap-2 py-1">
              <FigmaAsset
                screenId={SCREEN}
                nodeId={CONDITION_ICON[scalar(row, conditionLabel?.toneField)] ?? ASSET.condition}
                className="size-3 shrink-0"
              />
              <span className="text-xs text-gray-600">
                {scalar(row, (conditionLabel?.fields ?? [])[0])}
              </span>
            </li>
          ))}
        </ul>
        <p data-node-id={NODE.gateNote} className="pt-3 text-xs text-orange-600">
          {summaryAt(NODE.gateNote).title}
        </p>
      </section>

      <section
        data-node-id={NODE.review}
        className="rounded-xl border border-gray-200 bg-white px-5 py-4"
      >
        <h2 className="text-sm font-bold text-gray-800">{summaryAt(NODE.review).title}</h2>
        <div data-node-id={NODE.reviewer} className="pt-3">
          <label
            htmlFor={selectAt(NODE.reviewer).fieldKey}
            className="block pb-1.5 text-xs font-medium text-gray-500"
          >
            {selectAt(NODE.reviewer).label}
          </label>
          {dropdown(selectAt(NODE.reviewer), model.field)}
        </div>
        <div data-node-id={NODE.reviewComment} className="pt-3">
          <span className="block pb-1.5 text-xs font-medium text-gray-500">
            {reviewCommentItem?.label}
          </span>
          <Built what="검토 의견">
            <ReviewCommentBox
              load={() => model.objectOf(reviewComment)}
              field={reviewCommentItem?.field}
              emptyNote={findDataSource(reviewComment.dataSourceKey).messages.empty}
            />
          </Built>
        </div>
      </section>
    </aside>
  )
}
