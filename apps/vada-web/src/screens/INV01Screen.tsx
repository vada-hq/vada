import type { ReactNode } from 'react'
import { AppHeader } from '../components/AppHeader'
import { Field } from '../components/Field'
import { FieldGroup } from '../components/FieldGroup'
import { PageCard } from '../components/PageCard'
import { PrimaryButton } from '../components/PrimaryButton'
import { SearchSelect } from '../components/SearchSelect'
import { SummaryCard } from '../components/SummaryCard'
import { TextInput } from '../components/TextInput'
import { buttonsByEmphasis, inv01, navigateTarget, primaryButtonOf } from '../spec/screens'
import { useFieldDraft } from '../spec/useFieldDraft'
import type { ButtonSpec, FieldSpec, GroupSpec, SelectSpec } from '../spec/types'
import type { ScopeDraft } from '../state/scopes'

interface INV01ScreenProps {
  draft: ScopeDraft
  onChangeDraft: (next: ScopeDraft) => void
  onNavigate: (screenId: string) => void
}

export function INV01Screen({ draft, onChangeDraft, onNavigate }: INV01ScreenProps) {
  const meta = inv01.meta
  const elements = inv01.elements
  const {
    errors,
    isSelectEnabled,
    registerRef,
    resolveSourceParams,
    runButton,
    selectValue,
    setFieldValue,
  } = useFieldDraft({ elements, draft, onChangeDraft })

  const buttons = elements
    .filter((element) => element.spec.type === 'button')
    .map((element) => element.spec as ButtonSpec)
  const primaryButton = primaryButtonOf(buttons)
  const quietButtons = buttonsByEmphasis(buttons, 'quiet')

  function renderField(spec: FieldSpec): ReactNode {
    const error = errors[spec.fieldKey]

    if (spec.type === 'input') {
      return (
        <Field
          key={spec.fieldKey}
          htmlFor={spec.fieldKey}
          label={spec.label}
          required={spec.required}
          error={error}
        >
          <TextInput
            id={spec.fieldKey}
            type={spec.inputType}
            placeholder={spec.placeholder}
            hasError={Boolean(error)}
            value={typeof draft.values[spec.fieldKey] === 'string' ? draft.values[spec.fieldKey]! : ''}
            onChange={(value) => setFieldValue(spec.fieldKey, value === '' ? null : value)}
            inputRef={registerRef(spec.fieldKey)}
          />
        </Field>
      )
    }

    const enabled = isSelectEnabled(spec)
    return (
      <Field
        key={spec.fieldKey}
        htmlFor={spec.fieldKey}
        label={spec.label}
        required={spec.required}
        disabled={!enabled}
        error={error}
      >
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
      </Field>
    )
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
    if (spec.type === 'summary') {
      return <SummaryCard key={key} eyebrow={spec.eyebrow} title={spec.title} items={spec.items} />
    }
    if (spec.type === 'group') {
      return (
        <FieldGroup
          key={key}
          title={spec.title}
          description={spec.description}
          variant="outlined"
        >
          {spec.memberFieldKeys.map((fieldKey) => {
            const member = fieldByKey.get(fieldKey)
            return member ? renderField(member) : null
          })}
        </FieldGroup>
      )
    }
    if (spec.type === 'note' || spec.type === 'list') {
      // INV-01에는 없다. 등장하면 조용히 빠뜨리지 않고 명시적으로 알린다.
      throw new Error(`INV-01 구현이 아직 다루지 않는 요소 유형입니다: ${spec.type}`)
    }
    return groupedFieldKeys.has((spec as SelectSpec).fieldKey) ? null : renderField(spec as FieldSpec)
  })

  return (
    <PageCard>
      {/* 로고 14:6 — 이 화면은 흐름 진행 표시가 없다(design의 사실). */}
      <AppHeader />

      {/* 카드 14:12부터 세로로 쌓인다. 섹션 간 간격 21→pt-6. */}
      <div className="flex flex-col gap-6 pt-6">{body}</div>

      {meta?.footerNote && <p className="pt-5 text-xs text-gray-400">{meta.footerNote}</p>}

      <div className="flex flex-col gap-2 pt-4">
        <PrimaryButton
          label={primaryButton.label}
          onClick={() => runButton(primaryButton, () => onNavigate(navigateTarget(primaryButton.action)))}
        />
        {quietButtons.map((button) => (
          <button
            key={button.label}
            type="button"
            onClick={() => onNavigate(navigateTarget(button.action))}
            className="rounded px-3 py-1.5 text-xs font-medium text-gray-400 hover:bg-gray-50 focus-visible:ring-2 focus-visible:ring-blue-600/50 focus-visible:outline-none"
          >
            {button.label}
          </button>
        ))}
      </div>
    </PageCard>
  )
}
