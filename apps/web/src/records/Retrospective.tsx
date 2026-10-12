import { useEffect, useId, useRef, useState } from 'react'
import { codePoints, RETRO_ANSWER_MAX, RETRO_ITEMS_MAX, RETRO_SECTION_LABELS, RETRO_SECTIONS, RETRO_TEXT_MAX, SaveRetrospectiveSchema,
  type RecordTab, type RetroSection, type RetrospectiveItemView, type RetrospectiveSource, type RetrospectiveView,
  type SaveRetrospectiveRequest } from '@vada/contracts'
import StateMessage from '@/components/StateMessage'
import { Alert } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cardClass } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { koreanDay, monthDay, staleReportCodes } from './record-view'
import type { EventReportHook, ReportResult } from './useEventReport'

// 결과보고서에서 열 행사 화면. 대화 근거는 그 메시지를 찾는다.
export type OpenTarget = { tab: RecordTab; messageId?: string }
type Props = {
  retrospective: RetrospectiveView | null
  state: Pick<EventReportHook, 'generate' | 'save' | 'confirm' | 'refresh'>
  // 부서가 있는 구성원이고 행사를 완료했으면 만들고 고친다.
  canWrite: boolean
  // 참가자 탭을 볼 수 있는지(부서가 있는 구성원). 못 보면 참가 신청 근거를 누를 수 없다.
  canOpenRegistrations: boolean
  onOpen: (target: OpenTarget) => void
  // 고치는 중에 저장하지 않은 글이 있는지. 다른 화면으로 갈 때 묻는 데 쓴다.
  onDirtyChange: (dirty: boolean) => void
}
type Row = { key: string; id: string | null; text: string }
type Draft = Record<RetroSection, Row[]> & { questions: { id: string; text: string; answer: string }[] }
type Busy = 'generate' | 'save' | 'confirm' | null
type SourceProps = { canOpenRegistrations: boolean; onOpen: (target: OpenTarget) => void }

const rowsOf = (items: RetrospectiveItemView[]): Row[] => items.map(item => ({ key: item.id, id: item.id, text: item.text }))
const draftOf = (view: RetrospectiveView): Draft => ({ wentWell: rowsOf(view.wentWell), shortfalls: rowsOf(view.shortfalls), nextTime: rowsOf(view.nextTime),
  questions: view.questions.map(question => ({ id: question.id, text: question.text, answer: question.answer ?? '' })) })
// 빈 문장은 저장할 때 뺀다. 빈 답은 답이 없는 것(null)이다.
function inputOf(draft: Draft, version: number): SaveRetrospectiveRequest {
  const sentences = (rows: Row[]) => rows.filter(row => row.text.trim()).map(({ id, text }) => ({ id, text }))
  return { version, wentWell: sentences(draft.wentWell), shortfalls: sentences(draft.shortfalls), nextTime: sentences(draft.nextTime),
    questions: draft.questions.map(question => ({ id: question.id, answer: question.answer.trim() ? question.answer : null })) }
}
const loading = '끼룩이가 정리하는 중… 1분쯤 걸릴 수 있어요.'
const tooLong = '글이 너무 길어요. 줄여 주세요.'

// 근거: 대화는 원문 일부를 누르면 그 메시지로, 준비 과정 줄은 칩을 누르면 그 탭으로 간다. 숫자·바뀐 기록은 누르지 않는다.
function Sources({ sources, canOpenRegistrations, onOpen }: { sources: RetrospectiveSource[] } & SourceProps) {
  if (!sources.length) return null
  return <ul aria-label="근거" className="mt-1 flex flex-wrap items-center gap-1.5">{sources.map((source, index) => {
    if (source.kind === 'message') {
      return <li key={index}><Button variant="link" size="sm" className="h-auto p-0 text-left whitespace-normal wrap-anywhere"
        onClick={() => onOpen({ tab: 'chat', messageId: source.messageId })}>“{source.excerpt}” · {monthDay(koreanDay(source.at))}</Button></li>
    }
    const tab = source.kind === 'entry' && source.tab && (source.tab !== 'registrations' || canOpenRegistrations) ? source.tab : null
    const label = source.kind === 'missing' ? '바뀐 기록' : source.text
    return <li key={index}>{tab
      ? <Button variant="outline" size="sm" className="h-auto py-0.5 text-left whitespace-normal wrap-anywhere" onClick={() => onOpen({ tab })}>{label}</Button>
      : <Badge tone="neutral" className="wrap-anywhere">{label}</Badge>}</li>
  })}</ul>
}

