import { FigmaAsset } from '../../components/FigmaAsset'
import { computeNumber, formatComputed } from '../../spec/compute'
import { getMutation } from '../../spec/mutations'
import { finReq01 } from '../../spec/screen-specs/finReq01'
import type { SubmitAction } from '../../spec/types'
import { ASSET, NODE, SCREEN } from './spec'
import type { PurchaseRequestDraftModel } from './usePurchaseRequestDraft'

/** 요청 요약, 저장·제출 동작, 검증 결과를 표시한다. */
export function PurchaseRequestSidebar({ model }: { model: PurchaseRequestDraftModel }) {
  const { aside, buttonAt } = model.specs
  return (
    <aside data-node-id={NODE.aside} className="flex w-72 shrink-0 flex-col gap-4">
      <div>
        <p className="text-sm font-bold text-gray-800">{aside.title}</p>
        <p className="pt-1 text-[10px] text-gray-400">{aside.description}</p>
      </div>

      <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
        {(aside.items ?? []).slice(0, 1).map((item) => (
          <div key={item.label} className="pb-3">
            <p className="text-[10px] font-semibold text-gray-400">{item.label}</p>
            <p className="flex items-baseline gap-0.5 pt-1">
              <span className="text-2xl font-bold text-blue-600">
                {formatComputed(computeNumber(item.compute!, { draft: model.draft }))}
              </span>
              <span className="text-sm font-medium text-blue-500">{item.unit}</span>
            </p>
          </div>
        ))}
        <div className="border-t border-gray-200 pt-2">
          {(aside.items ?? []).slice(1).map((item) => (
            <p key={item.label} className="flex items-center justify-between gap-2 py-1">
              <span className="text-[11px] text-gray-500">{item.label}</span>
              <span className="text-[11px] font-bold text-gray-800">
                {item.compute === undefined
                  ? model.reflected(item.fieldKey!)
                  : `${formatComputed(computeNumber(item.compute, { draft: model.draft }))}${item.unit ?? ''}`}
              </span>
            </p>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        {(
          [
            [NODE.submit, 'bg-blue-600 py-2.5 text-sm font-medium text-white hover:bg-blue-700'],
            [
              NODE.saveDraft,
              'border border-gray-300 bg-white py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50',
            ],
            [NODE.cancel, 'py-1.5 text-[11px] font-medium text-gray-400 hover:text-gray-600'],
          ] as const
        ).map(([nodeId, className]) => {
          const spec = buttonAt(nodeId)
          const running =
            spec.action.type === 'submit' &&
            model.submitAction.runningKey === spec.action.mutationKey
          return (
            <button
              key={nodeId}
              type="button"
              data-node-id={nodeId}
              onClick={() => model.pressButton(spec)}
              className={`w-full rounded-lg ${className}`}
            >
              {running
                ? getMutation((spec.action as SubmitAction).mutationKey).messages.submitting
                : spec.label}
            </button>
          )
        })}
      </div>

      {model.submitAction.errorMessage === null ? null : (
        <p role="alert" className="text-xs text-red-500">
          {model.submitAction.errorMessage}
        </p>
      )}
      {model.blockedKeys.length === 0 ? null : (
        <p role="alert" className="text-xs font-medium text-red-600">
          {`아직 채우지 않은 칸이 있습니다: ${model.blockedKeys
            .map((key) => model.labelOfField(key))
            .join(', ')}`}
        </p>
      )}
      {model.note === null ? null : (
        <p role="status" className="text-xs font-medium text-gray-500">
          {model.note}
        </p>
      )}
      <p className="flex gap-2 rounded-xl border border-blue-100 bg-blue-50 p-3 text-[10px] text-blue-700">
        <FigmaAsset screenId={SCREEN} nodeId={ASSET.submitNote} className="size-3 shrink-0" />
        <span>{finReq01.meta?.footerNote}</span>
      </p>
    </aside>
  )
}
