import { FigmaAsset } from '../../components/FigmaAsset'
import { BANNER_TEXT, BANNER_TONE, NEUTRAL_BORDER, NEUTRAL_VALUE } from '../../design/tones'
import { MeetingStateChip } from '../meeting-shared/MeetingStateChip'
import { meetingCompletionScalar as scalar, type MeetingCompletionModel } from './model'
import { ASSET, NODE, SCREEN } from './spec'

export function MeetingCompletionOverview({ model }: { model: MeetingCompletionModel }) {
  return (
    <>
      <section
        data-node-id={NODE.banner}
        data-design-rule="state-banner"
        className={`flex items-start gap-3 rounded-xl border px-4 py-3 ${
          BANNER_TONE[model.bannerTone] ?? NEUTRAL_BORDER
        }`}
      >
        <FigmaAsset screenId={SCREEN} nodeId={ASSET.banner} className="mt-0.5 size-4 shrink-0" />
        <span className="min-w-0">
          <span className="flex flex-wrap items-center gap-2">
            <span
              data-design-rule="state-banner"
              className={`text-xs font-bold ${
                BANNER_TEXT[model.bannerTone]?.title ?? NEUTRAL_VALUE
              }`}
            >
              {scalar(model.detail, model.banner.titleField)}
            </span>
            {(model.banner.status ?? []).map((chip) => (
              <MeetingStateChip
                key={chip.field}
                label={scalar(model.detail, chip.field)}
                tone={scalar(model.detail, chip.toneField)}
              />
            ))}
          </span>
          <span
            data-design-rule="state-banner"
            className={`block pt-1.5 text-xs ${
              BANNER_TEXT[model.bannerTone]?.note ?? NEUTRAL_VALUE
            }`}
          >
            {scalar(model.detail, model.banner.descriptionField)}
          </span>
        </span>
      </section>

      <section className="rounded-xl border border-gray-200 bg-white px-5 py-5">
        <div data-node-id={NODE.meeting}>
          <span className="block text-xs font-semibold text-blue-600">
            {scalar(model.detail, model.meeting.eyebrowField)}
          </span>
          <span className="block pt-1 text-lg font-bold text-gray-900">
            {scalar(model.detail, model.meeting.titleField)}
          </span>
          <span className="block pt-2 text-xs text-gray-500">
            <span>{scalar(model.detail, model.meetingItem(0))}</span>
            <span>{' · '}</span>
            <span>{scalar(model.detail, model.meetingItem(1))}</span>
          </span>
        </div>
      </section>
    </>
  )
}
