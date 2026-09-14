import { FigmaAsset } from '../../components/FigmaAsset'
import { MUTED_CHIP } from '../../design/tones'
import { ASSET, NODE, SCREEN } from './spec'
import { TaskChip } from './TaskChip'
import type { EventTaskDetailModel } from './useEventTaskDetail'

export function TaskWorkDocuments({ model }: { model: EventTaskDetailModel }) {
  return (
    <section data-node-id={NODE.work} className="pt-6">
      <span className="flex items-center gap-2">
        <span className="text-sm font-bold text-gray-700">{model.work.title}</span>
        <span className={`rounded px-2 py-1 text-xs text-gray-400 ${MUTED_CHIP}`}>
          이 업무에서 작성 중
        </span>
      </span>
      <div className="mt-3 rounded-lg border border-gray-200">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50 text-xs font-bold text-gray-400">
                <th className="px-3 py-2 font-bold">파일·문서명</th>
                <th className="px-3 py-2 font-bold">유형</th>
                <th className="px-3 py-2 font-bold">검토 상태</th>
                <th className="px-3 py-2 font-bold">공식 문서 반영</th>
              </tr>
            </thead>
            <tbody>
              {model.workRows.map((row) => (
                <tr key={String(row.title)} className="border-t border-gray-50">
                  <td className="px-3 py-2.5 text-sm font-medium text-gray-800">{String(row.title)}</td>
                  <td className="px-3 py-2.5 text-sm text-gray-500">{String(row.kind)}</td>
                  <td className="px-3 py-2.5">
                    <TaskChip label={String(row.status)} tone={String(row.statusTone)} />
                  </td>
                  <td className="px-3 py-2.5 text-sm text-gray-400">
                    {String(row.officialReflection)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <button
          type="button"
          data-node-id={NODE.addFile}
          onClick={model.pending(model.addFile)}
          className="m-3 flex items-center gap-1.5 rounded-md border border-gray-100 bg-white px-3 py-2 text-xs font-medium text-gray-400 hover:bg-gray-50 focus-visible:ring-2 focus-visible:ring-blue-600/50 focus-visible:outline-none"
        >
          <FigmaAsset screenId={SCREEN} nodeId={ASSET.addFile} className="size-3.5" />
          {model.addFile.label}
        </button>
      </div>
    </section>
  )
}
