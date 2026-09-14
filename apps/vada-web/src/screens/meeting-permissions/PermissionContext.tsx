import { FigmaAsset } from '../../components/FigmaAsset'
import { BANNER_TEXT, BANNER_TONE } from '../../design/tones'
import { MeetingStateChip } from '../meeting-shared/MeetingStateChip'
import type { MeetingPermissionView } from './data'
import { ASSET, NODE, SCREEN, scalar } from './spec'

/** 이 회의의 진행 권한 범위와 변경할 수 없는 생성자를 표시한다. */
export function PermissionContext({ view }: { view: MeetingPermissionView }) {
  const { notice, ownerHeading, owner } = view.specs
  const ownerChipsValue = view.ownerRow[owner.statusField ?? '']
  const ownerChips = Array.isArray(ownerChipsValue) ? ownerChipsValue : []

  return (
    <>
      <section
        data-node-id={NODE.notice}
        data-design-rule="state-banner"
        className={`flex items-start gap-3 rounded-xl border px-5 py-4 ${BANNER_TONE.blue}`}
      >
        <FigmaAsset screenId={SCREEN} nodeId={ASSET.notice} className="mt-0.5 size-4" />
        <span className="min-w-0">
          <span className={`block text-xs font-bold ${BANNER_TEXT.blue.title}`}>
            {scalar(view.permission, notice.titleField)}
          </span>
          <span className={`block pt-1 text-xs font-normal ${BANNER_TEXT.blue.note}`}>
            <span>{scalar(view.permission, notice.descriptionField)}</span>{' '}
            <span>{scalar(view.permission, (notice.items ?? [])[0]?.field)}</span>
          </span>
        </span>
      </section>

      <section className="rounded-xl border border-gray-200 bg-white px-5 py-4">
        <p data-node-id={NODE.ownerHeading} className="text-xs font-semibold text-gray-400">
          {ownerHeading.title}
        </p>
        <div
          data-node-id={NODE.owner}
          className="mt-3 flex items-center gap-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3"
        >
          <FigmaAsset screenId={SCREEN} nodeId={ASSET.ownerAvatar} className="size-8 shrink-0" />
          <span className="min-w-0 flex-1">
            <span className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-bold text-gray-900">
                {scalar(view.ownerRow, owner.titleField)}
              </span>
              {ownerChips.map((chip) => (
                <MeetingStateChip
                  key={String(chip.label)}
                  label={String(chip.label)}
                  tone={String(chip.tone)}
                />
              ))}
            </span>
            <span className="block pt-1 text-xs text-gray-500">
              {scalar(view.ownerRow, owner.descriptionField)}
            </span>
          </span>
          <span className="shrink-0 text-xs text-gray-400">
            {scalar(view.ownerRow, (owner.items ?? [])[0]?.field)}
          </span>
        </div>
      </section>
    </>
  )
}
