import { useState } from 'react'
import { Plus } from 'lucide-react'
import {
  FORM_QUESTION_MAX,
  QUESTION_KIND_LABELS,
  QUESTION_KINDS,
  type QuestionKind,
} from '@vada/contracts'
import { Button } from '@/components/ui/button'
import type { FieldErrors } from '@/lib/use-form-check'
import { LockNote, Switch, TextAction } from './DocParts'
import { size, type } from './doc-look'
import { Question } from './FormQuestion'
import type { Change } from './FormSettings'
import { newDraft, type QuestionDraft } from './question-draft'
import { collectsStudentId, type FormValues } from './registration-form'

// 받는 항목 = 설정 모양: 이름·학번·휴대폰 한 줄씩과 질문 목록, [질문 추가](누르면 종류 알약 셋).
// 이름은 늘 받는다. 학번은 납부자 금액이 다르면 꼭 받는다(납부자 명단과 맞춘다, DEC-67). 휴대폰은 받을 때만(DEC-75).
// 신청이 있으면 질문만 잠긴다(서버 409). 잠기면 [질문 추가] 자리에 까닭이 남는다. 학번·휴대폰 받기는 서버가 바꾸게 두므로 화면도 막지 않는다.

const BASIC_TEXT = `${type.body} font-semibold`

function BasicItem({
  label,
  on,
  lock,
  onToggle,
}: {
  label: string
  on: boolean
  lock?: string | undefined
  onToggle?: (on: boolean) => void
}) {
  return (
    <div className={`flex ${size.row} items-center justify-between gap-3`}>
      <span className={on ? `${BASIC_TEXT} text-fg-body` : `${BASIC_TEXT} text-fg-muted`}>
        {label}
        {!on && <span className={`ml-1.5 ${type.small} font-normal`}>받지 않음</span>}
      </span>
      {lock || !onToggle ? (
        <LockNote>{lock}</LockNote>
      ) : (
        // 켜기 끄기 앞에 '받기'를 늘 둔다(검토 지적: 이름 없는 토글이 받기인지 필수인지 모름).
        <span className={`inline-flex items-center gap-1 ${type.small} text-fg-secondary`}>
          받기
          <Switch on={on} label={`${label} 받기`} onChange={onToggle} />
        </span>
      )}
    </div>
  )
}

function AddQuestion({ onAdd }: { onAdd: (kind: QuestionKind) => void }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="-ml-2 flex flex-wrap items-center gap-1">
      <TextAction icon={Plus} aria-expanded={open} onClick={() => setOpen(value => !value)}>
        질문 추가
      </TextAction>
      {open &&
        QUESTION_KINDS.map(kind => (
          <Button
            key={kind}
            type="button"
            variant="secondary"
            onClick={() => {
              onAdd(kind)
              setOpen(false)
            }}
            className={`${size.hit} rounded-full bg-surface-muted px-3 py-0 ${type.body} font-normal text-fg-secondary hover:bg-muted-strong pointer-coarse:px-4`}
          >
            {QUESTION_KIND_LABELS[kind]}
          </Button>
        ))}
    </div>
  )
}

export function CollectSection({
  values,
  locked,
  errors,
  onChange,
}: {
  values: FormValues
  // 신청이 한 명이라도 있다(질문을 바꾸지 않는다).
  locked: boolean
  errors: FieldErrors
  onChange: Change
}) {
  const { questions } = values
  const setQuestions = (next: QuestionDraft[]) => onChange({ questions: next })
  const set = (at: number) => (draft: QuestionDraft) =>
    setQuestions(questions.map((question, index) => (index === at ? draft : question)))
  const move = (at: number, by: number) => {
    const next = [...questions]
    const [picked] = next.splice(at, 1)
    if (picked) next.splice(at + by, 0, picked)
    setQuestions(next)
  }
  const remove = (at: number) => setQuestions(questions.filter((_, index) => index !== at))
  return (
    <section aria-label="받는 항목" className="flex flex-col gap-5">
      <div className="flex items-center gap-3">
        <h3 className={`${type.small} font-semibold text-fg-muted`}>받는 항목</h3>
        <div aria-hidden="true" className="h-px flex-1 bg-border-default" />
      </div>
      <div className="flex flex-col">
        <BasicItem label="이름" on lock="늘 받음" />
        <BasicItem
          label="학번"
          on={collectsStudentId(values)}
          lock={values.feeKind === 'split' ? '학생회비 납부 확인에 필요' : undefined}
          onToggle={on => onChange({ collectsStudentId: on })}
        />
        <BasicItem
          label="휴대폰 번호"
          on={values.collectsPhone}
          onToggle={on => onChange({ collectsPhone: on })}
        />
      </div>
      {questions.map((draft, at) => (
        <Question
          key={draft.key}
          draft={draft}
          at={at}
          count={questions.length}
          locked={locked}
          errors={errors}
          set={set(at)}
          move={move}
          remove={remove}
        />
      ))}
      {/* 잠기면 [질문 추가]를 말없이 빼지 않고 그 자리에 까닭을 둔다(질문이 0개면 기능이 빠진 것처럼 보였다). */}
      {locked ? (
        <LockNote>
          {questions.length > 0
            ? '신청이 있어 질문을 바꾸거나 더할 수 없어요'
            : '신청이 있어 질문을 더할 수 없어요'}
        </LockNote>
      ) : (
        questions.length < FORM_QUESTION_MAX && (
          <AddQuestion onAdd={kind => setQuestions([...questions, newDraft(kind)])} />
        )
      )}
    </section>
  )
}
