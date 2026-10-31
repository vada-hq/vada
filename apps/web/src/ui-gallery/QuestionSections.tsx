import { useState } from 'react'
import { FeeValue } from '@/registrations/FormFee'
import { CollectSection } from '@/registrations/FormItems'
import type { FieldIds } from '@/registrations/FormSettings'
import { draftsOf } from '@/registrations/question-draft'
import { emptyFormValues, type FormValues } from '@/registrations/registration-form'
import { Section } from './GallerySection'
import { sampleQuestions } from './question-samples'

const start: FormValues = { ...emptyFormValues, questions: draftsOf(sampleQuestions) }

function Editable() {
  const [values, setValues] = useState(start)
  return (
    <CollectSection
      values={values}
      locked={false}
      errors={{}}
      onChange={patch => setValues(current => ({ ...current, ...patch }))}
    />
  )
}

// 신청 양식 편집의 받는 항목: 이름·학번·휴대폰과 질문(선택지 알약, 질문마다 •••), [질문 추가]. 신청이 있으면 질문과 참가비가 잠긴다.
export function QuestionEditorSection() {
  return (
    <Section title="신청 양식 받는 항목(편집·신청 있음)">
      <div className="w-full max-w-xl">
        <Editable />
      </div>
      <div className="w-full max-w-xl">
        <CollectSection values={start} locked errors={{}} onChange={() => {}} />
      </div>
      <div className="w-full max-w-xl">
        <FeeValue
          ids={{} as FieldIds}
          values={start}
          errors={{}}
          locked="납부자 5,000원 · 미납자 10,000원"
          onChange={() => {}}
        />
      </div>
    </Section>
  )
}
