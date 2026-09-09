import { useState } from 'react'
import { AppShell } from '../components/AppShell'
import { FigmaAsset } from '../components/FigmaAsset'
import { Field } from '../components/Field'
import { SearchSelect } from '../components/SearchSelect'
import { TextInput } from '../components/TextInput'
import { readObjectSource } from '../data-sources/catalog'
import { draftFromRow } from '../spec/draft-values'
import { useFieldDraft } from '../spec/useFieldDraft'
import { useSubmitAction } from '../spec/useSubmitAction'
import { elementByNodeId, myInfo01, nodeIdOf } from '../spec/screens'
import type { ButtonSpec, InputSpec, SelectSpec, SubmitAction, SummarySpec } from '../spec/types'
import type { ScopeDraft } from '../state/scopes'

// 내 정보(MY-INFO-01).
//
// **온보딩에서 받아 둔 것을 되돌려 준다.** ONB-01이 이름·학번·학교·단과대학·학부·학년을
// 받는데 그것을 보여 주는 자리가 어디에도 없었다 — 조직도가 학부와 학년만 그렸고
// 학번은 아무 화면에도 안 나왔다. 배포된 것을 쓰던 사람이 물었다(2026-09-09).
//
// **어느 갈피에도 속하지 않는다.** 왼쪽 아래 자기 이름을 눌러야 열린다 — 셸의 자리이고
// 그래서 `activeNavigationScreenId`가 없다.
//
// **고칠 수 있는 것과 없는 것이 갈려 있다.** 이름은 로그인한 계정의 것이고 학교는
// 학생회의 것이다. 그 둘을 회색 칸으로 그리고 왜인지 곁에 적는다 — 못 고치는 칸을
// 이유 없이 두면 사람은 고장으로 읽는다.

const NODE = {
  save: '630:8',
  name: '631:4',
  studentNumber: '631:11',
  schoolName: '631:18',
  college: '631:25',
  department: '631:33',
  currentGrade: '631:40',
  belonging: '631:2273',
} as const

/** 고르는 칸마다 design이 뽑아 둔 화살표. */
const CHEVRON: Record<string, string> = {
  college: '631:2293',
  department: '631:2295',
  currentGrade: '631:2297',
}

interface MYINFO01ScreenProps {
  /** 명세가 stateScopeKey로 말한 자리(myProfileDraft). 고치던 것은 여기 남는다. */
  draft: ScopeDraft
  onChangeDraft: (next: ScopeDraft) => void
  onNavigate: (screenId: string, params?: Record<string, string>) => void
  onScopeEvent: (scopeKey: string, event: 'complete' | 'cancel') => void
}

