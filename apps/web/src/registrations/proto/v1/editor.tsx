import { useRef, useState } from 'react'
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Eye,
  ListChecks,
  Wallet,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { newChoice, newDraft, type QuestionDraft } from '../../question-draft'
import type { FormValues } from '../../registration-form'
import { ApplyPreview } from '../apply-preview'
import type { EditorSample } from '../builder-data'
import type { BuilderProps } from '../builder-props'
import {
  BasicFields,
  CollectFields,
  FeeFields,
  basicMissing,
  basicSummary,
  collectSummary,
  feeMissing,
  feeSummary,
} from './editor-sections'
import {
  previewTarget,
  questionKey,
  useEditor,
  useFocusFirstError,
  usePreviewFollow,
  type State,
} from './editor-state'
import { AddQuestionRow, FloatingToolbar, FoldCard } from './fold-card'
import { PhoneFrame, Sheet, Tray } from './parts'
import { QuestionCard, QuestionsLabel } from './question-card'
import { size, space, type } from './tokens'

// v1 편집기 = 회색 쟁반 위 흰 카드 더미(가운데 단) + 오른쪽 고정 휴대폰 틀(미리보기 단).
// 고친 카드 하나만 펼치고(왼쪽 강조 줄), 나머지는 한 줄 요약 + '채울 칸 n'. 오류가 있으면 오류 카드는 모두 펼친다.
// 미리보기는 편집기 form 바깥에 둔다(확정안 신청 화면이 제 form을 가진다).

function EventLine({ props }: { props: BuilderProps }) {
  const { eventText, event } = props.data
  return (
    <Sheet className={cn('flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5', space.cardX)}>
      <CalendarDays aria-hidden className="size-4 shrink-0 text-fg-subtle max-sm:hidden" />
      <p className={cn('min-w-0 flex-1 text-fg-muted max-sm:basis-full max-sm:pt-1', type.small)}>
        <span className="font-medium text-fg-secondary">{eventText.name}</span> · {eventText.when} ·{' '}
        {eventText.place}
      </p>
      {event.actions.includes('event.update') && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          touch
          className="max-sm:-ml-3 sm:-mr-2"
          onClick={() => props.onEditEvent('startsAt')}
        >
          행사 정보 고치기
          <ChevronRight aria-hidden />
        </Button>
      )}
    </Sheet>
  )
}

// 질문 복사: 같은 글·종류·필수·선택지, 이름(key)만 새로
const copyOf = (draft: QuestionDraft): QuestionDraft => ({
  ...draft,
  key: newDraft(draft.kind).key,
  choices: draft.choices.map(choice => ({ ...choice, key: newChoice(0).key })),
})

function Questions({
  editor,
  state,
  anchor,
  add,
}: {
  editor: EditorSample
  state: State
  anchor: string
  add: () => void
}) {
  const { values, set, open, toggle, errors } = state
  const questions = values.questions
  const put = (next: QuestionDraft[]) => set({ questions: next })
  const toolbar = <FloatingToolbar onAdd={add} />
  return (
    <>
      {questions.length > 0 && <QuestionsLabel count={questions.length} locked={editor.locked} />}
      {questions.map((draft, at) => (
        <QuestionCard
          key={draft.key}
          draft={draft}
          at={at}
          count={questions.length}
          open={open.has(questionKey(draft))}
          locked={editor.locked}
          errors={errors}
          onToggle={() => toggle(questionKey(draft))}
          toolbar={!editor.locked && anchor === questionKey(draft) && toolbar}
          onChange={next => put(questions.map((item, n) => (n === at ? next : item)))}
          onMove={step => {
            const next = [...questions]
            const [moved] = next.splice(at, 1)
            next.splice(at + step, 0, moved!)
            put(next)
          }}
          onCopy={() =>
            put([...questions.slice(0, at + 1), copyOf(draft), ...questions.slice(at + 1)])
          }
          onRemove={() => put(questions.filter((_, n) => n !== at))}
        />
      ))}
      {!editor.locked && <AddQuestionRow onAdd={add} />}
    </>
  )
}

