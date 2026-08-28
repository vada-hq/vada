import type { ReactNode } from 'react'
import shellJson from '../../../../specs/figma/vada-wireframe/shell.json'
import { FigmaAsset } from '../components/FigmaAsset'
import { Field } from '../components/Field'
import { MobileScreen } from '../components/MobileScreen'
import { SearchSelect } from '../components/SearchSelect'
import { TextInput } from '../components/TextInput'
import { findDataSource, readObjectSourceOrNull } from '../data-sources/catalog'
import { resolveParams } from '../spec/params'
import { drawnTitleOf, elementByNodeId, ext02a } from '../spec/screens'
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

// 참여 신청 폼(EXT-02A). **링크로 온 사람이 보는 화면이고 로그인한 사람이 없다.**
//
// 그래서 학생회 안쪽의 출처를 하나도 쓰지 않는다. 안쪽 짝인 EVT-05가 eventId로
// 설문을 관리하는 동안, 이쪽이 가진 것은 링크가 실어 온 **설문 토큰**뿐이다 —
// 설문은 갈아 끼울 수 있으므로(EVT-05B) 링크가 가리키는 것은 설문이지 행사가
// 아니고, eventId를 인자로 두면 아무나 남의 행사의 신청 폼을 연다.
//
// **링크가 상태에 따라 갈리는 것은 서버가 한다**(docs/decisions/product-decisions.md).
// 모집 전·마감·정원 참·비활성·교체됨이면 서버가 EXT-02C로 보낸다. 이 화면은 자기가
// 무엇인지만 알면 되므로 갈림을 담은 어휘가 하나도 없다.
//
// 그릇은 MobileScreen이다. 이 다섯 장만 390 폭이라 PageCard를 넓혀 쓸 수 없었다
// (components/MobileScreen.tsx에 다섯 가지 어긋남이 적혀 있다).
//
// **머리의 'Vada'를 화면이 적지 않는다.** 그 글은 shell.json의 brand.name이고,
// 여기 옮겨 적으면 두 벌이 되어 이름이 바뀌는 날 한쪽만 바뀐다. 셸을 그리지는
// 않는다(viewer: external) — 빌려 오는 것은 이름 하나뿐이다.
//
// 아래 두 자리는 **지금 어휘로 말할 수 없어서 그렇게 그린 것**이다. 보고서에
// 적었고 코드에서 메우지 않았다.
//
// · 동의 체크는 required지만 **'반드시 켜야 한다'는 뜻이 아니다.** input.required는
//   '이 칸에 값이 있는가'만 묻고, 계약은 boolean false도 값으로 못 박아 두었다
//   (tests/button-execution.test.mjs). 여기서 실제로 막히는 것은 이 저장소의 모든
//   체크 칸이 꺼짐을 null로 담기 때문이지(EVT-02B·EVT-05와 같은 규칙) 명세가 그렇게
//   말했기 때문이 아니다.
// · 필수 별표는 체크 칸이 아니라 **그 위 제목**에 붙어 있다. 그림이 그렇게 그렸다.
//   그래서 별표를 제목 쪽에 그리고, 무엇이 그것을 말했는지는 멤버의 required가 안다.

const SCREEN = 'EXT-02A'

const BRAND = (shellJson as { brand: { name: string } }).brand.name

const NODE = {
  schedule: '30:7147',
  fee: '30:7173',
  name: '30:7179',
  studentNumber: '30:7184',
  college: '30:7189',
  department: '30:7196',
  currentGrade: '30:7203',
  motivation: '30:7210',
  consent: '30:7215',
  consentCheck: '30:7220',
  submit: '30:7228',
} as const

// 머리 세 줄의 아이콘. **어느 조각에 어느 그림이 붙는지는 명세가 아니라 그림이
// 안다** — summary.items는 무엇을 그리는지까지이고, 그 옆에 달력을 둘지 핀을 둘지는
// 시각이다. 그래서 items의 순서대로 여기서 짝지운다.
const ROW_ASSET = ['30:7149', '30:7158', '30:7165'] as const

