import { useRef, useState } from 'react'
import type { ReactNode } from 'react'
import {
  evaluateButtonExecution,
  hasFieldValue,
} from '../../../../packages/contracts/src/button-execution.mjs'
import { ChoiceGroup } from '../components/ChoiceGroup'
import { Field } from '../components/Field'
import { FieldGroup } from '../components/FieldGroup'
import { FlowProgress } from '../components/FlowProgress'
import { NoteBox } from '../components/NoteBox'
import { PageCard } from '../components/PageCard'
import { PrimaryButton } from '../components/PrimaryButton'
import { SearchSelect } from '../components/SearchSelect'
import { SecondaryButton } from '../components/SecondaryButton'
import { TextInput } from '../components/TextInput'
import { findFlowStep } from '../spec/flows'
import {
  buttonsByEmphasis,
  navigateTarget,
  org01,
  primaryButtonOf,
} from '../spec/screens'
import type { ButtonSpec, FieldSpec, GroupSpec, NoteSpec, SelectSpec } from '../spec/types'
import { readScopeDisplayValue } from '../state/scopes'
import type { ScopeDraft, ScopeStore } from '../state/scopes'

interface ORG01ScreenProps {
  draft: ScopeDraft
  scopes: ScopeStore
  onChangeDraft: (next: ScopeDraft) => void
  onNavigate: (screenId: string) => void
}

const MISSING_FIELD_MESSAGE = '필수 항목입니다'