function Cards({ props, state }: { props: BuilderProps; state: State }) {
  const editor = props.data.editor!
  const { values, set, errors, open, toggle, chosen } = state
  const account = editor.accounts.find(item => item.id === chosen)
  // 도구 막대는 펼친 카드를 따라간다. 펼친 카드가 없으면 받는 항목 카드 옆.
  const anchor = [...open][0] ?? 'collect'
  const add = () => {
    const draft = newDraft('single_choice')
    set({ questions: [...values.questions, draft] })
    state.setOpen(new Set([questionKey(draft)]))
  }
  const toolbar = !editor.locked && <FloatingToolbar onAdd={add} />
  const bar = (key: string) => (anchor === key ? toolbar : undefined)
  return (
    <>
      <FoldCard
        icon={<ClipboardCheck />}
        title="모집"
        summary={basicSummary(values)}
        missing={basicMissing(values)}
        open={open.has('basic')}
        onToggle={() => toggle('basic')}
        toolbar={bar('basic')}
      >
        <BasicFields values={values} errors={errors} set={set} />
      </FoldCard>
      <FoldCard
        icon={<Wallet />}
        title="참가비"
        summary={feeSummary(values, account)}
        missing={feeMissing(values, chosen)}
        open={open.has('fee')}
        onToggle={() => toggle('fee')}
        toolbar={bar('fee')}
      >
        <FeeFields
          values={values}
          errors={errors}
          set={set}
          accounts={editor.accounts}
          chosen={chosen}
          onPick={state.setChosen}
        />
      </FoldCard>
      <FoldCard
        icon={<ListChecks />}
        title="받는 항목"
        summary={collectSummary(values)}
        missing={0}
        locked={editor.locked}
        open={open.has('collect')}
        onToggle={() => toggle('collect')}
        toolbar={bar('collect')}
      >
        <CollectFields values={values} set={set} locked={editor.locked} />
      </FoldCard>
      <Questions editor={editor} state={state} anchor={anchor} add={add} />
    </>
  )
}

function MobilePreview({
  props,
  values,
  onClose,
}: {
  props: BuilderProps
  values: FormValues
  onClose: () => void
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="미리보기"
      className="fixed inset-0 z-50 flex flex-col bg-white"
    >
      <div className="flex shrink-0 items-center justify-between border-b border-border-subtle px-4 py-1">
        <h2 className={cn('text-fg', type.head)}>미리보기</h2>
        <Button variant="ghost" touch className="-mr-2" onClick={onClose}>
          <X aria-hidden />
          닫기
        </Button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <ApplyPreview
          values={values}
          event={props.data.event}
          councilName={props.data.councilName}
        />
      </div>
    </div>
  )
}

export function EditorScreen(props: BuilderProps) {
  const editor = props.data.editor!
  const state = useEditor(editor, props.onSubmit)
  const form = useRef<HTMLFormElement>(null)
  const screen = useRef<HTMLDivElement>(null)
  const [sheet, setSheet] = useState(false)
  useFocusFirstError(form, state.tries)
  usePreviewFollow(screen, previewTarget(state.open, state.values.questions))
  return (
    <div className="flex flex-col gap-2">
      <Button variant="ghost" size="sm" touch className="-ml-2 self-start" onClick={props.onBack}>
        <ChevronLeft aria-hidden />
        신청 양식 목록
      </Button>
      <Tray>
        <div className={cn('grid items-start gap-6', size.previewCol, space.columns)}>
          <form
            ref={form}
            noValidate
            aria-label={editor.title}
            className={cn('flex min-w-0 flex-col', space.stack)}
            onSubmit={event => {
              event.preventDefault()
              state.submit()
            }}
          >
            <div className="sticky top-0 z-20 -mx-1 flex items-center gap-2 bg-surface-muted px-1 py-1">
              <h2 className={cn('min-w-0 flex-1 text-fg', type.head)}>{editor.title}</h2>
              <Button
                type="button"
                variant="outline"
                touch
                className="lg:hidden"
                onClick={() => setSheet(true)}
              >
                <Eye aria-hidden />
                미리보기
              </Button>
              <Button data-measure="submit" type="submit" touch className="min-w-20">
                {editor.submit}
              </Button>
            </div>
            <EventLine props={props} />
            <Cards props={props} state={state} />
          </form>
          <aside aria-label="미리보기" className="hidden flex-col gap-2 lg:sticky lg:top-4 lg:flex">
            <p
              className={cn(
                'flex items-center gap-1.5 px-1 font-semibold text-fg-tertiary',
                type.small,
              )}
            >
              <Eye aria-hidden className="size-3.5" />
              학생 화면
            </p>
            <PhoneFrame scrollRef={screen}>
              <ApplyPreview
                values={state.values}
                event={props.data.event}
                councilName={props.data.councilName}
              />
            </PhoneFrame>
          </aside>
        </div>
      </Tray>
      {sheet && (
        <MobilePreview props={props} values={state.values} onClose={() => setSheet(false)} />
      )}
    </div>
  )
}
