import { useRef, useState } from 'react'
import {
  evaluateButtonExecution,
  hasFieldValue,
} from '../../../../packages/contracts/src/button-execution.mjs'
import { AppHeader } from '../components/AppHeader'
import { Field } from '../components/Field'
import { PageCard } from '../components/PageCard'
import { PrimaryButton } from '../components/PrimaryButton'
import { SearchSelect } from '../components/SearchSelect'
import { TextInput } from '../components/TextInput'
import { findButtonSpec, findInputSpec, findSelectSpec, onb01 } from '../spec/screens'
import type { SelectSpec } from '../spec/types'
import type { OnboardingDraft } from '../state/onboarding'

interface ONB01ScreenProps {
  draft: OnboardingDraft
  onChangeDraft: (next: OnboardingDraft) => void
  onNavigate: (screenId: string) => void
}

const MISSING_FIELD_MESSAGE = '필수 항목입니다'

export function ONB01Screen({ draft, onChangeDraft, onNavigate }: ONB01ScreenProps) {
  const [errors, setErrors] = useState<Record<string, string>>({})
  const fieldRefs = useRef<Record<string, HTMLElement | null>>({})

  const nameSpec = findInputSpec(onb01, 'name')
  const studentNumberSpec = findInputSpec(onb01, 'studentNumber')
  const schoolSpec = findSelectSpec(onb01, 'school')
  const collegeSpec = findSelectSpec(onb01, 'college')
  const departmentSpec = findSelectSpec(onb01, 'department')
  const currentGradeSpec = findSelectSpec(onb01, 'currentGrade')
  const nextButtonSpec = findButtonSpec(onb01)

  function setFieldValue(fieldKey: string, value: string | null, label?: string) {
    // 같은 값 재선택은 "변경"이 아니므로 resetOnChangeOf를 발동하지 않는다(F4).
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

    // resetOnChangeOf: 상위 필드가 변경되거나 지워지면 값을 초기화한다.
    // (스펙이 전이적 상위까지 나열하므로 1단계 순회로 충분하다)
    const clearedKeys = [fieldKey]
    for (const element of onb01.elements) {
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

  // enabledWhen을 생략하면 항상 활성화, 명시하면 모든 조건 충족 시 활성화.
  function isSelectEnabled(spec: SelectSpec): boolean {
    if (!spec.enabledWhen) {
      return true
    }
    return spec.enabledWhen.every((condition) =>
      hasFieldValue(draft.values[condition.fieldKey]),
    )
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

  function handleNext() {
    const result = evaluateButtonExecution({
      action: nextButtonSpec.action,
      elements: onb01.elements,
      values: draft.values,
    })

    if (result.allowed) {
      onNavigate(nextButtonSpec.action.targetScreenId)
      return
    }

    // onExecutionBlocked: showMissingRequiredFields + firstMissingField
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

  function renderSelectField(spec: SelectSpec) {
    const enabled = isSelectEnabled(spec)
    return (
      <Field
        htmlFor={spec.fieldKey}
        label={spec.label}
        required={spec.required}
        disabled={!enabled}
        error={errors[spec.fieldKey]}
      >
        <SearchSelect
          id={spec.fieldKey}
          placeholder={spec.placeholder}
          searchable={spec.searchable}
          disabled={!enabled}
          hasError={Boolean(errors[spec.fieldKey])}
          sourceKey={spec.optionsSource.key}
          sourceParams={resolveSourceParams(spec)}
          value={selectValue(spec.fieldKey)}
          onSelect={(option) => setFieldValue(spec.fieldKey, option.value, option.label)}
          triggerRef={registerRef(spec.fieldKey)}
        />
      </Field>
    )
  }

  return (
    <PageCard>
      <AppHeader step={1} totalSteps={2} />

      {/* 제목 7:18(15.75→18) · 부제 7:20(12.25→14) */}
      <h1 className="pt-6 text-lg font-semibold text-gray-900">
        내 프로필에 표시될 학적 정보를 입력해 주세요
      </h1>
      <p className="pt-1 text-sm text-gray-500">학생회 활동에 사용할 내 프로필 정보입니다.</p>

      {/* 폼 7:21: pt 21→24, 섹션 간 gap 17.5→20 */}
      <div className="flex flex-col gap-5 pt-6">
        <section className="flex flex-col gap-3">
          <h2 className="text-xs font-semibold text-gray-500">기본 프로필</h2>
          <div className="grid grid-cols-2 gap-3">
            <Field
              htmlFor={nameSpec.fieldKey}
              label={nameSpec.label}
              required={nameSpec.required}
              error={errors[nameSpec.fieldKey]}
            >
              <TextInput
                id={nameSpec.fieldKey}
                value={draft.values[nameSpec.fieldKey] ?? ''}
                placeholder={nameSpec.placeholder}
                hasError={Boolean(errors[nameSpec.fieldKey])}
                onChange={(value) =>
                  setFieldValue(nameSpec.fieldKey, value === '' ? null : value)
                }
                inputRef={registerRef(nameSpec.fieldKey)}
              />
            </Field>
            <Field
              htmlFor={studentNumberSpec.fieldKey}
              label={studentNumberSpec.label}
              required={studentNumberSpec.required}
              error={errors[studentNumberSpec.fieldKey]}
            >
              <TextInput
                id={studentNumberSpec.fieldKey}
                value={draft.values[studentNumberSpec.fieldKey] ?? ''}
                placeholder={studentNumberSpec.placeholder}
                hasError={Boolean(errors[studentNumberSpec.fieldKey])}
                onChange={(value) =>
                  setFieldValue(studentNumberSpec.fieldKey, value === '' ? null : value)
                }
                inputRef={registerRef(studentNumberSpec.fieldKey)}
              />
            </Field>
          </div>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-xs font-semibold text-gray-500">학적 정보</h2>
          {renderSelectField(schoolSpec)}
          {renderSelectField(collegeSpec)}
          {renderSelectField(departmentSpec)}
          {renderSelectField(currentGradeSpec)}
        </section>
      </div>

      {/* 버튼 7:76: pt 28→32 / 안내 7:82: pt 7→8 */}
      <div className="pt-8">
        <PrimaryButton label={nextButtonSpec.label} onClick={handleNext} />
        <p className="pt-2 text-center text-xs text-gray-400">
          다음 단계에서 학생회 시작 방식을 선택합니다.
        </p>
      </div>
    </PageCard>
  )
}
