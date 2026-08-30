import { useState } from 'react'
import { AppShell } from '../components/AppShell'
import { Breadcrumbs } from '../components/Breadcrumbs'
import { FigmaAsset } from '../components/FigmaAsset'
import { BANNER_TEXT, BANNER_TONE, NEUTRAL_CHIP, STATE_CHIP } from '../design/tones'
import { findDataSource, readListSource, readObjectSourceOrNull } from '../data-sources/catalog'
import type { DataRow } from '../data-sources/catalog'
import { resolveParams } from '../spec/params'
import { PendingBox } from '../components/PendingBox'
import { elementByNodeId, opsMeet04b } from '../spec/screens'
import type {
  ButtonSpec,
  InputSpec,
  ItemListSpec,
  PendingSpec,
  SummarySpec,
} from '../spec/types'

// 회의 진행 권한 관리(OPS-MEET-04B).
//
// **모달이 아니라 화면이다.** D03(부여 확인)이 이 화면 **위에** 뜨기 때문이다 —
// 모달이면 모달 위 모달이 된다. 제 빵부스러기를 4단으로 갖는 것도 같은 사실을
// 말한다(docs/decisions/meeting-model.md). 이름의 'B'는 변형이 아니라 '권한 있는
// 쪽'을 뜻하는 이 계열의 이름 관행이다.
//
// **역할 이름도 줄 단추의 글도 이 파일에 없다.** '진행 권한'도 '진행 권한 부여'도
// '권한 해제'도 서버가 글과 색 이름을 함께 준다(meeting.participants의 chips ·
// actionLabel · actionEmphasis). 권한이 무엇을 주고 무엇을 안 주는지도 마찬가지다
// (meeting.permissionNotice) — 권한이 하나 늘 때 화면이 조용히 틀리지 않는 유일한
// 모양이다.
//
// **인원 수도 세지 않는다.** 부제는 '진행 권한자 2명 · 일반 참가자 3명'인데 목록은
// 다섯 줄이고 그 위에 생성자가 또 있다 — 그림이 스스로 어긋나 있다. 수를 화면이
// 세면 둘 중 하나는 반드시 틀리므로 서버가 완성한 문구를 그대로 그린다.
//
// 아직 답이 없는 자리 둘을 지어내지 않고 남긴다.
// · 줄 오른쪽 단추: 주는 쪽은 D03을 거치는데 그 화면이 아직 없고, 빼는 쪽은
//   확인 모달이 아예 그려져 있지 않다(명세의 itemAction이 pending인 까닭).
// · 20:803의 라벨 없는 빈 드롭다운(140×20, 자식 0): 무엇을 거르는지 그림이
//   답하지 않아 명세에도 화면에도 없다.

const SCREEN = 'OPS-MEET-04B'

// screens.ts는 다른 작업이 함께 쓰는 파일이라 여기서 읽어 둔다. 그쪽에
// opsMeet04b가 등록되면 이 두 줄을 지우고 `import { opsMeet04b }`로 바꾼다.

const NODE = {
  done: '20:747',
  notice: '20:754',
  ownerHeading: '20:766',
  owner: '20:769',
  peopleHeader: '20:788',
  query: '20:801',
  filter: '20:803',
  people: '20:804',
} as const

// 어느 자리에 어떤 그림이 오는지는 명세가 아니라 design이 갖는다. 되풀이되는
// 자리는 첫 것의 nodeId를 본으로 쓴다 — 같은 그림이면 하나만 그려도 대조가 붙는다.
const ASSET = {
  doneCheck: '20:748',
  notice: '20:755',
  ownerAvatar: '20:770',
  search: '20:798',
  personAvatar: '20:806',
} as const

// 경로 조각 사이의 화살표. 조각보다 하나 적다.
const BREADCRUMB_SEPARATORS = ['20:731', '20:736', '20:741']

interface OPSMEET04BScreenProps {
  screenParams: Record<string, string>
  onNavigate: (screenId: string, params?: Record<string, string>) => void
}

function summaryAt(nodeId: string): SummarySpec {
  return elementByNodeId(opsMeet04b, nodeId).spec as SummarySpec
}

function scalar(row: DataRow, field: string | undefined): string {
  const value = field === undefined ? undefined : row[field]
  if (value === undefined || Array.isArray(value)) {
    throw new Error(`OPS-MEET-04B의 '${field}' 조각은 한 줄의 값이어야 합니다.`)
  }
  return String(value)
}

