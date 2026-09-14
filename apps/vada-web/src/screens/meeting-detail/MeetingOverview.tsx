import { FigmaAsset } from '../../components/FigmaAsset'
import { BANNER_TEXT, BANNER_TONE, NEUTRAL_BORDER, NEUTRAL_VALUE } from '../../design/tones'
import { MeetingStateChip } from '../meeting-shared/MeetingStateChip'
import { meetingScalar as scalar, type MeetingDetailModel } from './model'
import { ASSET, NODE, SCREEN } from './spec'
import { VariantButton } from './VariantControl'

export function MeetingOverview({ model }: { model: MeetingDetailModel }) {
  return (
    <>
      <section
        data-node-id={NODE.roleNotice}
        className="flex items-start gap-3 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3"
      >
        <FigmaAsset screenId={SCREEN} nodeId={ASSET.roleNotice} className="size-8 shrink-0" />
        <span className="min-w-0">
          <span className="block text-xs font-bold text-gray-800">
            {scalar(model.detail, model.roleNotice.titleField)}
          </span>
          <span className="block pt-0.5 text-xs font-normal text-gray-500">
            {scalar(model.detail, model.roleNotice.descriptionField)}
          </span>
        </span>
      </section>

      <section
        data-node-id={NODE.meeting}
        className="flex items-start justify-between gap-6 rounded-xl border border-gray-200 bg-white px-5 py-4"
      >
        <span className="min-w-0">
          <span className="flex flex-wrap items-center gap-2">
            {(model.meeting.status ?? []).map((badge) => (
              <MeetingStateChip
                key={badge.field}
                label={scalar(model.detail, badge.field)}
                tone={scalar(model.detail, badge.toneField)}
              />
            ))}
          </span>
          <span className="block pt-2.5 text-base font-bold text-gray-900">
            {scalar(model.detail, model.meeting.titleField)}
          </span>
          <span className="block pt-1.5 text-xs font-normal text-gray-500">
            {scalar(model.detail, model.meeting.descriptionField)}
          </span>
          <span className="flex items-center gap-1.5 pt-3 text-xs font-normal text-blue-600">
            <FigmaAsset screenId={SCREEN} nodeId={ASSET.event} className="size-3.5" />
            {scalar(model.detail, model.meetingItem(0)?.field)}
          </span>
        </span>
        <span className="shrink-0 text-right">
          <span className="block text-xs font-normal text-gray-400">
            {model.meetingItem(1)?.label}
          </span>
          <span className="block pt-1 text-xs font-bold text-gray-800">
            {scalar(model.detail, model.meetingItem(1)?.field)}
          </span>
          <span className="block pt-2.5 text-xs font-normal text-gray-400">
            {scalar(model.detail, model.meetingItem(2)?.field)}
          </span>
        </span>
      </section>

      <div data-node-id={NODE.facts} className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {(model.facts.items ?? []).map((item, at) => (
          <span key={item.field} className="block rounded-xl border border-gray-200 bg-white px-4 py-3">
            <span className="flex items-center gap-1.5">
              <FigmaAsset screenId={SCREEN} nodeId={ASSET.facts[at]} className="size-3.5" />
              <span className="text-xs font-semibold text-gray-400">{item.label}</span>
            </span>
            <span className="block pt-2 text-sm font-bold text-gray-800">
              {scalar(model.detail, item.field)}
            </span>
          </span>
        ))}
      </div>

      <section
        data-node-id={NODE.stateBanner}
        data-design-rule="state-banner"
        className={`flex items-start gap-3 rounded-xl border px-4 py-3 ${
          BANNER_TONE[model.bannerTone] ?? NEUTRAL_BORDER
        }`}
      >
        <FigmaAsset screenId={SCREEN} nodeId={ASSET.stateBanner} className="mt-0.5 size-4" />
        <span className="min-w-0">
          <span className={`block text-xs font-semibold ${BANNER_TEXT[model.bannerTone]?.title ?? NEUTRAL_VALUE}`}>
            {scalar(model.detail, model.stateBanner.titleField)}
          </span>
          <span className={`block pt-1 text-xs font-normal ${BANNER_TEXT[model.bannerTone]?.note ?? NEUTRAL_VALUE}`}>
            {scalar(model.detail, model.stateBanner.descriptionField)}
          </span>
        </span>
        {model.variant?.banner === undefined || model.variant?.banner === null ? null : (
          <span className="ml-auto shrink-0">
            <VariantButton model={model} slot={model.variant.banner} />
          </span>
        )}
      </section>
    </>
  )
}
