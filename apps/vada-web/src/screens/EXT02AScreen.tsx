import { MobileScreen } from '../components/MobileScreen'
import { ExternalSurveyFields } from './external-survey-form/ExternalSurveyFields'
import {
  BrandBar,
  ExternalSurveyHeader,
} from './external-survey-form/ExternalSurveyHeader'
import { ExternalSurveySubmit } from './external-survey-form/ExternalSurveySubmit'
import {
  useExternalSurveyForm,
  type ExternalSurveyFormProps,
} from './external-survey-form/useExternalSurveyForm'

// 참여 신청 폼(EXT-02A). 공개 링크 모델과 머리·필드·제출 영역을 조립한다.
export function EXT02AScreen(props: ExternalSurveyFormProps) {
  const model = useExternalSurveyForm(props)
  if (!model.ready) {
    return (
      <MobileScreen header={<BrandBar />}>
        <p role="alert" className="pt-6 text-sm text-red-700">
          {model.message}
        </p>
      </MobileScreen>
    )
  }
  return (
    <MobileScreen header={<ExternalSurveyHeader model={model} />}>
      <p className="pt-4 text-xs text-gray-500">{model.meta?.description}</p>
      <ExternalSurveyFields model={model} />
      <ExternalSurveySubmit model={model} />
    </MobileScreen>
  )
}
