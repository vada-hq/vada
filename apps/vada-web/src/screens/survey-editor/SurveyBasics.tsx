import { FigmaAsset } from '../../components/FigmaAsset'
import type { DataRow } from '../../data-sources/definitions'
import { ASSET, NODE, SCREEN, buttonAt, summaryAt } from './survey-spec'
import { scalar } from './survey-values'

interface SurveyBasicsProps {
  basicsRow: DataRow
  onEdit: () => void
}

// 기본정보는 요약만 보여 주고, 편집은 연결된 행사 기본정보 화면에 맡긴다.
export function SurveyBasics({ basicsRow, onEdit }: SurveyBasicsProps) {
  const basics = summaryAt(NODE.basics)
  return (
    <section
      data-node-id={NODE.basics}
      className="rounded-md border border-gray-200 bg-white"
    >
      <div className="flex items-center justify-between gap-2 px-3.5 py-2.5">
        <span className="flex items-center gap-2">
          <FigmaAsset screenId={SCREEN} nodeId={ASSET.basicsInfo} className="size-3" />
          <span className="text-xs font-semibold text-gray-700">{basics.title}</span>
          <span className="text-xs text-gray-400">{basics.description}</span>
        </span>
        <FigmaAsset screenId={SCREEN} nodeId={ASSET.basicsFold} className="size-3.5" />
      </div>

      <div className="border-t border-gray-100 px-3.5 py-2.5">
        <dl className="grid grid-cols-2 gap-x-6 gap-y-2">
          {(basics.items ?? []).map((item) => (
            <div key={item.field} className="flex gap-4">
              <dt className="w-14 shrink-0 text-xs text-gray-400">{item.label}</dt>
              <dd className="min-w-0 text-xs text-gray-700">
                {scalar(basicsRow, item.field)}
              </dd>
            </div>
          ))}
        </dl>

        <div className="mt-2.5 flex justify-end border-t border-gray-50 pt-2.5">
          <button
            type="button"
            data-node-id={NODE.basicsLink}
            onClick={onEdit}
            className="flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:underline"
          >
            <FigmaAsset screenId={SCREEN} nodeId={ASSET.basicsLink} className="size-2.5" />
            {buttonAt(NODE.basicsLink).label}
          </button>
        </div>
      </div>
    </section>
  )
}
