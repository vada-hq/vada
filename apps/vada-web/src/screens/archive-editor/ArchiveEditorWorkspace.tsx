import { AppShell } from '../../components/AppShell'
import { Breadcrumbs } from '../../components/Breadcrumbs'
import { FigmaAsset } from '../../components/FigmaAsset'
import { scalarValue as scalar } from '../../data-sources/values'
import { NEUTRAL_CHIP, STATE_CHIP } from '../../design/tones'
import { rec02a } from '../../spec/screens'
import type { SubmitAction } from '../../spec/types'
import type { ScopeDraft } from '../../state/scopes'
import { ArchiveForm } from './ArchiveForm'
import { ArchiveReviewSidebar } from './ArchiveReviewSidebar'
import { ArchiveToc } from './ArchiveToc'
import { ASSET, NODE, SCREEN } from './spec'
import { useArchiveEditor } from './useArchiveEditor'

interface ArchiveEditorWorkspaceProps {
  screenParams: Record<string, string>
  scopeDraft: ScopeDraft
  onChangeDraft: (next: ScopeDraft) => void
  onNavigate: (screenId: string, params?: Record<string, string>) => void
}

/** 아카이브 초안 모델과 목차·본문·검토 영역을 조립한다. */
export function ArchiveEditorWorkspace(props: ArchiveEditorWorkspaceProps) {
  const model = useArchiveEditor(props)
  const { statusChip, saveDraft, requestReview, banner } = model.specs
  const breadcrumb = rec02a.breadcrumb

  return (
    <AppShell
      screenId={rec02a.screenId}
      activeNavigationScreenId={rec02a.activeNavigationScreenId}
      eyebrow={rec02a.meta?.eyebrow}
      title={rec02a.meta?.title ?? rec02a.screenId}
      onNavigate={props.onNavigate}
      breadcrumb={
        breadcrumb === undefined ? undefined : (
          <Breadcrumbs
            nodeId={breadcrumb.source}
            screenId={SCREEN}
            separatorNodeIds={[...ASSET.breadcrumbSeparators]}
            items={breadcrumb.items.map((item) =>
              item.value ?? scalar(model.archiveRow, item.field),
            )}
          />
        )
      }
      headerAction={
        <span className="flex items-center gap-2">
          <span
            data-node-id={NODE.statusChip}
            data-design-rule="state-chip"
            className={`rounded px-2 py-0.5 text-xs font-medium ${
              STATE_CHIP[scalar(model.archiveRow, statusChip.toneField)] ?? NEUTRAL_CHIP
            }`}
          >
            {scalar(model.archiveRow, (statusChip.items ?? [])[0]?.field)}
          </span>
          <button
            type="button"
            data-node-id={NODE.saveDraft}
            onClick={() => model.send(saveDraft)}
            className="rounded border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
          >
            {model.submitAction.labelOf(saveDraft.action as SubmitAction, saveDraft.label)}
          </button>
          <button
            type="button"
            data-node-id={NODE.requestReview}
            onClick={model.pressRequestReview}
            className={`flex items-center gap-1.5 rounded border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 ${
              model.blockedNote === '' ? 'hover:bg-gray-50' : 'opacity-40'
            }`}
          >
            <FigmaAsset screenId={SCREEN} nodeId={ASSET.requestReview} className="size-3" />
            {model.submitAction.labelOf(
              requestReview.action as SubmitAction,
              requestReview.label,
            )}
          </button>
        </span>
      }
    >
      <div
        data-node-id={NODE.banner}
        className="flex items-start gap-3 rounded-xl border border-blue-100 bg-blue-50 px-5 py-4"
      >
        <FigmaAsset screenId={SCREEN} nodeId={ASSET.banner} className="mt-0.5 size-4 shrink-0" />
        <span className="block">
          <span className="block text-sm font-bold text-blue-900">{banner.title}</span>
          <span className="block pt-1 text-sm text-blue-800">{banner.description}</span>
        </span>
      </div>

      <div className="grid grid-cols-1 gap-4 pt-4 pb-12 lg:grid-cols-[180px_1fr_260px]">
        <ArchiveToc model={model} />
        <ArchiveForm model={model} />
        <ArchiveReviewSidebar model={model} />
      </div>

      {model.submitAction.submittingMessage === null ? null : (
        <p role="status" className="pb-2 text-xs text-gray-500">
          {model.submitAction.submittingMessage}
        </p>
      )}
      {model.submitAction.errorMessage === null ? null : (
        <p role="alert" className="pb-2 text-xs text-red-500">
          {model.submitAction.errorMessage}
        </p>
      )}
      {model.submitAction.pendingNote === null ? null : (
        <p role="status" className="pb-6 text-xs text-gray-500">
          {model.submitAction.pendingNote}
        </p>
      )}
      {model.note === null ? null : (
        <p role="status" className="pb-6 text-xs text-gray-500">
          {model.note}
        </p>
      )}
    </AppShell>
  )
}
