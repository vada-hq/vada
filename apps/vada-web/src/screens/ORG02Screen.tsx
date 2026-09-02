import { useState } from 'react'
import { evaluateButtonExecution } from '../../../../packages/contracts/src/button-execution.mjs'
import { ChoiceGroup } from '../components/ChoiceGroup'
import { OrgTree } from '../components/OrgTree'
import type { ListValue } from '../components/OrgTree'
import { PageCard } from '../components/PageCard'
import { PrimaryButton } from '../components/PrimaryButton'
import { SecondaryButton } from '../components/SecondaryButton'
import { useSubmitAction } from '../spec/useSubmitAction'
import { buttonsByEmphasis, nodeIdOf, org02, primaryButtonOf } from '../spec/screens'
import type { ButtonSpec, ListSpec, SelectSpec, SubmitAction } from '../spec/types'
import type { ScopeDraft } from '../state/scopes'

interface ORG02ScreenProps {
  draft: ScopeDraft
  onChangeDraft: (next: ScopeDraft) => void
  onNavigate: (screenId: string) => void
  onScopeEvent: (scopeKey: string, event: 'complete' | 'cancel') => void
}

const LIST_SEPARATOR = '\n'

// 스코프에 값이 없으면 스펙의 initialValue가 유효값이다.
// (ONB-01·ORG-01은 전부 null이라 이 필드가 지금까지 소비된 적이 없었다.)
function effectiveValue(draft: ScopeDraft, spec: SelectSpec): string | null {
  const stored = draft.values[spec.fieldKey]
  return stored !== undefined ? stored : spec.initialValue
}

// list 값은 스코프 초안(문자열 맵)에 담기므로 한 줄에 하나씩 직렬화한다.
function readListValue(draft: ScopeDraft, spec: ListSpec, triggerValue: string | null): ListValue {
  const raw = draft.values[spec.fieldKey]
  const rootName = draft.values[`${spec.fieldKey}.root`] ?? spec.rootItem?.initialName ?? ''
  if (typeof raw !== 'string') {
    return { rootName, items: spec.initialItems?.byValue[triggerValue ?? ''] ?? [] }
  }
  return { rootName, items: raw === '' ? [] : raw.split(LIST_SEPARATOR) }
}

