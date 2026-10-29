import { useState } from 'react'
import { QuestionEditor } from '@/registrations/QuestionEditor'
import { draftsOf } from '@/registrations/question-draft'
import { Section } from './GallerySection'
import { sampleQuestions } from './question-samples'

function Editable() {
  const [questions, setQuestions] = useState(() => draftsOf(sampleQuestions))
  return (
    <QuestionEditor
      questions={questions}
      locked={false}
      disabled={false}
      errors={{}}
      onChange={setQuestions}
    />
  )
}

// 신청 양식 편집의 질문 목록과 질문 추가(와이어프레임 EVT-05). 카드를 누르면 설정이 펼쳐진다. 신청이 있으면 목록만 보인다.
export function QuestionEditorSection() {
  return (
    <Section title="신청 양식 질문(편집·신청 있음)">
      <div className="w-full max-w-xl">
        <Editable />
      </div>
      <div className="w-full max-w-xl">
        <QuestionEditor
          questions={draftsOf(sampleQuestions)}
          locked
          disabled={false}
          errors={{}}
          onChange={() => {}}
        />
      </div>
    </Section>
  )
}
