import { Field } from '../components/Field'
import { MobileScreen } from '../components/MobileScreen'
import { TextInput } from '../components/TextInput'
import { findDataSource, readObjectSourceOrNull } from '../data-sources/catalog'
import type { DataRow } from '../data-sources/catalog'
import { NEUTRAL_BORDER, NEUTRAL_CHIP, SOFT_BOX, STATE_CHIP } from '../design/tones'
import { resolveParams } from '../spec/params'
import { elementByNodeId, ext01a } from '../spec/screens'
import { useFieldDraft } from '../spec/useFieldDraft'
import { useSubmitAction } from '../spec/useSubmitAction'
import type { ButtonSpec, InputSpec, SubmitAction, SummarySpec } from '../spec/types'
import type { ScopeDraft } from '../state/scopes'

// QR 참석 확인 폼(EXT-01A). **학생회 사람이 아닌 이가 보는 첫 화면이다.**
//
// 로그인한 사람이 없다. 그래서 셸이 없고(명세의 viewer: external), 무엇을 볼 수
// 있는지는 주소가 실어 온 토큰만이 정한다 — 인자가 eventId가 아니라 checkInToken인
// 까닭이 그것이다. QR은 껐다 켜고 다시 만들 수 있으므로(EVT-04B) 가리키는 것은
// QR이지 행사가 아니고, eventId를 받으면 누구나 남의 행사의 참석 화면을 연다.
//
// 그릇은 MobileScreen이다. 폭이 390인 화면이 다섯 있고 그 앞의 모든 화면은
// 1288이라 PageCard를 넓혀 쓸 수 없었다(components/MobileScreen.tsx의 주석).
// 머리는 그릇이 아니라 화면이 그린다 — 머리가 아예 없는 화면이 셋이기 때문이다.
//
// ── 명세가 말하지 않아 여기가 알고 있는 것 ────────────────────────────────
//
// **열자마자 막는 자리**(사람이 정한 것: docs/decisions/product-decisions.md).
// QR이 꺼져 있거나 체크인 시간이 아니면 이름·학번 칸을 아예 그리지 않고 그
// 까닭만 그린다. 그런데 **'데이터가 허락할 때만 그려진다'를 말할 어휘가 명세에
// 없다** — enabledWhen은 다른 칸의 값만 보고, executeWhen은 단추의 것이며 한
// 판정만 든다. 그래서 이 갈래는 카탈로그의 조각 설명(attendance.checkInForm의
// blockedLabel·blockedTone·blockedNote)에만 적혀 있고 screen.json은 침묵한다.
//
// 막힌 자리에 그리는 카드는 **그림에 없다**. EXT-01B의 결과 카드와 같은 것을
// 보여 주기로 사람이 정했는데 이 프레임에는 그 상태가 그려져 있지 않다 —
// 등록 노드가 없으므로 대조도 이 자리를 보지 않는다. 아이콘은 그리지 않는다:
// 이 화면에는 뽑아 둔 그림이 하나도 없고, 없는 것을 지어내지 않는다.

const NODE = {
  head: '30:7361',
  guide: '30:7369',
  name: '30:7373',
  studentNumber: '30:7378',
  submit: '30:7383',
} as const

interface EXT01AScreenProps {
  screenParams: Record<string, string>
  draft: ScopeDraft
  onChangeDraft: (next: ScopeDraft) => void
  onScopeEvent: (scopeKey: string, event: 'complete' | 'cancel') => void
  onNavigate: (screenId: string, params?: Record<string, string>) => void
}

function scalar(row: DataRow, field: string | undefined): string {
  const value = field === undefined ? undefined : row[field]
  return value === undefined ? '' : String(value)
}