// 딱지 하나. 글도 색 이름도 데이터가 준다 — 명세는 어느 조각인지만 안다.
// 와이어프레임은 한 상태만 그리므로 색은 대조에서 뺀다(data-design-state).
function Chip({ label, tone }: { label: string; tone: string }) {
  if (label === '') {
    return null
  }
  return (
    <span
      data-design-state
      data-design-rule="state-chip"
      className={`rounded px-2 py-0.5 text-xs font-medium ${STATE_CHIP[tone] ?? NEUTRAL_CHIP}`}
    >
      {label}
    </span>
  )
}

export function OPSMEET04BScreen({ screenParams, onNavigate }: OPSMEET04BScreenProps) {
  const done = elementByNodeId(opsMeet04b, NODE.done).spec as ButtonSpec
  const notice = summaryAt(NODE.notice)
  const ownerHeading = summaryAt(NODE.ownerHeading)
  const owner = summaryAt(NODE.owner)
  const peopleHeader = summaryAt(NODE.peopleHeader)
  const query = elementByNodeId(opsMeet04b, NODE.query).spec as InputSpec
  const filter = elementByNodeId(opsMeet04b, NODE.filter).spec as PendingSpec
  const people = elementByNodeId(opsMeet04b, NODE.people).spec as ItemListSpec

  const [queryValue, setQueryValue] = useState(query.initialValue ?? '')
  const [note, setNote] = useState<string | null>(null)

  const meta = opsMeet04b.meta
  if (meta === undefined) {
    throw new Error('OPS-MEET-04B의 화면 카피가 없습니다.')
  }

  // 어느 회의의 권한인지 모르면 이 화면이 없다. 진행 권한은 그 회의에만 적용되므로
  // 인자가 비었을 때 아무 회의나 집어 오면 남의 회의 권한을 바꾸게 된다.
  const missingParam = (opsMeet04b.params ?? []).find(
    (param) => param.optional !== true && (screenParams[param.key] ?? '') === '',
  )
  // 빵부스러기와 생성자 칸이 서로 다른 출처를 읽는다 — 회의 이름은 회의가 알고,
  // 생성자의 자리와 딱지는 그 사람의 것이다.
  const crumb = opsMeet04b.breadcrumb
  const meeting =
    missingParam === undefined && crumb !== undefined
      ? readObjectSourceOrNull(crumb.dataSourceKey, resolveParams(crumb.params, { screenParams }))
      : null
  const ownerRow =
    missingParam === undefined
      ? readObjectSourceOrNull(owner.dataSourceKey, resolveParams(owner.params, { screenParams }))
      : null
  const permission =
    missingParam === undefined
      ? readObjectSourceOrNull(
          notice.dataSourceKey,
          resolveParams(notice.params, { screenParams }),
        )
      : null

  if (missingParam !== undefined || meeting === null || ownerRow === null || permission === null) {
    return (
      <AppShell
        screenId={opsMeet04b.screenId}
        activeNavigationScreenId={opsMeet04b.activeNavigationScreenId}
        eyebrow={meta.eyebrow}
        title={meta.title}
        description={meta.description}
        footerNote={meta.footerNote}
        onNavigate={onNavigate}
      >
        <p role="alert" className="text-sm text-red-700">
          {missingParam !== undefined
            ? missingParam.missingNote
            : findDataSource(owner.dataSourceKey).messages.empty}
        </p>
      </AppShell>
    )
  }

  const rows = readListSource(
    people.dataSourceKey,
    resolveParams(people.params, { screenParams, fields: { [query.fieldKey]: queryValue } }),
  )

  // 딱지 개수는 데이터가 정한다 - 생성자는 둘이고 다른 사람은 없을 수 있다.
  const ownerChipsValue = ownerRow[owner.statusField ?? '']
  const ownerChips: DataRow[] = Array.isArray(ownerChipsValue) ? ownerChipsValue : []

  const breadcrumb = opsMeet04b.breadcrumb
  const personField = (at: number) => people.columns?.[at]?.fields?.[0]
  // 딱지는 한 조각 안에 여럿으로 온다. 없으면 오지 않으므로 빈 목록으로 읽는다.
  const chipsOf = (person: DataRow): DataRow[] => {
    const value = person[personField(1) ?? '']
    return Array.isArray(value) ? value : []
  }

  return (
    <AppShell
      screenId={opsMeet04b.screenId}
      activeNavigationScreenId={opsMeet04b.activeNavigationScreenId}
      eyebrow={meta.eyebrow}
      title={meta.title}
      description={meta.description}
      footerNote={meta.footerNote}
      breadcrumb={
        breadcrumb === undefined ? undefined : (
          <Breadcrumbs
            nodeId={breadcrumb.source}
            screenId={SCREEN}
            separatorNodeIds={BREADCRUMB_SEPARATORS}
            items={breadcrumb.items.map((item) =>
              item.field === undefined ? (item.value ?? '') : scalar(meeting, item.field),
            )}
          />
        )
      }
      // 다 하고 나가는 문. 권한은 줄마다 그 자리에서 바뀌므로 여기서 보낼 것이
      // 없다 — 되돌아갈 뿐이고, 어느 회의로 돌아갈지는 받은 인자가 안다.
      headerAction={
        <button
          type="button"
          data-node-id={NODE.done}
          onClick={() => {
            if (done.action.type === 'navigate') {
              onNavigate(
                done.action.targetScreenId,
                resolveParams(done.action.params, { screenParams }),
              )
            }
          }}
          className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 focus-visible:ring-2 focus-visible:ring-blue-600/50 focus-visible:outline-none"
        >
          <FigmaAsset screenId={SCREEN} nodeId={ASSET.doneCheck} className="size-3.5" />
          {done.label}
        </button>
      }
      onNavigate={onNavigate}
    >
      <div className="mx-auto flex w-full max-w-[1000px] flex-col gap-4 pb-8">
        {/* 이 회의에만 적용되는 권한이라는 것, 그리고 그 권한이 무엇을 주고 무엇을
            안 주는지. 둘 다 서버가 완성해 준다 — 권한이 하나 늘면 이 글이 바뀌는데
            명세가 들고 있으면 그때마다 명세가 틀린다. design은 두 문장을 한
            문단으로 그렸으므로 잇는 자리도 한 곳이다. */}
        <section
          data-node-id={NODE.notice}
          data-design-rule="state-banner"
          className={`flex items-start gap-3 rounded-xl border px-5 py-4 ${BANNER_TONE.blue}`}
        >
          <FigmaAsset screenId={SCREEN} nodeId={ASSET.notice} className="mt-0.5 size-4" />
          <span className="min-w-0">
            <span className={`block text-xs font-bold ${BANNER_TEXT.blue.title}`}>
              {scalar(permission, notice.titleField)}
            </span>
            <span className={`block pt-1 text-xs font-normal ${BANNER_TEXT.blue.note}`}>
              <span>{scalar(permission, notice.descriptionField)}</span>{' '}
              <span>{scalar(permission, (notice.items ?? [])[0]?.field)}</span>
            </span>
          </span>
        </section>

        <section className="rounded-xl border border-gray-200 bg-white px-5 py-4">
          <p
            data-node-id={NODE.ownerHeading}
            className="text-xs font-semibold text-gray-400"
          >
            {ownerHeading.title}
          </p>
          {/* 생성자 한 사람. 그림은 이름·딱지 둘·이 회의에서의 자리·'필수 권한자'를
              나눠 그렸는데, 카탈로그가 생성자를 한 건으로 집어 줄 출처를 아직 갖고
              있지 않다 — meeting.participants의 한 줄이지만 요약은 목록에서 한 줄을
              집을 수 없다. 지어내는 대신 회의가 아는 것(creatorNote)만 그린다. */}
          {/* 회의를 만든 사람. 목록의 같은 사람과 값이 다르다 - 여기서는 '권한 변경
              및 회의 관리 가능'이고 03A에서는 '시작·종료 가능'이다. 그래서 목록의
              한 줄이 아니라 제 출처(meeting.hostOwner)를 읽는다.
              딱지 개수는 데이터가 정한다(statusField) - 생성자는 둘이고 다른
              사람은 없을 수 있다. */}
          <div
            data-node-id={NODE.owner}
            className="mt-3 flex items-center gap-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3"
          >
            <FigmaAsset screenId={SCREEN} nodeId={ASSET.ownerAvatar} className="size-8 shrink-0" />
            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-bold text-gray-900">
                  {scalar(ownerRow, owner.titleField)}
                </span>
                {ownerChips.map((chip) => (
                  <Chip
                    key={String(chip.label)}
                    label={String(chip.label)}
                    tone={String(chip.tone)}
                  />
                ))}
              </span>
              <span className="block pt-1 text-xs text-gray-500">
                {scalar(ownerRow, owner.descriptionField)}
              </span>
            </span>
            <span className="shrink-0 text-xs text-gray-400">
              {scalar(ownerRow, (owner.items ?? [])[0]?.field)}
            </span>
          </div>
        </section>

        <section className="rounded-xl border border-gray-200 bg-white">
          <div
            data-node-id={NODE.peopleHeader}
            className="flex items-start justify-between gap-4 px-5 pt-4"
          >
            <span className="min-w-0">
              <span className="block text-sm font-bold text-gray-900">{peopleHeader.title}</span>
              {/* 몇 명인지는 서버가 완성해 온다. 화면이 목록을 세면 그림의 어긋남을
                  그대로 옮기거나 검색으로 줄어든 수를 전체인 양 말하게 된다. */}
              <span className="block pt-1 text-xs font-normal text-gray-400">
                {scalar(permission, (peopleHeader.items ?? [])[0]?.field)}
              </span>
            </span>
            <span className="shrink-0">
              {(peopleHeader.status ?? []).map((badge) => (
                <Chip
                  key={badge.field}
                  label={scalar(permission, badge.field)}
                  tone={scalar(permission, badge.toneField)}
                />
              ))}
            </span>
          </div>

          {/* 거르는 줄. 검색어가 바뀌면 받아온 것을 화면에서 거르지 않고 다시
              조회한다(명세의 params.query). 곁의 빈 드롭다운(20:803)은 무엇을
              거르는지 그림이 답하지 않아 명세에 넣지 않았다. */}
          <div className="px-5 py-4">
            <label
              data-node-id={NODE.query}
              className="flex items-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-2"
            >
              <FigmaAsset screenId={SCREEN} nodeId={ASSET.search} className="size-3.5 shrink-0" />
              <input
                aria-label={query.label}
                type={query.inputType}
                value={queryValue}
                placeholder={query.placeholder ?? query.label}
                onChange={(event) => {
                  setQueryValue(event.target.value)
                }}
                className="min-w-0 flex-1 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none"
              />
            </label>

            {/* 그림이 검색칸 옆에 거르개를 그렸는데 안이 비어 있다. */}
            <PendingBox
              nodeId={NODE.filter}
              spec={filter}
              className="h-9 w-28 shrink-0 rounded-[5px] border border-gray-300 bg-white"
            />
          </div>

          <ul data-node-id={NODE.people} className="border-t border-gray-100">
            {rows.length === 0 ? (
              <li className="px-5 py-4 text-xs font-normal text-gray-400">
                {findDataSource(people.dataSourceKey).messages.empty}
              </li>
            ) : (
              rows.map((person, at) => (
                <li
                  key={String(person.memberId)}
                  className={`flex items-center gap-3 px-5 py-3 ${
                    at === rows.length - 1 ? '' : 'border-b border-gray-100'
                  }`}
                >
                  <FigmaAsset
                    screenId={SCREEN}
                    nodeId={ASSET.personAvatar}
                    className="size-8 shrink-0"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-bold text-gray-800">
                        {scalar(person, personField(0))}
                      </span>
                      {/* 한 사람에 딱지가 여럿일 수 있다. 개수도 글도 색도 데이터가 준다. */}
                      {chipsOf(person).map((one, index) => (
                        <Chip
                          key={`${String(person.memberId)}-${index}`}
                          label={String(one.label ?? '')}
                          tone={String(one.tone ?? '')}
                        />
                      ))}
                    </span>
                    {/* 04B는 소속과 이 회의에서의 자리를 한 덩이로 그린다
                        (departmentNote). 03 계열이 쓰는 department와 다른 조각이다. */}
                    <span className="block pt-0.5 text-xs font-normal text-gray-400">
                      {scalar(person, personField(2))}
                    </span>
                  </span>
                  <RowAction person={person} spec={people} onNote={setNote} />
                </li>
              ))
            )}
          </ul>

          {note === null ? null : (
            <p role="status" className="px-5 pb-4 text-xs font-medium text-gray-500">
              {note}
            </p>
          )}
        </section>
      </div>
    </AppShell>
  )
}

