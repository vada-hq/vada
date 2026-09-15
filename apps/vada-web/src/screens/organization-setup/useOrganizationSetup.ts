import { useState } from 'react'
import { evaluateButtonExecution } from '../../../../../packages/contracts/src/button-execution.mjs'
import type { ListValue } from '../../components/OrgTree'
import { buttonsByEmphasis, primaryButtonOf } from '../../spec/screens'
import { org02 } from '../../spec/screen-specs/org02'
import type { ButtonSpec, ListSpec, SelectSpec, SubmitAction } from '../../spec/types'
import { useSubmitAction } from '../../spec/useSubmitAction'
import type { ScopeDraft } from '../../state/scopes'

const LIST_SEPARATOR = '\n'

function effectiveValue(draft: ScopeDraft, spec: SelectSpec): string | null {
  const stored = draft.values[spec.fieldKey]
  return stored !== undefined ? stored : spec.initialValue
}

function readListValue(
  draft: ScopeDraft,
  spec: ListSpec,
  triggerValue: string | null,
): ListValue {
  const raw = draft.values[spec.fieldKey]
  const rootName = draft.values[`${spec.fieldKey}.root`] ?? spec.rootItem?.initialName ?? ''
  if (typeof raw !== 'string') {
    return { rootName, items: spec.initialItems?.byValue[triggerValue ?? ''] ?? [] }
  }
  return { rootName, items: raw === '' ? [] : raw.split(LIST_SEPARATOR) }
}

interface UseOrganizationSetupOptions {
  draft: ScopeDraft
  joining?: ScopeDraft
  onChangeDraft: (next: ScopeDraft) => void
  onNavigate: (screenId: string) => void
  onScopeEvent: (scopeKey: string, event: 'complete' | 'cancel') => void
}

export function useOrganizationSetup({
  draft,
  joining,
  onChangeDraft,
  onNavigate,
  onScopeEvent,
}: UseOrganizationSetupOptions) {
  const submitAction = useSubmitAction()
  const [blockedKeys, setBlockedKeys] = useState<string[]>([])
  const elements = org02.elements
  const setupSpec = elements.find((element) => element.spec.type === 'select')!
    .spec as SelectSpec
  const listSpec = elements.find((element) => element.spec.type === 'list')!.spec as ListSpec
  const buttons = elements
    .filter((element) => element.spec.type === 'button')
    .map((element) => element.spec as ButtonSpec)
  const primaryButton = primaryButtonOf(buttons)
  const secondaryButtons = buttonsByEmphasis(buttons, 'secondary')

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

  function selectValue() {
    if (typeof setupValue !== 'string' || setupValue.length === 0) return null
    return {
      value: setupValue,
      label: draft.labels[setupSpec.fieldKey] ?? setupValue,
    }
  }

  function setSetupMode(value: string, label: string) {
    if (setupValue === value) return
    const values = { ...draft.values, [setupSpec.fieldKey]: value }
    const labels = { ...draft.labels, [setupSpec.fieldKey]: label }
    if (listSpec.resetOnChangeOf?.includes(setupSpec.fieldKey)) {
      values[listSpec.fieldKey] = (listSpec.initialItems?.byValue[value] ?? []).join(LIST_SEPARATOR)
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

  async function submit() {
    const result = evaluateButtonExecution({
      action: primaryButton.action,
      elements,
      values: effectiveValues,
    })
    if (!result.allowed) {
      setBlockedKeys(result.missingFieldKeys)
      return
    }
    setBlockedKeys([])
    await submitAction.run(primaryButton.action as SubmitAction, {
      payload: { ...(joining?.values ?? {}), ...effectiveValues },
      onNavigate,
      onScopeEvent,
    })
  }

  const blockedMessage = blockedKeys.length === 0
    ? null
    : `아직 고르지 않은 것이 있습니다: ${blockedKeys
        .map(
          (key) =>
            (elements.find(
              (element) => (element.spec as { fieldKey?: string }).fieldKey === key,
            )?.spec as { label?: string } | undefined)?.label ?? key,
        )
        .join(', ')}`

  return {
    submitAction,
    setupSpec,
    listSpec,
    primaryButton,
    secondaryButtons,
    listValue,
    selectedSetup: selectValue(),
    blockedMessage,
    setSetupMode,
    setListValue,
    submit,
    onNavigate,
  }
}

export type OrganizationSetupModel = ReturnType<typeof useOrganizationSetup>