function Sentences({ title, items, ...sourceProps }: { title: string; items: RetrospectiveItemView[] } & SourceProps) {
  return <div className="flex flex-col gap-1.5">
    <h4 className="text-xs font-semibold text-gray-500">{title}</h4>
    <ul className="flex list-disc flex-col gap-2 pl-5">{items.map(item => <li key={item.id} className="text-sm text-gray-800">
      <p className="wrap-anywhere">{item.text}</p>
      <Sources sources={item.sources} {...sourceProps} />
    </li>)}</ul>
  </div>
}

// 결과보고서의 회고(M5c). 끼룩이 초안이고 확인하기 전까지 초안으로 보인다. 만들기·확인·고치기는 모두 선택이다.
export default function Retrospective({ retrospective, state, canWrite, canOpenRegistrations, onOpen, onDirtyChange }: Props) {
  const heading = useId()
  const added = useRef(0)
  const [busy, setBusy] = useState<Busy>(null)
  const [message, setMessage] = useState<{ text: string; stale: boolean } | null>(null)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [regenerating, setRegenerating] = useState(false)
  const version = retrospective?.version ?? 0
  const input = draft && inputOf(draft, version)
  const valid = input !== null && SaveRetrospectiveSchema.safeParse(input).success
  const dirty = Boolean(retrospective && input && JSON.stringify(input) !== JSON.stringify(inputOf(draftOf(retrospective), version)))
  useEffect(() => { onDirtyChange(dirty) }, [dirty, onDirtyChange])
  useEffect(() => () => onDirtyChange(false), [onDirtyChange])
  async function run(kind: NonNullable<Busy>, action: () => Promise<ReportResult>) {
    setBusy(kind)
    setMessage(null)
    setRegenerating(false)
    const result = await action()
    setBusy(null)
    if (!result.ok) setMessage({ text: result.message, stale: result.code !== null && staleReportCodes.has(result.code) })
  }
  // 새로 불러오면 고친 글이 사라지므로 먼저 묻는다.
  function reload() {
    if (dirty && !window.confirm('저장하지 않은 회고가 있어요. 새로 불러오면 고친 내용이 사라져요. 새로 불러올까요?')) return
    state.refresh()
  }
  const change = (update: (current: Draft) => Draft) => setDraft(current => current && update(current))
  const setRows = (key: RetroSection, update: (rows: Row[]) => Row[]) => change(current => ({ ...current, [key]: update(current[key]) }))
  const sourceProps = { canOpenRegistrations, onOpen }
  const empty = retrospective !== null && RETRO_SECTIONS.every(key => !retrospective[key].length) && !retrospective.questions.length
  return <section aria-labelledby={heading} className={cn(cardClass, 'flex flex-col gap-3 p-4')}>
    <div className="flex flex-wrap items-center gap-2">
      <h3 id={heading} className="text-sm font-semibold text-gray-900">회고</h3>
      {retrospective && <Badge tone={retrospective.confirmed ? 'success' : 'warning'}>{retrospective.confirmed ? '확인함' : '초안'}</Badge>}
    </div>
    {!retrospective ? canWrite ? <>
      <p className="text-sm text-gray-700">끼룩이가 이 행사의 대화와 기록을 읽고 잘된 점·아쉬운 점·다음 행사에서 할 일을 정리해요. 확인하기 전까지는 초안이에요.</p>
      <p className="text-xs text-gray-500">대화와 기록은 OpenAI로 보내요. 신청자 정보는 보내지 않아요.</p>
      {busy === 'generate' ? <StateMessage kind="loading">{loading}</StateMessage>
        : <div><Button disabled={busy !== null} onClick={() => void run('generate', () => state.generate(0))}>회고 초안 만들기</Button></div>}
    </> : <p className="text-sm text-gray-400">아직 회고가 없어요.</p>
    : draft ? <form className="flex flex-col gap-4" onSubmit={submit => {
      submit.preventDefault()
      if (input && valid) void run('save', () => state.save(input))
    }}>
      {RETRO_SECTIONS.map(key => <fieldset key={key} className="flex flex-col gap-2">
        <legend className="mb-1 text-xs font-semibold text-gray-500">{RETRO_SECTION_LABELS[key]}</legend>
        {draft[key].map((row, index) => <div key={row.key} className="flex flex-col gap-1">
          <div className="flex items-start gap-2">
            <Textarea aria-label={`${RETRO_SECTION_LABELS[key]} ${index + 1}`} rows={2} value={row.text} onChange={field => {
              const value = field.target.value
              setRows(key, rows => rows.map(item => item.key === row.key ? { ...item, text: value } : item))
            }} />
            <Button type="button" variant="ghost" size="sm" aria-label={`${RETRO_SECTION_LABELS[key]} ${index + 1} 지우기`}
              onClick={() => setRows(key, rows => rows.filter(item => item.key !== row.key))}>지우기</Button>
          </div>
          {codePoints(row.text.trim()) > RETRO_TEXT_MAX && <p className="text-xs text-destructive">{tooLong}</p>}
        </div>)}
        {draft[key].length < RETRO_ITEMS_MAX && <div><Button type="button" variant="outline" size="sm"
          onClick={() => setRows(key, rows => [...rows, { key: `new-${added.current++}`, id: null, text: '' }])}>문장 더하기</Button></div>}
      </fieldset>)}
      {draft.questions.length > 0 && <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-xs font-semibold text-gray-500">확인 필요</legend>
        {draft.questions.map(question => <div key={question.id} className="flex flex-col gap-1">
          <p className="text-sm wrap-anywhere text-gray-800">{question.text}</p>
          <div className="flex items-start gap-2">
            <Textarea aria-label={`답: ${question.text}`} rows={2} value={question.answer} onChange={field => {
              const value = field.target.value
              change(current => ({ ...current, questions: current.questions.map(item => item.id === question.id ? { ...item, answer: value } : item) }))
            }} />
            <Button type="button" variant="ghost" size="sm" aria-label={`질문 지우기: ${question.text}`}
              onClick={() => change(current => ({ ...current, questions: current.questions.filter(item => item.id !== question.id) }))}>지우기</Button>
          </div>
          {codePoints(question.answer.trim()) > RETRO_ANSWER_MAX && <p className="text-xs text-destructive">{tooLong}</p>}
        </div>)}
      </fieldset>}
      <div className="flex flex-wrap justify-end gap-2">
        <Button type="button" variant="outline" disabled={busy !== null} onClick={() => setDraft(null)}>취소</Button>
        <Button type="submit" disabled={busy !== null || !valid}>{busy === 'save' ? '저장하는 중…' : '저장하고 확인'}</Button>
      </div>
    </form> : <>
      <p className="text-xs text-gray-500">{retrospective.confirmed
        ? `${retrospective.confirmed.by.name} 님이 ${monthDay(koreanDay(retrospective.confirmed.at))}에 확인했어요.`
        : `끼룩이가 ${monthDay(koreanDay(retrospective.generated.at))}에 만든 초안이에요. 확인하기 전까지 초안으로 보여요.`}</p>
      {retrospective.stale && <Alert tone="warning">초안을 만든 뒤 완료를 다시 했어요. 행사 기록이 바뀌었을 수 있어요.</Alert>}
      {empty ? <p className="text-sm text-gray-500">끼룩이가 근거로 정리할 내용을 찾지 못했어요.</p> : <>
        {RETRO_SECTIONS.filter(key => retrospective[key].length > 0).map(key =>
          <Sentences key={key} title={RETRO_SECTION_LABELS[key]} items={retrospective[key]} {...sourceProps} />)}
        {retrospective.questions.length > 0 && <div className="flex flex-col gap-1.5">
          <h4 className="text-xs font-semibold text-gray-500">확인 필요</h4>
          <ul className="flex flex-col gap-2">{retrospective.questions.map(question => <li key={question.id} className="text-sm text-gray-800">
            <p className="wrap-anywhere">{question.text}</p>
            <Sources sources={question.sources} {...sourceProps} />
            <p className={cn('mt-1 wrap-anywhere', question.answer ? 'text-gray-700' : 'text-gray-400')}>
              {question.answer ? `답: ${question.answer}` : '아직 답이 없어요.'}</p>
          </li>)}</ul>
        </div>}
      </>}
      {busy === 'generate' && <StateMessage kind="loading">{loading}</StateMessage>}
      {canWrite && <div className="flex flex-wrap gap-2">
        {!retrospective.confirmed && <Button disabled={busy !== null} onClick={() => void run('confirm', () => state.confirm(retrospective.version))}>
          {busy === 'confirm' ? '확인하는 중…' : '확인'}</Button>}
        <Button variant="outline" disabled={busy !== null} onClick={() => { setMessage(null); setDraft(draftOf(retrospective)) }}>고치기</Button>
        <Button variant="outline" disabled={busy !== null} onClick={() => setRegenerating(true)}>다시 만들기</Button>
      </div>}
    </>}
    {message && <div className="flex flex-wrap items-center gap-2"><StateMessage kind="error">{message.text}</StateMessage>
      {message.stale && <Button variant="outline" size="sm" onClick={reload}>새로 불러오기</Button>}</div>}
    <Dialog open={regenerating} onOpenChange={open => { if (!open) setRegenerating(false) }}>
      <DialogContent>
        <DialogHeader><DialogTitle>다시 만들까요?</DialogTitle>
          <DialogDescription>지금 회고(고친 문장·답·확인)는 지워지고 새 초안이 돼요.</DialogDescription></DialogHeader>
        <DialogFooter><Button variant="outline" onClick={() => setRegenerating(false)}>닫기</Button>
          <Button onClick={() => void run('generate', () => state.generate(version))}>다시 만들기</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  </section>
}
