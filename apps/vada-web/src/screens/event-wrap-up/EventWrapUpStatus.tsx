import { FigmaAsset } from '../../components/FigmaAsset'
import {
  BANNER_TEXT,
  BANNER_TONE,
  NEUTRAL_BORDER,
  NEUTRAL_CHIP,
  NEUTRAL_VALUE,
  STATE_CHIP,
} from '../../design/tones'
import { ASSET, NODE, SCREEN } from './spec'
import type { EventWrapUpModel } from './useEventWrapUp'

export function EventWrapUpStatus({ model }: { model: EventWrapUpModel }) {
  return (
    <>
      <div data-node-id={NODE.state} className="flex flex-wrap items-center gap-3 pt-6">
        {(model.state.spec.status ?? []).map((chip) => (
          <span
            key={chip.field}
            data-design-state
            data-design-rule="state-chip"
            className={`rounded px-2 py-0.5 text-xs font-semibold ${
              STATE_CHIP[String(model.state.row[chip.toneField])] ?? NEUTRAL_CHIP
            }`}
          >
            {String(model.state.row[chip.field])}
          </span>
        ))}
        {(model.state.spec.items ?? []).map((item) => (
          <span key={item.field} className="text-xs text-gray-400">
            {String(model.state.row[item.field ?? ''])}
          </span>
        ))}
      </div>

      <div
        data-node-id={NODE.banner}
        data-design-rule="state-banner"
        className={`mt-4 flex items-start gap-3 rounded-xl border p-4 ${
          BANNER_TONE[model.bannerTone] ?? NEUTRAL_BORDER
        }`}
      >
        <FigmaAsset screenId={SCREEN} nodeId={ASSET.banner} className="mt-0.5 size-3.5 shrink-0" />
        <span className="min-w-0">
          <span
            data-design-rule="state-banner"
            className={`block text-sm font-semibold ${
              BANNER_TEXT[model.bannerTone]?.title ?? NEUTRAL_VALUE
            }`}
          >
            {String(model.banner.row[model.banner.spec.titleField ?? ''])}
          </span>
          <span
            data-design-rule="state-banner"
            className={`block pt-1 text-xs ${
              BANNER_TEXT[model.bannerTone]?.note ?? NEUTRAL_VALUE
            }`}
          >
            {String(model.banner.row[model.banner.spec.descriptionField ?? ''])}
          </span>
        </span>
      </div>
    </>
  )
}
