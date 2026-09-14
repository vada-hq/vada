import { FigmaAsset } from '../../components/FigmaAsset'
import {
  BANNER_TEXT,
  BANNER_TONE,
  NEUTRAL_BORDER,
  NEUTRAL_CHIP,
  NEUTRAL_VALUE,
  STATE_CHIP,
} from '../../design/tones'
import type { DataRow, DataValue } from '../../data-sources/definitions'
import type { SummarySpec } from '../../spec/types'

const SCREEN = 'OPS-MEET-09'

const NODE = {
  banner: '20:2719',
  meeting: '20:2732',
  cancellation: '20:2754',
  replacement: '20:2771',
} as const

const ASSET = {
  cancelled: '20:2720',
  openReplacement: '20:2779',
} as const

export function cancelledMeetingScalar(row: DataRow, field: string | undefined): string {
  const value: DataValue | undefined = field === undefined ? undefined : row[field]
  if (value === undefined || Array.isArray(value)) {
    throw new Error(`OPS-MEET-09의 '${field}' 조각은 한 줄의 값이어야 합니다.`)
  }
  return String(value)
}

interface CancelledMeetingDetailsProps {
  detail: DataRow
  banner: SummarySpec
  meeting: SummarySpec
  cancellation: SummarySpec
  replacement: SummarySpec
  bannerTone: string
  notice: string | null
  onOpenReplacement: () => void
}

export function CancelledMeetingDetails({
  detail,
  banner,
  meeting,
  cancellation,
  replacement,
  bannerTone,
  notice,
  onOpenReplacement,
}: CancelledMeetingDetailsProps) {
  const replacementAction = replacement.action

  return (
    <div className="mx-auto flex w-full max-w-[968px] flex-col gap-5">
      <section
        data-node-id={NODE.banner}
        data-design-rule="state-banner"
        className={`flex items-start gap-2.5 rounded-xl border p-5 ${
          BANNER_TONE[bannerTone] ?? NEUTRAL_BORDER
        }`}
      >
        <FigmaAsset
          screenId={SCREEN}
          nodeId={ASSET.cancelled}
          className="mt-0.5 size-4 shrink-0"
        />
        <span className="min-w-0">
          <span className="flex flex-wrap items-center gap-2">
            <span
              data-design-rule="state-banner"
              className={`text-xs font-bold ${BANNER_TEXT[bannerTone]?.title ?? NEUTRAL_VALUE}`}
            >
              {cancelledMeetingScalar(detail, banner.titleField)}
            </span>
            {(banner.status ?? []).map((chip) => (
              <span
                key={chip.field}
                data-design-state
                data-design-rule="state-chip"
                className={`rounded px-2 py-0.5 text-xs font-medium ${
                  STATE_CHIP[cancelledMeetingScalar(detail, chip.toneField)] ?? NEUTRAL_CHIP
                }`}
              >
                {cancelledMeetingScalar(detail, chip.field)}
              </span>
            ))}
          </span>
          <span
            data-design-rule="state-banner"
            className={`block pt-1.5 text-xs ${BANNER_TEXT[bannerTone]?.note ?? NEUTRAL_VALUE}`}
          >
            {cancelledMeetingScalar(detail, banner.descriptionField)}
          </span>
        </span>
      </section>

      <section
        data-node-id={NODE.meeting}
        className="rounded-xl border border-gray-200 bg-white p-6"
      >
        <h2 className="text-lg font-bold text-gray-900">
          {cancelledMeetingScalar(detail, meeting.titleField)}
        </h2>
        <p className="pt-2 text-xs text-gray-500">
          {cancelledMeetingScalar(detail, meeting.descriptionField)}
        </p>
        <dl className="mt-5 grid grid-cols-1 gap-4 border-t border-gray-100 pt-5 sm:grid-cols-3">
          {(meeting.items ?? []).map((item) => (
            <div key={item.label}>
              <dt className="text-xs text-gray-400">{item.label}</dt>
              <dd className="pt-1 text-xs font-semibold text-gray-800">
                {cancelledMeetingScalar(detail, item.field)}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      <section
        data-node-id={NODE.cancellation}
        className="overflow-hidden rounded-xl border border-gray-200 bg-white"
      >
        <div className="border-b border-gray-100 px-5 py-4">
          <h2 className="text-sm font-bold text-gray-900">{cancellation.title}</h2>
        </div>
        <dl className="grid grid-cols-1 sm:grid-cols-2">
          {(cancellation.items ?? []).map((item, at) => (
            <div key={item.label} className={at === 0 ? 'p-5' : 'border-l border-gray-100 p-5'}>
              <dt className="text-xs text-gray-400">{item.label}</dt>
              <dd className="pt-1.5">
                <span
                  className={`block text-xs ${
                    at === 0 ? 'leading-6 text-gray-700' : 'font-semibold text-gray-800'
                  }`}
                >
                  {cancelledMeetingScalar(detail, item.field)}
                </span>
                {item.descriptionField === undefined ? null : (
                  <span className="block pt-1 text-xs text-gray-500">
                    {cancelledMeetingScalar(detail, item.descriptionField)}
                  </span>
                )}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      <section
        data-node-id={NODE.replacement}
        className="flex items-center justify-between gap-4 rounded-xl border border-blue-200 bg-white p-5"
      >
        <span className="min-w-0">
          <span className="block text-xs font-bold text-gray-800">{replacement.title}</span>
          <span className="block pt-1 text-xs text-gray-500">
            {cancelledMeetingScalar(detail, replacement.descriptionField)}
          </span>
        </span>
        <button
          type="button"
          onClick={onOpenReplacement}
          className="flex shrink-0 items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 focus-visible:ring-2 focus-visible:ring-blue-600/50 focus-visible:outline-none"
        >
          {replacementAction?.label}
          <FigmaAsset
            screenId={SCREEN}
            nodeId={ASSET.openReplacement}
            className="size-3 shrink-0"
          />
        </button>
      </section>

      {notice === null ? null : (
        <p role="status" className="text-xs font-medium text-gray-500">
          {notice}
        </p>
      )}
    </div>
  )
}