// 드롭다운의 화살표가 그림으로 뽑혀 있다(FIN-REQ-01과 같은 자리). 뽑힌 화면에서는
// 그 그림을 그려야 자산 대조가 맞는다.
const CHEVRON = {
  college: '30:7194',
  department: '30:7201',
  currentGrade: '30:7208',
} as const

interface EXT02AScreenProps {
  screenParams: Record<string, string>
  /** 명세가 stateScopeKey로 말한 자리(surveyApplyDraft). 쓰던 것은 여기 남는다. */
  draft: ScopeDraft
  onChangeDraft: (next: ScopeDraft) => void
  onNavigate: (screenId: string, params?: Record<string, string>) => void
  onScopeEvent: (scopeKey: string, event: 'complete' | 'cancel') => void
}

export function EXT02AScreen({
  screenParams,
  draft,
  onChangeDraft,
  onNavigate,
  onScopeEvent,
}: EXT02AScreenProps) {
  const submitAction = useSubmitAction()
  const field = useFieldDraft({ elements: ext02a.elements, draft, onChangeDraft, screenParams })

  const schedule = elementByNodeId(ext02a, NODE.schedule).spec as SummarySpec
  const fee = elementByNodeId(ext02a, NODE.fee).spec as SummarySpec
  const consent = elementByNodeId(ext02a, NODE.consent).spec as GroupSpec
  const consentCheck = elementByNodeId(ext02a, NODE.consentCheck).spec as InputSpec
  const submit = elementByNodeId(ext02a, NODE.submit).spec as ButtonSpec

  const inputAt = (nodeId: string) => elementByNodeId(ext02a, nodeId).spec as InputSpec
  const selectAt = (nodeId: string) => elementByNodeId(ext02a, nodeId).spec as SelectSpec

  const valueOf = (fieldKey: string) => draft.values[fieldKey] ?? ''
  const setValue = (fieldKey: string, next: string) =>
    field.setFieldValue(fieldKey, next === '' ? null : next)

  // 토큰이 없으면 무엇의 폼인지 알 수 없다. 아무 설문이나 대신 열지 않는다.
  const missing = (ext02a.params ?? []).filter(
    (param) => (screenParams[param.key] ?? '') === '',
  )
  if (missing.length > 0) {
    return (
      <MobileScreen header={<BrandBar />}>
        <p role="alert" className="pt-6 text-sm text-red-700">
          {missing.map((param) => param.missingNote).join(' ')}
        </p>
      </MobileScreen>
    )
  }

  // 토큰이 가리키는 설문이 없는 것과 토큰이 아예 없는 것은 다른 일이다. 뒤엣것은
  // 명세의 missingNote가, 앞엣것은 카탈로그의 empty가 말한다.
  const form = readObjectSourceOrNull(
    schedule.dataSourceKey,
    resolveParams(schedule.params, { screenParams }),
  )
  if (form === null) {
    return (
      <MobileScreen header={<BrandBar />}>
        <p role="alert" className="pt-6 text-sm text-red-700">
          {findDataSource(schedule.dataSourceKey).messages.empty}
        </p>
      </MobileScreen>
    )
  }

  // 조립 함수는 컴포넌트가 아니라 함수다. 컴포넌트로 만들면 글자를 한 자 칠 때마다
  // React가 그것을 새 유형으로 보고 칸을 갈아 끼워 포커스가 달아난다(EVT-02B).
  function textField(nodeId: string): ReactNode {
    const spec = inputAt(nodeId)
    return (
      <Field
        htmlFor={spec.fieldKey}
        nodeId={nodeId}
        label={spec.label}
        required={spec.required}
        error={field.errors[spec.fieldKey]}
      >
        {spec.multiline === true ? (
          <textarea
            id={spec.fieldKey}
            ref={field.registerRef(spec.fieldKey)}
            rows={3}
            value={valueOf(spec.fieldKey)}
            placeholder={spec.placeholder ?? undefined}
            onChange={(event) => setValue(spec.fieldKey, event.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-800 placeholder:text-gray-400 focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 focus:outline-none"
          />
        ) : (
          <TextInput
            id={spec.fieldKey}
            value={valueOf(spec.fieldKey)}
            placeholder={spec.placeholder}
            type={spec.inputType}
            hasError={Boolean(field.errors[spec.fieldKey])}
            inputRef={field.registerRef(spec.fieldKey)}
            onChange={(next) => setValue(spec.fieldKey, next)}
          />
        )}
      </Field>
    )
  }

  function selectField(nodeId: string, chevron: string): ReactNode {
    const spec = selectAt(nodeId)
    return (
      <Field
        htmlFor={spec.fieldKey}
        nodeId={nodeId}
        label={spec.label}
        required={spec.required}
        error={field.errors[spec.fieldKey]}
      >
        <SearchSelect
          id={spec.fieldKey}
          placeholder={spec.placeholder}
          searchable={spec.searchable}
          disabled={!field.isSelectEnabled(spec)}
          hasError={Boolean(field.errors[spec.fieldKey])}
          sourceKey={spec.optionsSource.key}
          sourceParams={field.resolveSourceParams(spec)}
          value={field.selectValue(spec.fieldKey)}
          onSelect={(option) => field.setFieldValue(spec.fieldKey, option.value, option.label)}
          triggerRef={field.registerRef(spec.fieldKey)}
          chevron={<FigmaAsset screenId={SCREEN} nodeId={chevron} className="size-3.5" />}
        />
      </Field>
    )
  }

  const meta = ext02a.meta

  return (
    <MobileScreen
      header={
        // 머리 한 덩이(30:7138). 아래로 gray-100 가름줄을 두른다.
        <div className="border-b border-gray-100 px-5 pt-4 pb-3">
          <Brand />
          <h1 className="pt-2.5 text-base font-bold text-gray-900">
            {drawnTitleOf(ext02a, screenParams)}
          </h1>

          <div data-node-id={NODE.schedule} className="flex flex-col gap-1.5 pt-2.5">
            {schedule.items!.map((item, at) => (
              <span key={item.field} className="flex items-center gap-2">
                <FigmaAsset screenId={SCREEN} nodeId={ROW_ASSET[at]} className="size-3.5" />
                {/* 값 하나가 제 요소를 가져야 대조가 짚는다. */}
                <span className="text-xs text-gray-600">{String(form[item.field!])}</span>
              </span>
            ))}
          </div>

          <div data-node-id={NODE.fee} className="pt-2.5">
            {/* 참가비 딱지. 색이 하나뿐이라 톤 이름을 받지 않는다 — 그림이 상태에
                따라 다른 색을 그리지 않았고, 무엇이 무료인지는 서버가 문장으로
                완성해 준다(같은 사실을 안쪽에서는 event.basics.fee가 갖는다). */}
            <span className="inline-block rounded border border-blue-200 bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
              {fee.items!.map((item) => (
                <span key={item.field}>
                  <span>{item.label}</span> <span>{String(form[item.field!])}</span>
                </span>
              ))}
            </span>
          </div>
        </div>
      }
    >
      <p className="pt-4 text-xs text-gray-500">{meta?.description}</p>

      <div className="flex flex-col gap-4 pt-4">
        {textField(NODE.name)}
        {textField(NODE.studentNumber)}
        {selectField(NODE.college, CHEVRON.college)}
        {selectField(NODE.department, CHEVRON.department)}
        {selectField(NODE.currentGrade, CHEVRON.currentGrade)}
        {textField(NODE.motivation)}

        {/* 묶음의 이름은 title이지 별표까지가 아니다. 그래서 aria-labelledby로
            제목을 가리키지 않는다 — 가리키면 그려진 별표가 이름에 딸려 들어가
            묶음의 이름이 '개인정보 수집 동의*'가 된다. */}
        <section
          data-node-id={NODE.consent}
          aria-label={consent.title}
          className="flex flex-col gap-2 rounded-lg border border-gray-200 p-4"
        >
          {/* **별표가 컨트롤과 갈라져 있다.** 그림은 이 제목에 별표를 붙였고 체크
              칸의 라벨('동의합니다')에는 붙이지 않았다. 별표가 말하는 것은 아래
              칸이 필수라는 사실이므로 그 사실을 가진 곳(멤버의 required)에서 온다 —
              화면이 '여기에는 별이 있다'를 스스로 정하지 않는다. */}
          <h3 className="text-xs font-semibold text-gray-700">
            <span>{consent.title}</span>
            {consentCheck.required && <span className="text-red-500">*</span>}
          </h3>
          <p className="text-xs text-gray-500">{consent.description}</p>

          {/* 켜고 끄는 칸(input.inputType checkbox). 꺼짐을 null로 담는 것은 이
              저장소의 규칙이다(EVT-02B·EVT-05) — 'y'/null이라야 필수 판정이 이
              칸을 빈 것으로 본다. 그림은 체크 상자를 브라우저 기본 색으로 두었고,
              그 색은 글이 없어 대조가 보지 않는다. */}
          <label
            data-node-id={NODE.consentCheck}
            htmlFor={consentCheck.fieldKey}
            className="flex items-center gap-2 text-xs font-medium text-gray-700"
          >
            <input
              id={consentCheck.fieldKey}
              ref={field.registerRef(consentCheck.fieldKey)}
              type={consentCheck.inputType}
              // 체크 상자의 value는 기본이 'on'이라 대조기가 그 글을 칸의 내용으로
              // 읽는다. 켜짐은 checked가 말한다.
              value=""
              checked={valueOf(consentCheck.fieldKey) === 'y'}
              aria-required={consentCheck.required}
              aria-invalid={Boolean(field.errors[consentCheck.fieldKey]) || undefined}
              onChange={(event) =>
                field.setFieldValue(consentCheck.fieldKey, event.target.checked ? 'y' : null)
              }
              className="size-3.5 shrink-0 accent-blue-600"
            />
            <span>{consentCheck.label}</span>
          </label>
          {field.errors[consentCheck.fieldKey] ? (
            <p className="text-xs text-red-500">{field.errors[consentCheck.fieldKey]}</p>
          ) : null}
        </section>
      </div>

      {/* 바닥 단추(30:7227). **고정 푸터가 아니다** — y=820이고 뷰포트 바닥이
          884.5라 흐름의 끝일 뿐이다. */}
      <div className="pt-6 pb-6">
        <button
          type="button"
          data-node-id={NODE.submit}
          onClick={() =>
            field.runButton(submit, () => {
              void submitAction.run(submit.action as SubmitAction, {
                payload: draft.values,
                onNavigate,
                // 무엇을 넘길지는 명세가 말한다(onSuccess.params). 화면은 그 값이
                // 어디 있는지만 알려 준다.
                paramSources: { screenParams },
                onScopeEvent,
              })
            })
          }
          className="w-full rounded-lg bg-blue-600 py-3 text-sm font-semibold text-white hover:bg-blue-700 focus-visible:ring-2 focus-visible:ring-blue-600/50 focus-visible:outline-none"
        >
          {submitAction.labelOf(submit.action as SubmitAction, submit.label)}
        </button>
        {submitAction.errorMessage === null ? null : (
          <p role="alert" className="pt-2 text-xs text-red-500">
            {submitAction.errorMessage}
          </p>
        )}
      </div>
    </MobileScreen>
  )
}

// 로고(30:7139). 글은 shell.json이 갖는다 — 화면이 적으면 두 벌이 된다.
function Brand() {
  return (
    <div className="flex items-center gap-2">
      <span className="flex size-6 items-center justify-center rounded bg-blue-600 text-xs font-bold text-white">
        {BRAND.slice(0, 1)}
      </span>
      <span className="text-sm font-semibold text-gray-700">{BRAND}</span>
    </div>
  )
}

// 무엇의 폼인지 모를 때의 머리. 로고만 남는다 — 그 아래 넉 줄은 전부 설문이
// 정하는 값이라 그릴 것이 없다.
function BrandBar() {
  return (
    <div className="border-b border-gray-100 px-5 pt-4 pb-3">
      <Brand />
    </div>
  )
}
