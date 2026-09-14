import { FigmaAsset } from '../../components/FigmaAsset'
import { drawnTitleOf, ext02a } from '../../spec/screens'
import type { ExternalSurveyFormModel } from './useExternalSurveyForm'
import { BRAND, NODE, ROW_ASSET, SCREEN } from './spec'

export function Brand() {
  return (
    <div className="flex items-center gap-2">
      <span className="flex size-6 items-center justify-center rounded bg-blue-600 text-xs font-bold text-white">
        {BRAND.slice(0, 1)}
      </span>
      <span className="text-sm font-semibold text-gray-700">{BRAND}</span>
    </div>
  )
}

export function BrandBar() {
  return (
    <div className="border-b border-gray-100 px-5 pt-4 pb-3">
      <Brand />
    </div>
  )
}

export function ExternalSurveyHeader({ model }: { model: ExternalSurveyFormModel }) {
  const { schedule, fee, form, screenParams } = model
  return (
        <div className="border-b border-gray-100 px-5 pt-4 pb-3">
          <Brand />
          <h1 className="pt-2.5 text-base font-bold text-gray-900">
            {drawnTitleOf(ext02a, screenParams)}
          </h1>

          <div data-node-id={NODE.schedule} className="flex flex-col gap-1.5 pt-2.5">
            {schedule.items!.map((item, at) => (
              <span key={item.field} className="flex items-center gap-2">
                <FigmaAsset screenId={SCREEN} nodeId={ROW_ASSET[at]} className="size-3.5" />
                {/* 값 하나가 제 요소를 가져야 대조가 짚는다. */}
                <span className="text-xs text-gray-600">{String(form[item.field!])}</span>
              </span>
            ))}
          </div>

          <div data-node-id={NODE.fee} className="pt-2.5">
            {/* 참가비 딱지. 색이 하나뿐이라 톤 이름을 받지 않는다 — 그림이 상태에
                따라 다른 색을 그리지 않았고, 무엇이 무료인지는 서버가 문장으로
                완성해 준다(같은 사실을 안쪽에서는 event.basics.fee가 갖는다). */}
            <span className="inline-block rounded border border-blue-200 bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
              {fee.items!.map((item) => (
                <span key={item.field}>
                  <span>{item.label}</span> <span>{String(form[item.field!])}</span>
                </span>
              ))}
            </span>
          </div>
        </div>
  )
}
