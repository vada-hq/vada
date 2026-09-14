import { FigmaAsset } from '../../components/FigmaAsset'
import { MUTED_CHIP } from '../../design/tones'
import { ASSET, NODE, SCREEN } from './spec'
import { TaskChip } from './TaskChip'
import type { EventTaskDetailModel } from './useEventTaskDetail'

export function TaskReferenceDocuments({ model }: { model: EventTaskDetailModel }) {
  return (
    <section data-node-id={NODE.references}>
      <span className="flex items-center gap-2">
        <span className="text-sm font-bold text-gray-700">{model.references.title}</span>
        <span className={`rounded px-2 py-1 text-xs text-gray-400 ${MUTED_CHIP}`}>
          행사 공용 원본 · 여러 업무에서 공유
        </span>
      </span>
      <ul className="flex flex-col gap-2 pt-3">
        {model.referenceRows.map((row) => (
          <li
            key={String(row.title)}
            className="flex items-start justify-between gap-4 rounded-lg border border-gray-200 p-4"
          >
            <span className="flex min-w-0 items-start gap-3">
              <FigmaAsset screenId={SCREEN} nodeId={ASSET.document} className="mt-0.5 size-4 shrink-0" />
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-gray-800">{String(row.title)}</span>
                <span className="block pt-0.5 text-xs text-gray-400">{String(row.description)}</span>
                <span className="block pt-1.5 text-xs text-gray-400">{String(row.lastModifiedNote)}</span>
              </span>
            </span>
            <TaskChip label={String(row.status)} tone={String(row.statusTone)} />
          </li>
        ))}
      </ul>
    </section>
  )
}
