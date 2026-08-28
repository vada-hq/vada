import { useState } from 'react'
import type { ReactNode } from 'react'
import { Field } from '../components/Field'
import { FigmaAsset } from '../components/FigmaAsset'
import { TextInput } from '../components/TextInput'
import { CHOICE_CHIP } from '../design/tones'
import { readObjectSource } from '../data-sources/catalog'
import type { DataRow } from '../data-sources/catalog'
import { getOptionSource } from '../option-sources/catalog'
import type { Option } from '../option-sources/catalog'
import { resolveParams } from '../spec/params'
import { elementByNodeId, evt02b } from '../spec/screens'
import { useFieldDraft } from '../spec/useFieldDraft'
import { useSubmitAction } from '../spec/useSubmitAction'
import type {
  ButtonSpec,
  GroupSpec,
  InputSpec,
  SelectSpec,
  SubmitAction,
  SummarySpec,
} from '../spec/types'
import type { ScopeDraft } from '../state/scopes'
import { EVT02Screen } from './EVT02Screen'

// 행사 기본정보 수정(EVT-02B). 행사 개요(EVT-02) 위에 오른쪽에서 뜨는 편집 패널이다.
//
// **event.basics와 event.basicsDraft는 다른 조각이다.** 개요는 그려진 한 줄을
// 받고('납부자 무료 / 미납자 5000원') 이 패널은 고칠 칸 하나하나를 받는다
// (feeType·paidAmount·unpaidAmount). 같은 사실의 다른 모습이라 출처가 갈린다.
//
// 칸이 스물하나인데 **필수가 하나도 없다.** 같은 와이어프레임의 다른 폼은 필수를
// 별표로 그렸고(OPS-MEET-02에 13개, FIN-REQ-01에 31개) 이 패널에는 하나도 없다.
// 그래서 저장에 executeWhen을 붙이지 않는다 - 없는 별표를 지어내면 이미 저장된
// 행사를 고치러 온 사람이 자기가 지우지도 않은 칸 때문에 막힌다.
//
// **'종료 시간 미정'·'장소 미정' 체크가 옆 칸을 잠그는지는 명세가 말하지 않는다.**
// input에는 enabledWhen이 없고(select에만 있다) 디자인도 켜진 그림을 그리지
// 않았다. 그래서 화면도 잠그지 않는다 - 잠그면 명세에 없는 규칙이 코드에만 산다.
// 같은 이유로 참가비·정원의 딸린 칸도 늘 보인다: 무엇을 골랐을 때 감춰지는지를
// 말할 어휘가 없다.
//
// 초안은 화면 안이 아니라 eventBasicsDraft에 산다(명세의 stateScopeKey, 수명
// flow). 처음 열 때만 event.basicsDraft가 채우고, 한 자라도 쓰면 그 뒤로는
// 스코프가 답한다.

const SCREEN = 'EVT-02B'

const NODE = {
  head: '20:5159',
  close: '20:5164',
  infoGroup: '20:5169',
  title: '20:5172',
  intro: '20:5177',
  purpose: '20:5182',
  whenGroup: '20:5190',
  startAt: '20:5195',
  endAt: '20:5199',
  endUnset: '20:5203',
  placeGroup: '20:5214',
  place: '20:5218',
  placeUnset: '20:5223',
  address: '20:5233',
  placeDetail: '20:5236',
  joinGroup: '20:5242',
  audience: '20:5246',
  feeType: '20:5251',
  feeNote: '20:5268',
  paidAmount: '20:5270',
  unpaidAmount: '20:5275',
  payGuide: '20:5280',
  capacityType: '20:5285',
  capacity: '20:5300',
  hostGroup: '20:5308',
  hostDepartment: '20:5313',
  hostPerson: '20:5318',
  contact: '20:5323',
  notice: '20:5328',
  cancel: '20:5341',
  save: '20:5343',
} as const

const ASSET = {
  close: '20:5164',
} as const

// 칸 옆에 붙는 파란 귀띔(20:5255·20:5288·20:5331). 이 패널에만 셋이 있고, 다른
// 화면에서 다시 나오면 그때 design/tones.ts로 올릴 자리다.
const AUTO_HINT =
  'inline-block self-start rounded border border-blue-100 bg-blue-50 px-2 py-0.5 text-xs text-blue-500'

