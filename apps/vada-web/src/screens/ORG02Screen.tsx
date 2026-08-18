import { useState } from 'react'
import { evaluateButtonExecution } from '../../../../packages/contracts/src/button-execution.mjs'
import { ChoiceGroup } from '../components/ChoiceGroup'
import { FlowProgress } from '../components/FlowProgress'
import { OrgTree } from '../components/OrgTree'
import type { ListValue } from '../components/OrgTree'
import { PageCard } from '../components/PageCard'
import { PrimaryButton } from '../components/PrimaryButton'
import { SecondaryButton } from '../components/SecondaryButton'
import { findFlowStep } from '../spec/flows'
import { getMutation, runMutation } from '../spec/mutations'
import { buttonsByEmphasis, org02, primaryButtonOf } from '../spec/screens'
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
  const [submitState, setSubmitState] = useState<'idle' | 'submitting' | 'error'>('idle')

  const meta = org02.meta
  const flowStep = findFlowStep(org02.screenId)
  const elements = org02.elements

  const setupSpec = elements.find((element) => element.spec.type === 'select')!
    .spec as SelectSpec
  const listSpec = elements.find((element) => element.spec.type === 'list')!.spec as ListSpec
  const buttons = elements
    .filter((element) => element.spec.type === 'button')
    .map((element) => element.spec as ButtonSpec)
  const primaryButton = primaryButtonOf(buttons)
  const secondaryButtons = buttonsByEmphasis(buttons, 'secondary')

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
      values: draft.values,
    })
    if (!result.allowed) {
      return
    }

    const action = primaryButton.action as SubmitAction
    const mutation = getMutation(action.mutationKey)
    setSubmitState('submitting')
    try {
      // payloadScope의 값 전체를 보낸다(계약은 mutations.json이 갖는다).
      await runMutation(action.mutationKey, draft.values)
      if (action.onSuccess.scopeEvent) {
        onScopeEvent(mutation.payloadScope, action.onSuccess.scopeEvent)
      }
      if (action.onSuccess.navigate) {
        onNavigate(action.onSuccess.navigate)
      }
    } catch {
      setSubmitState('error')
    }
  }

  const mutation = getMutation((primaryButton.action as SubmitAction).mutationKey)

  return (
    // 카드 14:242: 총폭 860 → ÷0.875 = 982 (콘텐츠 900 + padding 40×2 + border 1×2)
    <PageCard maxWidth={982}>
      <header className="flex items-start justify-between gap-4">
        <div>
          {meta?.eyebrow && <p className="text-xs text-gray-400">{meta.eyebrow}</p>}
          {meta && <h1 className="pt-1 text-lg font-semibold text-gray-900">{meta.title}</h1>}
        </div>
        {flowStep && (
          <FlowProgress label={flowStep.label} step={flowStep.step} totalSteps={flowStep.total} />
        )}
      </header>
      {meta?.description && <p className="pt-1 text-sm text-gray-500">{meta.description}</p>}

      <div className="flex flex-col gap-5 pt-6">
        {/* 라디오 카드 14:257에는 라벨이 없다 — 없는 카피를 지어내지 않는다. */}
        <ChoiceGroup
          id={setupSpec.fieldKey}
          disabled={false}
          sourceKey={setupSpec.optionsSource.key}
          sourceParams={{}}
          value={selectValue(setupSpec.fieldKey)}
          onSelect={(option) => setSetupMode(option.value, option.label)}
        />

        <OrgTree
          id={listSpec.fieldKey}
          spec={listSpec}
          value={listValue}
          onChange={setListValue}
        />
      </div>

      {meta?.footerNote && (
        <p className="pt-6 text-center text-xs text-gray-400">{meta.footerNote}</p>
      )}

      {submitState === 'error' && (
        <p role="alert" className="pt-2 text-center text-xs text-red-500">
          {mutation.messages.error}
        </p>
      )}

      <div className="flex items-center justify-between gap-4 pt-8">
        <div className="flex items-center gap-2">
          {secondaryButtons.map((button) => (
            <SecondaryButton
              key={button.label}
              label={button.label}
              onClick={() =>
                onNavigate(
                  button.action.type === 'navigate' ? button.action.targetScreenId : org02.screenId,
                )
              }
            />
          ))}
        </div>
        <PrimaryButton
          label={submitState === 'submitting' ? mutation.messages.submitting : primaryButton.label}
          onClick={() => void handlePrimary()}
          fullWidth={false}
        />
      </div>
    </PageCard>
  )
}
