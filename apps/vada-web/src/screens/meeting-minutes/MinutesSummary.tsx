import { FigmaAsset } from '../../components/FigmaAsset'
import { readObjectSourceOrNull } from '../../data-sources/catalog'
import { scalarValue } from '../../data-sources/values'
import { resolveParams } from '../../spec/params'
import type { SubmitAction } from '../../spec/types'
import type { useSubmitAction } from '../../spec/useSubmitAction'
import { ASSET, NODE, SCREEN, buttonAt, summaryAt } from './spec'

interface MinutesSummaryProps {
  screenParams: Record<string, string>
  submitAction: ReturnType<typeof useSubmitAction>
  onNavigate: (screenId: string, params?: Record<string, string>) => void
  onPending: (note: string) => void
}

/** 전체 회의록 요약과 생성·직접 작성 동작을 담당한다. */
export function MinutesSummary({
  screenParams,
  submitAction,
  onNavigate,
  onPending,
}: MinutesSummaryProps) {
  const summaryHeader = summaryAt(NODE.summaryHeader)
  const aiDisclaimer = summaryAt(NODE.aiDisclaimer)
  const generate = buttonAt(NODE.generate)
  const writeByHand = buttonAt(NODE.writeByHand)
  const minutesRow = readObjectSourceOrNull(
    aiDisclaimer.dataSourceKey ?? '',
    resolveParams(aiDisclaimer.params, { screenParams }),
  )

  return (
    <section className="rounded-xl border border-gray-200 bg-white px-5 py-4">
      <div data-node-id={NODE.summaryHeader}>
        <h2 className="text-sm font-bold text-gray-900">{summaryHeader.title}</h2>
        <p className="pt-1 text-xs font-normal text-gray-400">{summaryHeader.description}</p>
      </div>

      <div className="mt-4 rounded-lg border border-gray-300 px-4 py-4">
        <p className="text-xs font-semibold text-gray-700">
          {minutesRow === null ? '' : scalarValue(minutesRow, 'summaryText')}
        </p>
        <p
          data-node-id={NODE.aiDisclaimer}
          className="whitespace-pre-line pt-2 text-xs font-normal text-gray-400"
        >
          {minutesRow === null
            ? ''
            : scalarValue(minutesRow, (aiDisclaimer.items ?? [])[0]?.field)}
        </p>
        <div className="flex items-center gap-3 pt-3">
          <button
            type="button"
            data-node-id={NODE.generate}
            onClick={() => {
              void submitAction.run(generate.action as SubmitAction, {
                payload: { meetingId: screenParams.meetingId ?? '' },
                onNavigate,
              })
            }}
            className="flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
          >
            <FigmaAsset screenId={SCREEN} nodeId={ASSET.generate} className="size-3.5" />
            {submitAction.labelOf(generate.action as SubmitAction, generate.label)}
          </button>
          <button
            type="button"
            data-node-id={NODE.writeByHand}
            onClick={() => {
              if (writeByHand.action.type === 'pending') {
                onPending(writeByHand.action.note)
              }
            }}
            className="text-xs font-medium text-blue-600 hover:underline"
          >
            {writeByHand.label}
          </button>
        </div>
      </div>
    </section>
  )
}