// 무엇을 골랐느냐에 따라 딸린 칸이 나오는 묶음(참가비·정원)을 두르는 테두리.
const SUB_BLOCK = 'flex flex-col gap-3 rounded-md border border-blue-100 p-3'

interface EVT02BScreenProps {
  screenParams: Record<string, string>
  /** 명세가 stateScopeKey로 말한 자리(eventBasicsDraft). 쓰던 것은 여기 남는다. */
  draft: ScopeDraft
  onChangeDraft: (next: ScopeDraft) => void
  onNavigate: (screenId: string, params?: Record<string, string>) => void
  onScopeEvent: (scopeKey: string, event: 'complete' | 'cancel') => void
}

// 읽어 온 행사를 초안으로 옮긴다(draftFrom). 조각 이름이 칸 이름과 같으면 그
// 값으로 시작한다. 이 패널에는 되풀이되는 묶음이 없어 한 겹이면 끝이다.
function draftFromRow(row: DataRow): ScopeDraft {
  const values: Record<string, string | null> = {}
  for (const [key, value] of Object.entries(row)) {
    values[key] = String(value)
  }
  return { values, labels: {} }
}

export function EVT02BScreen({
  screenParams,
  draft: scopeDraft,
  onChangeDraft,
  onNavigate,
  onScopeEvent,
}: EVT02BScreenProps) {
  const submitAction = useSubmitAction()

  // 어느 행사를 고칠지 모르면 고칠 것이 없다. 첫 행사를 대신 열지 않는다.
  const missing = (evt02b.params ?? []).filter(
    (param) => (screenParams[param.key] ?? '') === '',
  )

  // 인자가 없는데 초안을 읽으러 가면 readObjectSource가 먼저 던진다. 갈고리는
  // 조건 없이 불러야 하므로 판정을 여기 안에서 한다.
  const [seed] = useState<ScopeDraft>(() =>
    missing.length > 0
      ? { values: {}, labels: {} }
      : draftFromRow(
          readObjectSource(
            evt02b.draftFrom!.dataSourceKey,
            resolveParams(evt02b.draftFrom!.params, { screenParams }),
          ),
        ),
  )
  const draft = Object.keys(scopeDraft.values).length === 0 ? seed : scopeDraft
  const field = useFieldDraft({ elements: evt02b.elements, draft, onChangeDraft, screenParams })

  const head = elementByNodeId(evt02b, NODE.head).spec as SummarySpec
  const close = elementByNodeId(evt02b, NODE.close).spec as ButtonSpec
  const cancel = elementByNodeId(evt02b, NODE.cancel).spec as ButtonSpec
  const save = elementByNodeId(evt02b, NODE.save).spec as ButtonSpec
  const feeNote = elementByNodeId(evt02b, NODE.feeNote).spec as SummarySpec

  const inputAt = (nodeId: string) => elementByNodeId(evt02b, nodeId).spec as InputSpec
  const selectAt = (nodeId: string) => elementByNodeId(evt02b, nodeId).spec as SelectSpec
  const groupAt = (nodeId: string) => elementByNodeId(evt02b, nodeId).spec as GroupSpec

  const goBack = (spec: ButtonSpec) => () => {
    if (spec.action.type === 'navigate') {
      onNavigate(spec.action.targetScreenId, resolveParams(spec.action.params, { screenParams }))
    }
  }

  if (missing.length > 0) {
    return (
      <PanelShell screenParams={screenParams} onClose={goBack(close)}>
        <p role="alert" className="px-6 py-6 text-sm text-red-700">
          {missing.map((param) => param.missingNote).join(' ')}
        </p>
      </PanelShell>
    )
  }

  const valueOf = (fieldKey: string) => draft.values[fieldKey] ?? ''
  const setValue = (fieldKey: string, next: string) =>
    field.setFieldValue(fieldKey, next === '' ? null : next)

  // 조립 함수는 컴포넌트가 아니라 함수다. 컴포넌트로 만들면 글자를 한 자 칠 때마다
  // React가 그것을 새 유형으로 보고 칸을 갈아 끼워 포커스가 달아난다.
  function textField(nodeId: string): ReactNode {
    const spec = inputAt(nodeId)
    return (
      <Field
        htmlFor={spec.fieldKey}
        nodeId={nodeId}
        label={spec.labelHidden === true ? undefined : spec.label}
        required={spec.required}
        error={field.errors[spec.fieldKey]}
      >
        {spec.helperText === undefined ? null : (
          <span className={AUTO_HINT}>{spec.helperText}</span>
        )}
        {spec.multiline === true ? (
          <textarea
            id={spec.fieldKey}
            ref={field.registerRef(spec.fieldKey)}
            rows={3}
            value={valueOf(spec.fieldKey)}
            placeholder={spec.placeholder ?? undefined}
            onChange={(event) => setValue(spec.fieldKey, event.target.value)}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-800 placeholder:text-gray-400 focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 focus:outline-none"
          />
        ) : (
          <TextInput
            id={spec.fieldKey}
            value={valueOf(spec.fieldKey)}
            placeholder={spec.placeholder}
            type={spec.inputType}
            inputRef={field.registerRef(spec.fieldKey)}
            onChange={(next) => setValue(spec.fieldKey, next)}
          />
        )}
        {/* 라벨이 이 자리에 그려지지 않는 칸이다(labelHidden). 그래도 읽어 주는
            이름은 있어야 한다. */}
        {spec.labelHidden !== true ? null : (
          <label htmlFor={spec.fieldKey} className="sr-only">
            {spec.label}
          </label>
        )}
      </Field>
    )
  }

  // 날짜와 시각을 한 칸에서 받는다(input.inputType datetime-local). ARIA가 이름을
  // 정해 두지 않은 컨트롤이라 라벨로만 찾힌다.
  function dateTimeInput(spec: InputSpec): ReactNode {
    return (
      <input
        id={spec.fieldKey}
        type={spec.inputType}
        value={valueOf(spec.fieldKey)}
        onChange={(event) => setValue(spec.fieldKey, event.target.value)}
        className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800"
      />
    )
  }

  // 켜고 끄는 칸(input.inputType checkbox). 값은 참이냐 거짓이냐다.
  function checkField(nodeId: string): ReactNode {
    const spec = inputAt(nodeId)
    return (
      <label
        data-node-id={nodeId}
        htmlFor={spec.fieldKey}
        className="flex items-center gap-1.5 text-xs font-medium text-gray-500"
      >
        <input
          id={spec.fieldKey}
          type={spec.inputType}
          // 체크 상자의 value는 기본이 'on'이라 대조기가 그 글을 칸의 내용으로
          // 읽는다(design-check의 visibleText). 켜짐은 checked가 말한다.
          value=""
          checked={valueOf(spec.fieldKey) === 'y'}
          onChange={(event) =>
            field.setFieldValue(spec.fieldKey, event.target.checked ? 'y' : null)
          }
          className="size-3.5 shrink-0 accent-blue-600"
        />
        <span>{spec.label}</span>
      </label>
    )
  }

  // 펼친 선택지 묶음(select.presentation choiceGroup). design은 고른 것을 파랑으로
  // 채우고 나머지를 흰 칩으로 그린다 - 목록을 좁혀 보는 칩과 같은 배합이라
  // design/tones.ts의 CHOICE_CHIP을 그대로 쓴다.
  // 고른 값에 딸린 칸들은 design에서 이 칸 **안쪽**에 있다(20:5251·20:5285).
  // 형제로 두면 대조가 그 파란 테두리 상자를 등록 노드 밖에서 찾는다.
  function choiceField(nodeId: string, attached?: ReactNode): ReactNode {
    const spec = selectAt(nodeId)
    const source = getOptionSource(spec.optionsSource.key)
    const options: Option[] = source.type === 'static' ? source.options : []
    const chosen = draft.values[spec.fieldKey] ?? null
    return (
      <div data-node-id={nodeId} className="flex flex-col gap-1.5">
        <label
          id={`${spec.fieldKey}-label`}
          htmlFor={spec.fieldKey}
          className="text-xs font-medium text-gray-700"
        >
          <span>{spec.label}</span>
          {spec.required && <span className="text-red-500">*</span>}
        </label>
        {spec.helperText === undefined ? null : (
          <span className={AUTO_HINT}>{spec.helperText}</span>
        )}
        <div
          id={spec.fieldKey}
          role="radiogroup"
          aria-labelledby={`${spec.fieldKey}-label`}
          className="flex flex-wrap gap-2"
        >
          {options.map((option) => {
            const selected = option.value === chosen
            return (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={selected}
                // 아무것도 고르지 않은 상태는 design이 그리지 않았다 - 와이어프레임은
                // 늘 하나가 골라진 모습이다. 그 상태의 색은 대조하지 않는다.
                data-design-state={chosen === null ? '' : undefined}
                onClick={() => field.setFieldValue(spec.fieldKey, option.value, option.label)}
                className={`rounded border px-3 py-1.5 text-xs font-medium ${
                  selected ? CHOICE_CHIP.on : CHOICE_CHIP.off
                }`}
              >
                {option.label}
              </button>
            )
          })}
        </div>
        {attached}
      </div>
    )
  }

  function section(nodeId: string, titleClass: string, children: ReactNode): ReactNode {
    const group = groupAt(nodeId)
    const titleId = `${nodeId}-title`
    return (
      <section data-node-id={nodeId} aria-labelledby={titleId} className="flex flex-col gap-3">
        <span className="flex flex-wrap items-center gap-2">
          <h3 id={titleId} className={titleClass}>
            {group.title}
          </h3>
          {group.description === undefined ? null : (
            <span className="text-xs text-blue-500">{group.description}</span>
          )}
        </span>
        {children}
      </section>
    )
  }

  const startAt = inputAt(NODE.startAt)
  const endAt = inputAt(NODE.endAt)
  const place = inputAt(NODE.place)
  const SECTION_TITLE = 'text-xs font-semibold text-gray-700'

  return (
    <PanelShell screenParams={screenParams} onClose={goBack(close)}>
      <div className="flex items-start justify-between gap-4 border-b border-gray-100 px-6 py-4">
        <span data-node-id={NODE.head}>
          <h2 className="text-sm font-semibold text-gray-900">{head.title}</h2>
          <p className="pt-0.5 text-xs text-gray-400">{head.description}</p>
        </span>
        <button
          type="button"
          data-node-id={NODE.close}
          aria-label={close.label}
          onClick={goBack(close)}
          className="shrink-0 rounded p-1 hover:bg-gray-50"
        >
          <FigmaAsset screenId={SCREEN} nodeId={ASSET.close} className="size-3.5" />
        </button>
      </div>

      <div className="flex flex-1 flex-col gap-6 overflow-y-auto px-6 py-5">
        {/* 첫 묶음의 제목만 design이 한 급 크게, 한 단계 옅게 그렸다(11px gray-500).
            나머지 넷은 가름줄 위의 제목이라 10.5px gray-700이다. */}
        {section(
          NODE.infoGroup,
          'text-xs font-semibold text-gray-500',
          <>
            {textField(NODE.title)}
            {textField(NODE.intro)}
            {textField(NODE.purpose)}
          </>,
        )}

        {section(
          NODE.whenGroup,
          SECTION_TITLE,
          <>
            <Field
              htmlFor={startAt.fieldKey}
              nodeId={NODE.startAt}
              label={startAt.label}
              required={startAt.required}
            >
              {dateTimeInput(startAt)}
            </Field>

            {/* 종료 일시와 '종료 시간 미정'은 한 줄에 나란히 그려진다. 체크가 옆
                칸을 잠그는지는 명세가 말하지 않으므로 잠그지 않는다. */}
            <div data-node-id={NODE.endAt} className="flex flex-col gap-1.5">
              <span className="flex items-center gap-3">
                <label htmlFor={endAt.fieldKey} className="text-xs font-medium text-gray-700">
                  {endAt.label}
                </label>
                {checkField(NODE.endUnset)}
              </span>
              {dateTimeInput(endAt)}
            </div>
          </>,
        )}

        {section(
          NODE.placeGroup,
          SECTION_TITLE,
          // design은 '장소'라는 라벨 하나 아래에 칸 셋을 쌓는다. 그래서 장소 칸의
          // 등록 노드가 라벨과 칸을 함께 품고, 나머지 둘은 그 안의 등록 노드다.
          <div data-node-id={NODE.place} className="flex flex-col gap-1.5">
            <span className="flex items-center gap-3">
              <label htmlFor={place.fieldKey} className="text-xs font-medium text-gray-700">
                {place.label}
              </label>
              {checkField(NODE.placeUnset)}
            </span>
            <TextInput
              id={place.fieldKey}
              value={valueOf(place.fieldKey)}
              placeholder={place.placeholder}
              type={place.inputType}
              onChange={(next) => setValue(place.fieldKey, next)}
            />
            {textField(NODE.address)}
            {textField(NODE.placeDetail)}
          </div>,
        )}

        {section(
          NODE.joinGroup,
          SECTION_TITLE,
          <>
            {textField(NODE.audience)}

            {choiceField(
              NODE.feeType,
              <div className={SUB_BLOCK}>
                <p
                  data-node-id={NODE.feeNote}
                  className="rounded border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-blue-700"
                >
                  {feeNote.title}
                </p>
                {textField(NODE.paidAmount)}
                {textField(NODE.unpaidAmount)}
                {textField(NODE.payGuide)}
              </div>,
            )}

            {choiceField(
              NODE.capacityType,
              <div className={SUB_BLOCK}>{textField(NODE.capacity)}</div>,
            )}
          </>,
        )}

        {section(
          NODE.hostGroup,
          SECTION_TITLE,
          <>
            {textField(NODE.hostDepartment)}
            {textField(NODE.hostPerson)}
            {textField(NODE.contact)}
            {textField(NODE.notice)}
          </>,
        )}
      </div>

      <div className="flex items-center justify-between gap-4 border-t border-gray-100 px-6 py-4">
        <p className="text-xs text-gray-400">{evt02b.meta?.footerNote}</p>
        <span className="flex shrink-0 gap-2">
          <button
            type="button"
            data-node-id={NODE.cancel}
            onClick={goBack(cancel)}
            className="rounded border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
          >
            {cancel.label}
          </button>
          <button
            type="button"
            data-node-id={NODE.save}
            onClick={() =>
              // 막는 조건은 명세에 있다. 이 화면에는 필수가 없어 executeWhen이
              // 없지만, 판정은 그래도 한 곳에서만 돈다.
              field.runButton(save, () => {
                void submitAction.run(save.action as SubmitAction, {
                  payload: draft.values,
                  onNavigate,
                  // 무엇을 넘길지는 명세가 말한다(onSuccess.params). 화면은 그
                  // 값이 어디 있는지만 알려 준다.
                  paramSources: { screenParams },
                  onScopeEvent,
                })
              })
            }
            className="rounded bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
          >
            {submitAction.labelOf(save.action as SubmitAction, save.label)}
          </button>
        </span>
      </div>

      {submitAction.errorMessage === null ? null : (
        <p role="alert" className="px-6 pb-4 text-xs text-red-500">
          {submitAction.errorMessage}
        </p>
      )}
    </PanelShell>
  )
}

interface PanelShellProps {
  screenParams: Record<string, string>
  onClose: () => void
  children: ReactNode
}

// 뒤에 남아 있는 화면과 그 위의 패널. 명세가 overlay로 말한 두 가지다 -
// 어느 화면이 남는가(screenId)와 이 화면이 그리는 부분이 어디인가(source).
function PanelShell({ screenParams, onClose, children }: PanelShellProps) {
  return (
    <>
      <div aria-hidden className="pointer-events-none">
        <EVT02Screen screenParams={screenParams} onNavigate={() => undefined} />
      </div>

      <div className="fixed inset-0 z-50 flex justify-end bg-black/20" onClick={onClose}>
        <div
          role="dialog"
          aria-modal="true"
          aria-label={evt02b.meta?.title ?? evt02b.screenId}
          onClick={(event) => event.stopPropagation()}
          className="flex h-full w-full max-w-[440px] flex-col border-l border-gray-200 bg-white shadow-2xl"
        >
          {children}
        </div>
      </div>
    </>
  )
}
