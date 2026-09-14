import { FigmaAsset } from '../../components/FigmaAsset'
import { readFieldRows, readObjectSourceOrNull } from '../../data-sources/catalog'
import { scalarValue } from '../../data-sources/values'
import { resolveParams } from '../../spec/params'
import { columnFieldOf } from '../../spec/types'
import type { SubmitAction } from '../../spec/types'
import type { useSubmitAction } from '../../spec/useSubmitAction'
import { ASSET, NODE, SCREEN, buttonAt, listAt, summaryAt } from './spec'

interface CompleteMinutesActionProps {
  screenParams: Record<string, string>
  submitAction: ReturnType<typeof useSubmitAction>
  onNavigate: (screenId: string, params?: Record<string, string>) => void
}

/** 서버가 알려 준 완료 가능 여부와 회의록 완료 동작을 연결한다. */
export function CompleteMinutesAction({
  screenParams,
  submitAction,
  onNavigate,
}: CompleteMinutesActionProps) {
  const blockedNote = summaryAt(NODE.blockedNote)
  const complete = buttonAt(NODE.complete)
  const progress = readObjectSourceOrNull(
    blockedNote.dataSourceKey ?? '',
    resolveParams(blockedNote.params, { screenParams }),
  )

  return (
    <span className="flex items-center gap-3">
      <span data-node-id={NODE.blockedNote} className="text-xs text-orange-600">
        {progress === null ? '' : scalarValue(progress, (blockedNote.items ?? [])[0]?.field)}
      </span>
      <button
        type="button"
        data-node-id={NODE.complete}
        onClick={() => {
          const action = complete.action as SubmitAction
          if (
            action.executeWhen?.type === 'sourceAllows' &&
            progress !== null &&
            scalarValue(progress, action.executeWhen.blockedNoteField) !== ''
          ) {
            return
          }
          void submitAction.run(action, {
            payload: { meetingId: screenParams.meetingId ?? '' },
            onNavigate,
          })
        }}
        className="flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
      >
        <FigmaAsset screenId={SCREEN} nodeId={ASSET.complete} className="size-3.5" />
        {submitAction.labelOf(complete.action as SubmitAction, complete.label)}
      </button>
    </span>
  )
}

/** 서버가 계산한 회의록 완료 조건을 표시한다. */
export function MinutesCompletionConditions({
  screenParams,
}: {
  screenParams: Record<string, string>
}) {
  const progressHeader = summaryAt(NODE.progressHeader)
  const conditions = listAt(NODE.conditions)
  const progress = readObjectSourceOrNull(
    progressHeader.dataSourceKey ?? '',
    resolveParams(progressHeader.params, { screenParams }),
  )
  const conditionRows = readFieldRows(
    conditions.dataSourceKey,
    conditions.itemsField,
    resolveParams(conditions.params, { screenParams }),
  )

  return (
    <section className="rounded-xl border border-gray-200 bg-white px-5 py-4">
      <div
        data-node-id={NODE.progressHeader}
        className="flex items-center justify-between gap-2"
      >
        <h3 className="text-xs font-bold text-gray-800">{progressHeader.title}</h3>
        <span className="text-xs font-semibold text-orange-600">
          {progress === null ? '' : scalarValue(progress, (progressHeader.items ?? [])[0]?.field)}
        </span>
      </div>
      <ul data-node-id={NODE.conditions} className="flex flex-col gap-2 pt-3">
        {conditionRows.map((row, at) => (
          <li
            key={at}
            className={`flex items-center gap-2 ${
              scalarValue(row, 'optional') === ''
                ? ''
                : 'rounded-lg border border-gray-100 px-2 py-1'
            }`}
          >
            <FigmaAsset
              screenId={SCREEN}
              nodeId={
                scalarValue(row, 'done') !== ''
                  ? ASSET.conditionDone
                  : scalarValue(row, 'optional') !== ''
                    ? ASSET.conditionOptional
                    : ASSET.conditionTodo
              }
              className="size-4"
            />
            <span className="text-xs font-normal text-gray-600">
              {scalarValue(row, columnFieldOf(conditions, 0))}
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}