export function MYINFO01Screen({
  draft: scopeDraft,
  onChangeDraft,
  onNavigate,
  onScopeEvent,
}: MYINFO01ScreenProps) {
  const submitAction = useSubmitAction()
  const [saved, setSaved] = useState(false)

  // **고칠 것을 먼저 읽어 온다**(draftFrom). 빈칸에서 시작하면 사람은 자기가 적어 둔
  // 것을 다시 적는다. 인자가 없는 출처라 여는 순간 곧바로 읽는다.
  const [seed] = useState<ScopeDraft>(() =>
    draftFromRow(readObjectSource(myInfo01.draftFrom!.dataSourceKey, {})),
  )
  const draft = Object.keys(scopeDraft.values).length === 0 ? seed : scopeDraft
  const field = useFieldDraft({
    elements: myInfo01.elements,
    draft,
    onChangeDraft,
    screenParams: {},
  })

  const inputAt = (nodeId: string) => elementByNodeId(myInfo01, nodeId).spec as InputSpec
  const selectAt = (nodeId: string) => elementByNodeId(myInfo01, nodeId).spec as SelectSpec
  const save = elementByNodeId(myInfo01, NODE.save).spec as ButtonSpec
  const belonging = elementByNodeId(myInfo01, NODE.belonging).spec as SummarySpec
  // **읽는 값이다.** 소속 부서와 직책은 조직도가 정하므로 고치는 초안과 갈라 읽는다.
  const belongs = readObjectSource(belonging.dataSourceKey!, {})

  const valueOf = (fieldKey: string) => draft.values[fieldKey] ?? ''

  function word(nodeId: string) {
    const spec = inputAt(nodeId)
    return (
      <Field
        htmlFor={spec.fieldKey}
        nodeId={nodeIdOf(myInfo01, spec)}
        label={spec.label}
        required={spec.required}
        error={field.errors[spec.fieldKey]}
        helperText={spec.helperText}
      >
        <TextInput
          id={spec.fieldKey}
          value={valueOf(spec.fieldKey)}
          placeholder={spec.placeholder}
          type={spec.inputType}
          readOnly={spec.readOnly}
          hasError={field.errors[spec.fieldKey] !== undefined}
          inputRef={field.registerRef(spec.fieldKey)}
          // 못 고치는 칸은 값이 바뀔 일이 없다. 그래도 손잡이를 비워 두지 않는다 —
          // 비우면 이 칸이 왜 안 바뀌는지가 코드에서 사라진다.
          onChange={(next) =>
            spec.readOnly === true
              ? undefined
              : field.setFieldValue(spec.fieldKey, next === '' ? null : next)
          }
        />
      </Field>
    )
  }

  function pick(nodeId: string) {
    const spec = selectAt(nodeId)
    // 열려 있는가는 명세가 정하고(enabledWhen) 갈고리가 판정한다.
    const disabled = !field.isSelectEnabled(spec)
    return (
      <Field
        htmlFor={spec.fieldKey}
        nodeId={nodeIdOf(myInfo01, spec)}
        label={spec.label}
        required={spec.required}
        disabled={disabled}
        error={field.errors[spec.fieldKey]}
      >
        <SearchSelect
          id={spec.fieldKey}
          placeholder={disabled ? (spec.disabledPlaceholder ?? null) : spec.placeholder}
          searchable={spec.searchable}
          disabled={disabled}
          hasError={field.errors[spec.fieldKey] !== undefined}
          sourceKey={spec.optionsSource.key}
          // **명세가 인자를 든다.** 학부는 고른 단과대에 딸리고, 학교는 서버가 안다.
          sourceParams={field.resolveSourceParams(spec)}
          value={field.selectValue(spec.fieldKey)}
          onSelect={(option) => {
            setSaved(false)
            field.setFieldValue(spec.fieldKey, option.value, option.label)
          }}
          triggerRef={field.registerRef(spec.fieldKey)}
          // **화살표가 그림으로 뽑혀 있다.** 우리 아이콘을 그대로 쓰면 그 그림을
          // 아무도 안 그린 것이 되어 자산 대조가 빈다(FIN-REQ-01과 같은 자리).
          chevron={
            <FigmaAsset screenId={myInfo01.screenId} nodeId={CHEVRON[spec.fieldKey]} className="size-4" />
          }
        />
      </Field>
    )
  }

  // 막았으면 무엇 때문인지 말하고 첫 빈 칸으로 데려간다 — 그 규칙은 갈고리가 든다.
  function press() {
    field.runButton(save, () => {
      setSaved(false)
      void submitAction
        .run(save.action as SubmitAction, {
          payload: draft.values,
          onNavigate,
          onScopeEvent,
        })
        // **저장됐다고 말한다.** 갈 곳이 없는 화면이라 아무 일도 안 일어난 것처럼
        // 보인다 — 서버가 받았을 때만(던지지 않았을 때만) 켠다.
        .then((answer) => setSaved(answer !== undefined))
    })
  }

  return (
    <AppShell
      screenId={myInfo01.screenId}
      eyebrow={myInfo01.meta?.eyebrow}
      title={myInfo01.meta?.title ?? myInfo01.screenId}
      description={myInfo01.meta?.description}
      onNavigate={onNavigate}
    >
      <div className="flex max-w-4xl flex-col gap-4">
        <section className="flex flex-col gap-5 rounded-xl border border-gray-200 bg-white p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-gray-900">학적 정보</h2>
              <p className="text-xs text-gray-400">
                이름은 로그인한 계정에서 오므로 여기서 고치지 않습니다.
              </p>
            </div>
            <button
              type="button"
              data-node-id={nodeIdOf(myInfo01, save)}
              onClick={press}
              className="shrink-0 rounded-md bg-blue-600 px-3.5 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
            >
              {submitAction.labelOf(save.action as SubmitAction, save.label)}
            </button>
          </div>

          <div className="grid grid-cols-2 gap-x-5 gap-y-4">
            {word(NODE.name)}
            {word(NODE.studentNumber)}
            {word(NODE.schoolName)}
            {pick(NODE.college)}
            {pick(NODE.department)}
            {pick(NODE.currentGrade)}
          </div>

          {/* **글은 갈고리가 고른다.** 서버가 무엇이 잘못됐는지 말하면 그 말이 온다. */}
          {submitAction.errorMessage === null ? null : (
            <p role="alert" className="text-xs text-red-500">
              {submitAction.errorMessage}
            </p>
          )}
          {saved && submitAction.errorMessage === null ? (
            <p role="status" className="text-xs text-gray-500">
              저장했습니다.
            </p>
          ) : null}
        </section>

        <section
          data-node-id={nodeIdOf(myInfo01, belonging)}
          className="flex flex-col gap-4 rounded-xl border border-gray-200 bg-white p-5"
        >
          <div>
            <h2 className="text-sm font-semibold text-gray-900">{belonging.title}</h2>
            {belonging.description === undefined ? null : (
              <p className="text-xs text-gray-400">{belonging.description}</p>
            )}
          </div>
          <div className="grid grid-cols-3 gap-5">
            {(belonging.items ?? []).map((item) => (
              <div key={item.field} className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-gray-700">{item.label}</span>
                <span className="text-sm text-gray-800">{String(belongs[item.field!] ?? '')}</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </AppShell>
  )
}