export function ORG01Screen({ draft, scopes, onChangeDraft, onNavigate }: ORG01ScreenProps) {
  const [errors, setErrors] = useState<Record<string, string>>({})
  const fieldRefs = useRef<Record<string, HTMLElement | null>>({})

  const meta = org01.meta
  const flowStep = findFlowStep(org01.screenId)
  const elements = org01.elements

  const buttons = elements
    .filter((element) => element.spec.type === 'button')
    .map((element) => element.spec as ButtonSpec)
  // 주/보조는 명세의 emphasis가 말한다. 예전에는 배열 위치로 추측했는데
  // ORG-01의 '이전'처럼 다른 흐름으로 나가는 버튼에서 근거가 없었다.
  const primaryButton = primaryButtonOf(buttons)
  const secondaryButtons = buttonsByEmphasis(buttons, 'secondary')

  function setFieldValue(fieldKey: string, value: string | null, label?: string) {
    // 같은 값 재선택은 "변경"이 아니므로 resetOnChangeOf를 발동하지 않는다.
    if ((draft.values[fieldKey] ?? null) === value) {
      if (value !== null && label !== undefined && draft.labels[fieldKey] !== label) {
        onChangeDraft({ values: draft.values, labels: { ...draft.labels, [fieldKey]: label } })
      }
      return
    }

    const values = { ...draft.values, [fieldKey]: value }
    const labels = { ...draft.labels }
    if (value !== null && label !== undefined) {
      labels[fieldKey] = label
    } else {
      delete labels[fieldKey]
    }

    const clearedKeys = [fieldKey]
    for (const element of elements) {
      const spec = element.spec
      if (spec.type === 'select' && spec.resetOnChangeOf?.includes(fieldKey)) {
        values[spec.fieldKey] = null
        delete labels[spec.fieldKey]
        clearedKeys.push(spec.fieldKey)
      }
    }

    onChangeDraft({ values, labels })
    setErrors((previous) => {
      const next = { ...previous }
      for (const key of clearedKeys) {
        delete next[key]
      }
      return next
    })
  }

  function isSelectEnabled(spec: SelectSpec): boolean {
    if (!spec.enabledWhen) {
      return true
    }
    return spec.enabledWhen.every((condition) => hasFieldValue(draft.values[condition.fieldKey]))
  }

  function resolveSourceParams(spec: SelectSpec): Record<string, string> {
    const params: Record<string, string> = {}
    for (const [param, fieldKey] of Object.entries(spec.optionsSource.params ?? {})) {
      const value = draft.values[fieldKey]
      if (typeof value === 'string') {
        params[param] = value
      }
    }
    return params
  }

  function selectValue(fieldKey: string) {
    const value = draft.values[fieldKey]
    if (typeof value !== 'string' || value.length === 0) {
      return null
    }
    return { value, label: draft.labels[fieldKey] ?? value }
  }

  function registerRef(fieldKey: string) {
    return (element: HTMLElement | null) => {
      fieldRefs.current[fieldKey] = element
    }
  }

  function handlePrimary() {
    const result = evaluateButtonExecution({
      action: primaryButton.action,
      elements,
      values: draft.values,
    })

    if (result.allowed) {
      onNavigate(navigateTarget(primaryButton.action))
      return
    }

    const nextErrors: Record<string, string> = {}
    for (const fieldKey of result.missingFieldKeys) {
      nextErrors[fieldKey] = MISSING_FIELD_MESSAGE
    }
    setErrors(nextErrors)

    const firstMissing = result.missingFieldKeys[0]
    const element = firstMissing ? fieldRefs.current[firstMissing] : null
    element?.focus()
    element?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }

  function renderField(spec: FieldSpec): ReactNode {
    const enabled = spec.type === 'select' ? isSelectEnabled(spec) : true
    const error = errors[spec.fieldKey]

    return (
      <Field
        key={spec.fieldKey}
        htmlFor={spec.fieldKey}
        label={spec.label}
        required={spec.required}
        disabled={!enabled}
        error={error}
        helperText={spec.helperText}
      >
        {spec.type === 'input' ? (
          <TextInput
            id={spec.fieldKey}
            value={draft.values[spec.fieldKey] ?? ''}
            placeholder={spec.placeholder}
            type={spec.inputType}
            hasError={Boolean(error)}
            onChange={(value) => setFieldValue(spec.fieldKey, value === '' ? null : value)}
            inputRef={registerRef(spec.fieldKey)}
          />
        ) : spec.presentation === 'choiceGroup' ? (
          <ChoiceGroup
            id={spec.fieldKey}
            disabled={!enabled}
            labelledBy={`${spec.fieldKey}-label`}
            hasError={Boolean(error)}
            sourceKey={spec.optionsSource.key}
            sourceParams={resolveSourceParams(spec)}
            value={selectValue(spec.fieldKey)}
            onSelect={(option) => setFieldValue(spec.fieldKey, option.value, option.label)}
            triggerRef={registerRef(spec.fieldKey)}
          />
        ) : (
          <SearchSelect
            id={spec.fieldKey}
            placeholder={enabled ? spec.placeholder : (spec.disabledPlaceholder ?? spec.placeholder)}
            searchable={spec.searchable}
            disabled={!enabled}
            hasError={Boolean(error)}
            sourceKey={spec.optionsSource.key}
            sourceParams={resolveSourceParams(spec)}
            value={selectValue(spec.fieldKey)}
            onSelect={(option) => setFieldValue(spec.fieldKey, option.value, option.label)}
            triggerRef={registerRef(spec.fieldKey)}
          />
        )}
      </Field>
    )
  }

  // note.fieldRefs를 표시 라벨로 풀어 separator로 잇는다. 값이 없는 참조는 생략하고,
  // 남는 것이 없으면 안내 자체를 그리지 않는다.
  function renderNote(spec: NoteSpec, key: string): ReactNode {
    const parts = spec.fieldRefs
      .map((ref) => readScopeDisplayValue(scopes, ref.scope, ref.fieldKey))
      .filter((part): part is string => part !== null)

    if (parts.length === 0) {
      return null
    }
    return <NoteBox key={key} text={`${spec.prefix ?? ''}${parts.join(spec.separator ?? ' ')}`} />
  }

  const fieldByKey = new Map(
    elements
      .filter((element) => element.spec.type === 'input' || element.spec.type === 'select')
      .map((element) => [(element.spec as FieldSpec).fieldKey, element.spec as FieldSpec]),
  )
  const groupedFieldKeys = new Set(
    elements
      .filter((element) => element.spec.type === 'group')
      .flatMap((element) => (element.spec as GroupSpec).memberFieldKeys),
  )

  // 동작 명세의 elements 순서를 그대로 따라 그린다. 묶음 멤버는 묶음 안에서만 나온다.
  const body = elements.map((element, index) => {
    const spec = element.spec
    const key = element.source.nodeId ?? String(index)

    if (spec.type === 'button') {
      return null
    }
    if (spec.type === 'note') {
      return renderNote(spec, key)
    }
    if (spec.type === 'group') {
      return (
        <FieldGroup key={key} title={spec.title} description={spec.description}>
          {spec.memberFieldKeys.map((fieldKey) => {
            const member = fieldByKey.get(fieldKey)
            return member ? renderField(member) : null
          })}
        </FieldGroup>
      )
    }
    if (spec.type === 'list' || spec.type === 'summary') {
      // ORG-01에는 없다. 등장하면 조용히 빠뜨리지 않고 명시적으로 알린다.
      throw new Error(`ORG-01 구현이 아직 다루지 않는 요소 유형입니다: ${spec.type}`)
    }
    return groupedFieldKeys.has(spec.fieldKey) ? null : renderField(spec)
  })

  return (
    <PageCard>
      {/* 헤더 14:155: 좌측 eyebrow+제목, 우측 진행 표시(로고 없음 — design의 사실) */}
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

      {/* 폼 14:166: pt 21→24, 요소 간 gap 17.5→20 */}
      <div className="flex flex-col gap-5 pt-6">{body}</div>

      {/* 하단 14:225: pt 28→32, 좌우 양끝 배치 */}
      <div className="flex items-center justify-between gap-4 pt-8">
        <div className="flex items-center gap-2">
          {secondaryButtons.map((button) => (
            <SecondaryButton
              key={button.label}
              label={button.label}
              onClick={() => onNavigate(navigateTarget(button.action))}
            />
          ))}
        </div>
        <div className="flex flex-col items-end gap-2">
          <PrimaryButton label={primaryButton.label} onClick={handlePrimary} fullWidth={false} />
          {meta?.footerNote && (
            <p className="text-right text-xs text-gray-400">{meta.footerNote}</p>
          )}
        </div>
      </div>
    </PageCard>
  )
}
