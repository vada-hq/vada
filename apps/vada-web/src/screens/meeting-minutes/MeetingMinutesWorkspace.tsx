import { Built } from '../../components/Built'
import { FigmaAsset } from '../../components/FigmaAsset'
import {
  BANNER_TEXT,
  BANNER_TONE,
  NEUTRAL_BORDER,
  NEUTRAL_CHIP,
  NEUTRAL_VALUE,
  STATE_CHIP,
} from '../../design/tones'
import { scalarValue } from '../../data-sources/values'
import type { ScopeDraft } from '../../state/scopes'
import { AgendaCards } from './AgendaCards'
import { AgendaEditor } from './AgendaEditor'
import { MinutesCompletionConditions } from './MinutesCompletion'
import { MinutesSummary } from './MinutesSummary'
import { ASSET, NODE, SCREEN } from './spec'
import type { ReadyMeetingMinutesWorkspace } from './useMeetingMinutesWorkspace'

interface MeetingMinutesWorkspaceProps {
  model: ReadyMeetingMinutesWorkspace
  screenParams: Record<string, string>
  draft: ScopeDraft
  onNavigate: (screenId: string, params?: Record<string, string>) => void
}

export function MeetingMinutesWorkspace({
  model,
  screenParams,
  draft,
  onNavigate,
}: MeetingMinutesWorkspaceProps) {
  return (
    <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-4 pb-8">
      {model.submitAction.errorMessage === null ? null : (
        <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700">
          {model.submitAction.errorMessage}
        </p>
      )}
      {model.submitAction.pendingNote === null ? null : (
        <p role="status" className="rounded-xl border border-yellow-200 bg-yellow-50 px-4 py-3 text-xs text-yellow-800">
          {model.submitAction.pendingNote}
        </p>
      )}

      <section
        data-design-rule="state-banner"
        className={`flex items-start gap-3 rounded-xl border px-4 py-3 ${
          BANNER_TONE[model.bannerTone] ?? NEUTRAL_BORDER
        }`}
      >
        <FigmaAsset screenId={SCREEN} nodeId={ASSET.banner} className="mt-0.5 size-4" />
        <span className="min-w-0">
          <span className="flex flex-wrap items-center gap-2">
            <span className={`text-xs font-bold ${BANNER_TEXT[model.bannerTone]?.title ?? NEUTRAL_VALUE}`}>
              {scalarValue(model.detail, model.banner.titleField)}
            </span>
            {(model.banner.status ?? []).map((badge) => (
              <span
                key={badge.field}
                data-design-state
                data-design-rule="state-chip"
                className={`rounded-md border px-2 py-0.5 text-xs font-medium ${
                  STATE_CHIP[scalarValue(model.detail, badge.toneField)] ?? NEUTRAL_CHIP
                }`}
              >
                {scalarValue(model.detail, badge.field)}
              </span>
            ))}
          </span>
          <span className={`block pt-1 text-xs font-normal ${BANNER_TEXT[model.bannerTone]?.note ?? NEUTRAL_VALUE}`}>
            {scalarValue(model.detail, model.banner.descriptionField)}
          </span>
        </span>
      </section>

      <div data-node-id={NODE.facts} className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {(model.facts.items ?? []).map((item) => (
          <span key={item.field} className="rounded-xl border border-gray-200 bg-white px-4 py-3">
            <span className="block text-xs font-normal text-gray-400">{item.label}</span>
            <span className="block pt-1 text-xs font-bold text-gray-800">
              {scalarValue(model.detail, item.field)}
            </span>
          </span>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_360px]">
        <div className="flex flex-col gap-4">
          <MinutesSummary
            screenParams={screenParams}
            submitAction={model.submitAction}
            onNavigate={onNavigate}
            onPending={model.setNote}
          />
          {model.note === null ? null : (
            <p role="status" className="text-xs font-medium text-gray-500">{model.note}</p>
          )}
          <AgendaCards agendaRows={model.agendaRows} followUpRows={model.followUpRows} />
        </div>
        <div className="flex flex-col gap-4">
          <AgendaEditor
            screenParams={screenParams}
            draft={draft}
            field={model.field}
            agendaRows={model.agendaRows}
            followUpRows={model.followUpRows}
            onPending={model.setNote}
          />
          <Built what="정리 완료 조건">
            <MinutesCompletionConditions screenParams={screenParams} />
          </Built>
        </div>
      </div>
    </div>
  )
}
