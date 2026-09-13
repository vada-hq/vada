import { FigmaAsset } from '../../components/FigmaAsset'
import type { DataRow } from '../../data-sources/definitions'
import { MUTED_CHIP, NEUTRAL_CHIP, STATE_CHIP } from '../../design/tones'
import type { SummarySpec } from '../../spec/types'
import { ASSET, NODE, SCREEN, listAt } from './survey-spec'
import { rowsOf, scalar } from './survey-values'
import { SurveyChoiceField, type SurveyFieldProps } from './SurveyFields'

interface SurveyQuestionsProps extends SurveyFieldProps {
  questionRows: DataRow[]
  onRemove: (id: string) => void
}

// 응답이 있는 문항은 서버의 locked 값에 따라 삭제 단추와 손잡이를 다르게 표시한다.
export function SurveyQuestions({ questionRows, onRemove, values, onChangeValue }: SurveyQuestionsProps) {
  const questions = listAt(NODE.questions)
  const questionCard = questions.itemFields![0].spec as SummarySpec
  return (
    <>
      <section data-node-id={NODE.questions} className="flex flex-col gap-2.5">
        <h3 className="text-xs font-semibold text-gray-700">{questions.title}</h3>
        {questionRows.map((row, index) => {
          const locked = scalar(row, 'locked') !== ''
          return (
            <div
              key={scalar(row, 'id')}
              className="rounded-md border border-gray-200 bg-white px-3.5 py-3.5"
            >
              <span
                data-node-id={index === 0 ? NODE.questionRow : undefined}
                className="flex items-center justify-between gap-2"
              >
                <span className="flex min-w-0 items-center gap-2">
                  <FigmaAsset
                    screenId={SCREEN}
                    nodeId={locked ? ASSET.questionGripLocked : ASSET.questionGrip}
                    className="size-3.5 shrink-0"
                  />
                  <span className="text-sm font-medium text-gray-800">
                    {scalar(row, questionCard.titleField)}
                  </span>
                  {rowsOf(row, questionCard.statusField ?? '').map((badge) => (
                    <span
                      key={String(badge.label)}
                      data-design-rule="state-chip"
                      className={`shrink-0 rounded px-2 py-0.5 text-xs font-medium ${
                        STATE_CHIP[String(badge.tone)] ?? NEUTRAL_CHIP
                      }`}
                    >
                      {String(badge.label)}
                    </span>
                  ))}
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  <span className={`rounded px-2 py-0.5 text-xs font-medium ${MUTED_CHIP}`}>
                    {scalar(row, (questionCard.items ?? [])[0]?.field)}
                  </span>
                  {/* 잠긴 문항에는 지우는 자리가 그려지지 않는다. */}
                  {locked ? null : (
                    <button
                      type="button"
                      aria-label={`${scalar(row, questionCard.titleField)} ${
                        questions.itemRemove?.label ?? ''
                      }`}
                      onClick={() =>
                        onRemove(scalar(row, 'id'))
                      }
                      className="rounded p-0.5 hover:bg-gray-100"
                    >
                      <FigmaAsset
                        screenId={SCREEN}
                        nodeId={ASSET.questionRemove}
                        className="size-3"
                      />
                    </button>
                  )}
                </span>
              </span>
            </div>
          )
        })}
      </section>

      {/* 질문 추가. 무엇을 더할 수 있는지는 명세가 정한다(event.surveyQuestionTypes).
          고른 뒤 오른쪽 '질문 설정'에 무엇이 그려지는지는 그림에 없다. */}
      <div
        data-node-id={NODE.addQuestion}
        className="flex items-center justify-center gap-2 rounded-md border-2 border-gray-200 px-3.5 py-3.5"
      >
        <SurveyChoiceField nodeId={NODE.addQuestion} labelClass="text-xs font-medium text-gray-400" values={values} onChangeValue={onChangeValue} />
      </div>
    </>
  )
}
