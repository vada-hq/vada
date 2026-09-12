import { FigmaAsset } from '../../components/FigmaAsset'
import { TextInput } from '../../components/TextInput'
import { STATE_CHIP } from '../../design/tones'
import { computeNumber, formatComputed, itemKey, rowIdsOf } from '../../spec/compute'
import type { GroupSpec, InputSpec, ListSpec, SummarySpec } from '../../spec/types'
import type { ScopeDraft } from '../../state/scopes'
import { decodeChips } from './meeting-draft'
import { MeetingSectionHeading } from './MeetingSection'
import { ASSET, NODE, SCREEN, specOf } from './meeting-spec'

interface MeetingParticipantsProps {
  draft: ScopeDraft
  onChangeValue: (key: string, value: string, label?: string) => void
  onAdd: () => void
  onRemove: (rowId: string) => void
  onNote: (message: string) => void
}

export function MeetingParticipants({
  draft,
  onChangeValue,
  onAdd,
  onRemove,
  onNote,
}: MeetingParticipantsProps) {
  const participantList = specOf(NODE.participants) as ListSpec
  const participantRowIds = rowIdsOf(draft, participantList.fieldKey)
  const countSpec = specOf(NODE.selectedCount) as SummarySpec
  const countItem = countSpec.items![0]
  const valueOf = (key: string) => draft.values[key] ?? ''
  const isPrivateSpec = specOf(NODE.isPrivate) as InputSpec
  const memberQuerySpec = specOf(NODE.memberQuery) as InputSpec
  const hostRoleNote = specOf(NODE.hostRoleNote) as SummarySpec
  const minutesNote = specOf(NODE.minutesNote) as SummarySpec

  function participantRow(rowId: string) {
    const at = (field: string) => valueOf(itemKey(participantList.fieldKey, rowId, field))
    const chips = decodeChips(at('chips'))
    const actionLabel = at('actionLabel')
    const actionEmphasis = at('actionEmphasis')
    return (
      <div
        key={rowId}
        className="flex items-center gap-3 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5"
      >
        <FigmaAsset screenId={SCREEN} nodeId={ASSET.avatar} className="size-7 shrink-0" />
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-1.5">
            <span className="text-sm font-semibold text-gray-800">{at('name')}</span>
            {chips.map((chip) => (
              <span
                key={chip.label}
                className={`rounded px-1.5 py-0.5 text-xs font-medium ${
                  STATE_CHIP[chip.tone] ?? STATE_CHIP.gray
                }`}
              >
                {chip.label}
              </span>
            ))}
          </span>
          <span className="block pt-0.5 text-xs text-gray-400">{at('departmentNote')}</span>
        </span>
        {/* 줄 단추의 글은 줄마다 갈린다 - 명세가 들지 않고 데이터가 준다. */}
        {actionLabel === '' ? null : (
          <button
            type="button"
            onClick={() => onNote(`'${actionLabel}'가 무엇을 보내는지 디자인에 없습니다.`)}
            className={`shrink-0 text-xs font-medium ${
              actionEmphasis === 'danger' ? 'text-red-500' : 'text-blue-600'
            }`}
          >
            {actionLabel}
          </button>
        )}
        {at('canRemove') !== 'true' ? null : (
          <button
            type="button"
            aria-label={`${at('name')} ${participantList.itemNoun}에서 빼기`}
            onClick={() => onRemove(rowId)}
            className="shrink-0"
          >
            <FigmaAsset screenId={SCREEN} nodeId={ASSET.removeRow} className="size-3.5" />
          </button>
        )}
      </div>
    )
  }

  return (
    <section
      data-node-id={NODE.peopleGroup}
      aria-label={(specOf(NODE.peopleGroup) as GroupSpec).title}
      className="rounded-xl border border-gray-200 bg-white p-5"
    >
      <div className="flex items-start justify-between gap-4">
        <MeetingSectionHeading nodeId={NODE.peopleGroup} step={4} />
        {/* 몇 명인지는 명세가 모른다 - 세는 것은 화면의 셈이다. */}
        <span data-node-id={NODE.selectedCount} className="text-xs font-medium text-gray-500">
          {countItem.label} {formatComputed(computeNumber(countItem.compute!, { draft }))}
          {countItem.unit}
        </span>
      </div>

      <div className="flex flex-col gap-4 pt-5">
        {/* 비공개 회의(input.inputType checkbox). 목록에서 고르는 것이 아니라
            켜고 끄는 것이다. */}
        <div
          data-node-id={NODE.isPrivate}
          className="flex items-center justify-between gap-4 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3"
        >
          <span>
            <label
              htmlFor={isPrivateSpec.fieldKey}
              className="block text-xs font-semibold text-gray-800"
            >
              {isPrivateSpec.label}
            </label>
            <span className="block pt-0.5 text-xs text-gray-500">
              {isPrivateSpec.helperText}
            </span>
          </span>
          <input
            id={isPrivateSpec.fieldKey}
            type={isPrivateSpec.inputType}
            // 체크 상자의 value는 기본이 'on'이라 대조기가 그 글을 칸의 내용으로
            // 읽는다(design-check의 visibleText). 켜짐은 checked가 말한다.
            value=""
            checked={valueOf(isPrivateSpec.fieldKey) === 'y'}
            onChange={(event) =>
              onChangeValue(isPrivateSpec.fieldKey, event.target.checked ? 'y' : '')
            }
            className="size-5 shrink-0 accent-blue-600"
          />
        </div>

        <div className="flex items-center gap-3">
          {/* design은 돋보기를 칸 안에 겹쳐 그린다(18:2489가 Text Input 위에
              놓인다). 겹치면 안내 문구가 가려지므로 칸의 왼쪽 여백만 늘린다. */}
          <span className="relative min-w-0 flex-1 [&_input]:pl-9">
            <FigmaAsset
              screenId={SCREEN}
              nodeId={ASSET.search}
              className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2"
            />
            <span data-node-id={NODE.memberQuery} className="block">
              <TextInput
                id={memberQuerySpec.fieldKey}
                value={valueOf(memberQuerySpec.fieldKey)}
                placeholder={memberQuerySpec.placeholder}
                type={memberQuerySpec.inputType}
                onChange={(next) => onChangeValue(memberQuerySpec.fieldKey, next)}
              />
            </span>
            {/* 라벨이 그려지지 않는 칸이다(labelHidden). 그래도 읽어 주는 이름은 있다. */}
            <label htmlFor={memberQuerySpec.fieldKey} className="sr-only">
              {memberQuerySpec.label}
            </label>
          </span>
          <button
            type="button"
            onClick={onAdd}
            disabled={participantRowIds.length >= participantList.maxItems}
            className="flex shrink-0 items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 enabled:hover:bg-gray-50 disabled:text-gray-400"
          >
            <FigmaAsset screenId={SCREEN} nodeId={ASSET.addMember} className="size-3.5" />
            {participantList.addLabel}
          </button>
        </div>

        {/* 줄에 무엇이 그려지는지는 명세가 말하지 않는다(itemFields가 없다).
            이름·소속·딱지·단추 글은 전부 meeting.draft가 준다. */}
        <div data-node-id={NODE.participants} className="grid grid-cols-2 gap-3">
          {participantRowIds.map(participantRow)}
        </div>

        <p
          data-node-id={NODE.hostRoleNote}
          className="flex items-start gap-2 rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-xs text-blue-700"
        >
          <FigmaAsset
            screenId={SCREEN}
            nodeId={ASSET.hostRoleNote}
            className="mt-0.5 size-3.5 shrink-0"
          />
          <span>{hostRoleNote.title}</span>
        </p>
        <p data-node-id={NODE.minutesNote} className="text-xs text-gray-400">
          {minutesNote.title}
        </p>
      </div>
    </section>
  )
}
