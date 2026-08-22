import { AppHeader } from '../components/AppHeader'
import { Field } from '../components/Field'
import { PageCard } from '../components/PageCard'
import { PrimaryButton } from '../components/PrimaryButton'
import { SearchSelect } from '../components/SearchSelect'
import { TextInput } from '../components/TextInput'
import { findFlowStep } from '../spec/flows'
import { useFieldDraft } from '../spec/useFieldDraft'
import { findButtonSpec, findInputSpec, findSelectSpec, navigateTarget, onb01 } from '../spec/screens'
import type { SelectSpec } from '../spec/types'
import type { OnboardingDraft } from '../state/onboarding'

interface ONB01ScreenProps {
  draft: OnboardingDraft
  onChangeDraft: (next: OnboardingDraft) => void
  onNavigate: (screenId: string) => void
}

export function ONB01Screen({ draft, onChangeDraft, onNavigate }: ONB01ScreenProps) {
  const nameSpec = findInputSpec(onb01, 'name')
  const studentNumberSpec = findInputSpec(onb01, 'studentNumber')
  const schoolSpec = findSelectSpec(onb01, 'school')
  const collegeSpec = findSelectSpec(onb01, 'college')
  const departmentSpec = findSelectSpec(onb01, 'department')
  const currentGradeSpec = findSelectSpec(onb01, 'currentGrade')
  const nextButtonSpec = findButtonSpec(onb01)
  const meta = onb01.meta
  const flowStep = findFlowStep(onb01.screenId)

  const {
    errors,
    isSelectEnabled,
    registerRef,
    resolveSourceParams,
    runButton,
    selectValue,
    setFieldValue,
  } = useFieldDraft({ elements: onb01.elements, draft, onChangeDraft })

  function handleNext() {
    runButton(nextButtonSpec, () => onNavigate(navigateTarget(nextButtonSpec.action)))
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
          placeholder={
            enabled ? spec.placeholder : (spec.disabledPlaceholder ?? spec.placeholder)
          }
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
      {flowStep && (
        <AppHeader label={flowStep.label} step={flowStep.step} totalSteps={flowStep.total} />
      )}

      {/* 제목 7:18(15.75→18) · 부제 7:20(12.25→14) — 카피는 스펙 meta에서 온다 */}
      {meta && (
        <h1 className="pt-6 text-lg font-semibold text-gray-900">{meta.title}</h1>
      )}
      {meta?.description && (
        <p className="pt-1 text-sm text-gray-500">{meta.description}</p>
      )}

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
                type={nameSpec.inputType}
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
                type={studentNumberSpec.inputType}
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
        {meta?.footerNote && (
          <p className="pt-2 text-center text-xs text-gray-400">{meta.footerNote}</p>
        )}
      </div>
    </PageCard>
  )
}
