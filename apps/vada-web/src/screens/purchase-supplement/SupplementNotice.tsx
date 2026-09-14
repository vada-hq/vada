import { FigmaAsset } from '../../components/FigmaAsset'
import type { SupplementDraftModel } from './useSupplementDraft'
import { ASSET, NODE, SCREEN, scalar } from './spec'

export function SupplementNotice({ model }: { model: SupplementDraftModel }) {
  const { notice, noticeRow } = model
  return (
        <section
          data-node-id={NODE.notice}
          className="flex gap-3 rounded-xl border border-yellow-200 bg-yellow-50 p-4"
        >
          <FigmaAsset screenId={SCREEN} nodeId={ASSET.notice} className="mt-0.5 size-4 shrink-0" />
          <span className="min-w-0">
            <span className="block text-sm font-bold text-yellow-800">{notice.title}</span>
            <span className="block pt-1 text-xs font-normal text-yellow-700">
              {notice.description}
            </span>
            <span className="flex flex-wrap gap-4 pt-2">
              {(notice.items ?? []).map((item) => (
                <span key={item.field} className="text-xs font-semibold text-yellow-700">
                  {scalar(noticeRow, item.field ?? '')}
                </span>
              ))}
            </span>
          </span>
        </section>
  )
}