export function EXT01AScreen({
  screenParams,
  draft,
  onChangeDraft,
  onScopeEvent,
  onNavigate,
}: EXT01AScreenProps) {
  const head = elementByNodeId(ext01a, NODE.head).spec as SummarySpec
  const guide = elementByNodeId(ext01a, NODE.guide).spec as SummarySpec
  const name = elementByNodeId(ext01a, NODE.name).spec as InputSpec
  const studentNumber = elementByNodeId(ext01a, NODE.studentNumber).spec as InputSpec
  const submit = elementByNodeId(ext01a, NODE.submit).spec as ButtonSpec

  const field = useFieldDraft({ elements: ext01a.elements, draft, onChangeDraft })
  const submitAction = useSubmitAction()

  // 어느 QR로 왔는지 모르면 무엇을 확인해 줄지도 알 수 없다. 인자가 비면 아무
  // 행사나 대신 집어 오지 않는다 — 그러면 남의 행사의 참석 화면이 열린다.
  const missingParam = (ext01a.params ?? []).find(
    (param) => param.optional !== true && (screenParams[param.key] ?? '') === '',
  )
  if (missingParam !== undefined) {
    return (
      <MobileScreen>
        <div className="flex flex-col gap-6 py-8">
          <Brand title={ext01a.meta?.title ?? ext01a.screenId} />
          <p role="alert" className="text-sm text-red-700">
            {missingParam.missingNote}
          </p>
        </div>
      </MobileScreen>
    )
  }

  const form = readObjectSourceOrNull(
    head.dataSourceKey,
    resolveParams(head.params, { screenParams }),
  )

  if (form === null) {
    return (
      <MobileScreen>
        <div className="flex flex-col gap-6 py-8">
          <Brand title={ext01a.meta?.title ?? ext01a.screenId} />
          <p role="status" className="text-sm text-gray-600">
            {findDataSource(head.dataSourceKey).messages.empty}
          </p>
        </div>
      </MobileScreen>
    )
  }

  const status = head.status?.[0]
  // 지금 받을 수 있는가. **막은 까닭이 오면 막힌 것이다** — sourceAllows가
  // blockedNoteField를 읽는 규칙과 같다(글이 있으면 막히고 비어 있으면 열린다).
  const blockedNote = scalar(form, 'blockedNote')
  const blocked = blockedNote !== ''

  const inputs: Array<{ nodeId: string; spec: InputSpec }> = [
    { nodeId: NODE.name, spec: name },
    { nodeId: NODE.studentNumber, spec: studentNumber },
  ]

  return (
    <MobileScreen>
      <div className="flex flex-col gap-6 py-8">
        <Brand title={ext01a.meta?.title ?? ext01a.screenId} />

        {/* 어느 행사의 참석 확인인지. 행사 이름도 상태도 시간대도 서버가 준다 —
            토큰이 가리키는 QR만이 그것을 안다. */}
        <div data-node-id={NODE.head}>
          <p className="text-sm font-bold text-gray-900">{scalar(form, head.titleField)}</p>
          <div className="flex flex-wrap items-center gap-2 pt-2">
            {status === undefined ? null : (
              <span
                data-design-state
                data-design-rule="state-chip"
                className={`rounded px-2 py-0.5 text-xs font-medium ${
                  STATE_CHIP[scalar(form, status.toneField)] ?? NEUTRAL_CHIP
                }`}
              >
                {scalar(form, status.field)}
              </span>
            )}
            {(head.items ?? []).map((item) => (
              <span key={item.field} className="text-xs text-gray-500">
                {scalar(form, item.field)}
              </span>
            ))}
          </div>
        </div>

        {/* 무엇을 어떻게 적어야 하는지. 문구는 서버가 완성해 온다. */}
        <p
          data-node-id={NODE.guide}
          className="rounded-xl border border-blue-100 bg-blue-50 p-4 text-xs text-blue-600"
        >
          {(guide.items ?? []).map((item) => scalar(form, item.field)).join(' ')}
        </p>

        {blocked ? (
          // 헛되이 입력하게 하지 않는다. 칸도 단추도 그리지 않고 까닭만 남긴다.
          // 이 상태의 그림이 없으므로 대조가 보는 자리도 아니다.
          <div
            role="status"
            className={`rounded-xl border p-6 text-center ${
              SOFT_BOX[scalar(form, 'blockedTone')] ?? NEUTRAL_BORDER
            }`}
          >
            <p className="text-sm font-semibold text-gray-900">{scalar(form, 'blockedLabel')}</p>
            <p className="pt-1 text-xs text-gray-500">{blockedNote}</p>
          </div>
        ) : (
          <>
            <div className="flex flex-col gap-4">
              {inputs.map(({ nodeId, spec }) => (
                <Field
                  key={spec.fieldKey}
                  htmlFor={spec.fieldKey}
                  nodeId={nodeId}
                  label={spec.label}
                  required={spec.required}
                  error={field.errors[spec.fieldKey]}
                  helperText={spec.helperText}
                >
                  <TextInput
                    id={spec.fieldKey}
                    inputRef={field.registerRef(spec.fieldKey)}
                    type={spec.inputType}
                    value={draft.values[spec.fieldKey] ?? spec.initialValue ?? ''}
                    placeholder={spec.placeholder}
                    hasError={field.errors[spec.fieldKey] !== undefined}
                    onChange={(value) =>
                      field.setFieldValue(spec.fieldKey, value === '' ? null : value)
                    }
                  />
                </Field>
              ))}
            </div>

            <button
              type="button"
              data-node-id={NODE.submit}
              onClick={() =>
                // 막는 조건은 명세에 있다(executeWhen). 빈 칸을 짚고 그리로
                // 데려가는 것까지 한 곳에서 돈다.
                field.runButton(submit, () => {
                  void submitAction.run(submit.action as SubmitAction, {
                    payload: draft.values,
                    paramSources: { screenParams, fields: draft.values },
                    onNavigate,
                    onScopeEvent,
                  })
                })
              }
              className="w-full rounded-xl bg-blue-600 py-3.5 text-sm font-semibold text-white hover:bg-blue-700 focus-visible:ring-2 focus-visible:ring-blue-600/50 focus-visible:outline-none"
            >
              {submitAction.labelOf(submit.action as SubmitAction, submit.label)}
            </button>

            {submitAction.errorMessage === null ? null : (
              <p role="alert" className="text-xs text-red-500">
                {submitAction.errorMessage}
              </p>
            )}
          </>
        )}
      </div>
    </MobileScreen>
  )
}

// 머리. 로고 자리에 학생회 이름이 아니라 **이 화면의 이름**이 온다(30:7355) —
// 밖에서 온 사람은 어느 조직인지가 아니라 무엇을 하러 왔는지를 먼저 본다.
function Brand({ title }: { title: string }) {
  return (
    <header className="flex items-center gap-2">
      <div className="flex size-6 items-center justify-center rounded bg-blue-600 text-[10px] font-bold text-white">
        V
      </div>
      <h1 className="text-xs font-semibold text-gray-700">{title}</h1>
    </header>
  )
}