interface RowActionProps {
  person: DataRow
  spec: ItemListSpec
  onNote: (note: string) => void
}

// 줄 오른쪽의 단추. **글도 강조도도 데이터가 준다** — 같은 자리가 줄에 따라 주는
// 쪽이 되기도 빼는 쪽이 되기도 하고, 생성자처럼 단추가 아예 없는 줄도 있다.
// 명세가 '진행 권한 부여'라고 적어 두면 역할이 하나 늘 때 그 글이 거짓이 된다.
function RowAction({ person, spec, onNote }: RowActionProps) {
  const action = spec.itemAction
  if (action === undefined) {
    return null
  }
  const label = action.labelField === undefined ? action.label : String(person[action.labelField] ?? '')
  if (label === undefined || label === '') {
    return null
  }
  const emphasis =
    action.emphasisField === undefined
      ? 'secondary'
      : String(person[action.emphasisField] ?? 'secondary')

  return (
    <button
      type="button"
      onClick={() => {
        if (action.type === 'pending') {
          onNote(action.note)
        }
      }}
      className={`shrink-0 rounded-md px-3 py-1.5 text-xs font-medium focus-visible:ring-2 focus-visible:ring-blue-600/50 focus-visible:outline-none ${
        emphasis === 'primary'
          ? 'bg-blue-600 text-white hover:bg-blue-700'
          : 'border border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
      }`}
    >
      {label}
    </button>
  )
}