export function ORG02Screen({
  draft,
  onChangeDraft,
  onNavigate,
  onScopeEvent,
}: ORG02ScreenProps) {
  const submitAction = useSubmitAction()
  const [blockedKeys, setBlockedKeys] = useState<string[]>([])

  const meta = org02.meta
  const elements = org02.elements

  const setupSpec = elements.find((element) => element.spec.type === 'select')!
    .spec as SelectSpec
  const listSpec = elements.find((element) => element.spec.type === 'list')!.spec as ListSpec
  const buttons = elements
    .filter((element) => element.spec.type === 'button')
    .map((element) => element.spec as ButtonSpec)
  const primaryButton = primaryButtonOf(buttons)
  const secondaryButtons = buttonsByEmphasis(buttons, 'secondary')

  // 그리는 값과 판정하는 값은 같아야 한다. 명세가 initialValue를 말하면 그것이
  // 아직 아무도 고르지 않았을 때의 값이다 - 한동안 화면은 그것을 '골라진 것처럼'
  // 그리면서 판정기에는 빈 초안을 넘겼고, 그래서 **기본값 그대로 조직 만들기를
  // 누르면 아무 일도 일어나지 않았다**(2026-08-27 감사). 눈에 보이는 것과 판정이
  // 갈리는 자리를 없앤다.
  const effectiveValues: Record<string, string | null> = { ...draft.values }
  for (const element of elements) {
    const spec = element.spec as { fieldKey?: string; initialValue?: string | null }
    if (spec.fieldKey === undefined || effectiveValues[spec.fieldKey] !== undefined) continue
    if (typeof spec.initialValue === 'string' && spec.initialValue !== '') {
      effectiveValues[spec.fieldKey] = spec.initialValue
    }
  }

  const setupValue = effectiveValue(draft, setupSpec)
  const listValue = readListValue(draft, listSpec, setupValue)

  function selectValue(fieldKey: string) {
    const value = fieldKey === setupSpec.fieldKey ? setupValue : draft.values[fieldKey]
    if (typeof value !== 'string' || value.length === 0) {
      return null
    }
    return { value, label: draft.labels[fieldKey] ?? value }
  }

  function setSetupMode(value: string, label: string) {
    if (setupValue === value) {
      return
    }
    const values = { ...draft.values, [setupSpec.fieldKey]: value }
    const labels = { ...draft.labels, [setupSpec.fieldKey]: label }
    // resetOnChangeOf: 방식이 바뀌면 목록을 그 방식의 초기 항목으로 되돌린다.
    if (listSpec.resetOnChangeOf?.includes(setupSpec.fieldKey)) {
      const initial = listSpec.initialItems?.byValue[value] ?? []
      values[listSpec.fieldKey] = initial.join(LIST_SEPARATOR)
      values[`${listSpec.fieldKey}.root`] = listSpec.rootItem?.initialName ?? ''
    }
    onChangeDraft({ values, labels })
  }

  function setListValue(next: ListValue) {
    onChangeDraft({
      values: {
        ...draft.values,
        [listSpec.fieldKey]: next.items.join(LIST_SEPARATOR),
        [`${listSpec.fieldKey}.root`]: next.rootName,
      },
      labels: draft.labels,
    })
  }

  async function handlePrimary() {
    const result = evaluateButtonExecution({
      action: primaryButton.action,
      elements,
      values: effectiveValues,
    })
    if (!result.allowed) {
      // 막았으면 무엇 때문인지 말한다. 조용히 돌아가면 사람은 버튼이 고장 난
      // 줄 안다(명세: onExecutionBlocked.showMissingRequiredFields).
      setBlockedKeys(result.missingFieldKeys)
      return
    }
    setBlockedKeys([])

    // payloadScope의 값 전체를 보낸다(계약은 mutations.json이 갖는다).
    await submitAction.run(primaryButton.action as SubmitAction, {
      payload: effectiveValues,
      onNavigate,
      onScopeEvent,
    })
  }


  return (
    // 카드 14:242: 총폭 860 → ÷0.875 = 982 (콘텐츠 900 + padding 40×2 + border 1×2)
    <PageCard screen={org02} maxWidth={982}>
      <div className="flex flex-col gap-5 pt-6">
        {/* 라디오 카드 14:257에는 라벨이 없다 — 없는 카피를 지어내지 않는다. */}
        <ChoiceGroup
          id={setupSpec.fieldKey}
          nodeId={nodeIdOf(org02, setupSpec)}
          disabled={false}
          sourceKey={setupSpec.optionsSource.key}
          sourceParams={{}}
          value={selectValue(setupSpec.fieldKey)}
          onSelect={(option) => setSetupMode(option.value, option.label)}
        />

        <OrgTree
          id={listSpec.fieldKey}
          nodeId={nodeIdOf(org02, listSpec)}
          spec={listSpec}
          value={listValue}
          onChange={setListValue}
        />
      </div>

      {meta?.footerNote && (
        <p className="pt-6 text-center text-xs text-gray-400">{meta.footerNote}</p>
      )}

      {blockedKeys.length === 0 ? null : (
        <p role="alert" className="text-xs font-medium text-red-600">
          {`아직 고르지 않은 것이 있습니다: ${blockedKeys
            .map(
              (key) =>
                (elements.find((element) => (element.spec as { fieldKey?: string }).fieldKey === key)
                  ?.spec as { label?: string } | undefined)?.label ?? key,
            )
            .join(', ')}`}
        </p>
      )}
      {/* **글은 갈고리가 고른다.** 카탈로그를 직접 읽으면 '아직 서버에 붙지 않았다'처럼
          갈고리만 아는 글이 사라진다 — 그러면 안 지은 것과 고장 난 것이 같아 보인다. */}
      {submitAction.errorMessage === null ? null : (
        <p role="alert" className="pt-2 text-center text-xs text-red-500">
          {submitAction.errorMessage}
        </p>
      )}

      <div className="flex items-center justify-between gap-4 pt-8">
        <div className="flex items-center gap-2">
          {secondaryButtons.map((button) => (
            <SecondaryButton
              key={button.label}
              label={button.label}
              nodeId={nodeIdOf(org02, button)}
              onClick={() =>
                onNavigate(
                  button.action.type === 'navigate' ? button.action.targetScreenId : org02.screenId,
                )
              }
            />
          ))}
        </div>
        <PrimaryButton
          label={submitAction.labelOf(primaryButton.action as SubmitAction, primaryButton.label)}
          nodeId={nodeIdOf(org02, primaryButton)}
          onClick={() => void handlePrimary()}
          fullWidth={false}
        />
      </div>
    </PageCard>
  )
}
