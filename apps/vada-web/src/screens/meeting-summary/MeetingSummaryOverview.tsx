import { FigmaAsset } from '../../components/FigmaAsset'
import {
  BANNER_TEXT,
  BANNER_TONE,
  NEUTRAL_BORDER,
  NEUTRAL_VALUE,
} from '../../design/tones'
import { MeetingStateChip } from '../meeting-shared/MeetingStateChip'
import type { MeetingSummaryView } from './data'
import { ASSET, NODE, SCREEN, scalar } from './spec'

function StatCell({ nodeId, label, value }: { nodeId: string; label: string; value: string }) {
  return (
    <span data-node-id={nodeId} className="block text-right">
      <span className="block text-xs text-gray-400">{label}</span>
      <span className="block pt-1 text-sm font-bold text-gray-800">{value}</span>
    </span>
  )
}

/** 회의 완료 상태, 참석 상태, 핵심 수치를 표시한다. */
export function MeetingSummaryOverview({ view }: { view: MeetingSummaryView }) {
  const { banner, head, decisionTile, followUpTile } = view.specs
  const bannerTone = scalar(view.detail, banner.toneField)
  const headItem = (at: number) => (head.items ?? [])[at]?.field

  return (
    <>
      <section
        data-node-id={NODE.banner}
        data-design-rule="state-banner"
        className={`flex items-start gap-2.5 rounded-xl border p-5 ${
          BANNER_TONE[bannerTone] ?? NEUTRAL_BORDER
        }`}
      >
        <FigmaAsset screenId={SCREEN} nodeId={ASSET.banner} className="mt-0.5 size-4 shrink-0" />
        <span className="min-w-0">
          <span className="flex flex-wrap items-center gap-2">
            <span
              data-design-rule="state-banner"
              className={`text-xs font-bold ${BANNER_TEXT[bannerTone]?.title ?? NEUTRAL_VALUE}`}
            >
              {scalar(view.detail, banner.titleField)}
            </span>
            {(banner.status ?? []).map((chip) => (
              <MeetingStateChip
                key={chip.field}
                label={scalar(view.detail, chip.field)}
                tone={scalar(view.detail, chip.toneField)}
              />
            ))}
          </span>
          <span
            data-design-rule="state-banner"
            className={`block pt-1.5 text-xs ${BANNER_TEXT[bannerTone]?.note ?? NEUTRAL_VALUE}`}
          >
            {scalar(view.detail, banner.descriptionField)}
          </span>
        </span>
      </section>

      <section className="flex flex-wrap items-start justify-between gap-4 rounded-xl border border-gray-200 bg-white px-6 py-5">
        <div data-node-id={NODE.head} className="min-w-0">
          <span className="block text-xs font-semibold text-blue-600">
            {scalar(view.detail, head.eyebrowField)}
          </span>
          <h2 className="pt-1 text-lg font-bold text-gray-900">
            {scalar(view.detail, head.titleField)}
          </h2>
          <span className="block pt-2 text-xs text-gray-500">
            <span>{scalar(view.detail, headItem(0))}</span>
            <span> · </span>
            <span>{scalar(view.detail, headItem(1))}</span>
          </span>
        </div>
        <div className="flex shrink-0 items-start gap-6">
          <StatCell
            nodeId={NODE.decisionTile}
            label={(decisionTile.items ?? [])[0]?.label ?? ''}
            value={scalar(view.detail, (decisionTile.items ?? [])[0]?.field)}
          />
          <StatCell
            nodeId={NODE.followUpTile}
            label={(followUpTile.items ?? [])[0]?.label ?? ''}
            value={scalar(view.detail, (followUpTile.items ?? [])[0]?.field)}
          />
        </div>
      </section>
    </>
  )
}
