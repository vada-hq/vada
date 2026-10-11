import { useEffect, useId, useState } from 'react'
import { codePoints, koreanOf, REPORT_SECTION_LABELS, REPORT_SECTION_MAX, REPORT_SECTIONS, SaveEventReportSchema, type EventReportResponse,
  type EventSummary, type ReportSection, type SaveEventReportRequest } from '@vada/contracts'
import StateMessage from '@/components/StateMessage'
import { StatGrid } from '@/components/StatGrid'
import { Alert } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cardClass } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { eventTimeText, formatKoreanTime } from '../public/registration-text'
import { dayOf, factStats, ownerText, reportStateLabels, reportStateOf, reportStateTones, sectionHints, staleReportCodes } from './record-view'
import { useEventReport, type EventReportHook, type ReportResult } from './useEventReport'

type Props = {
  organizationId: string
  eventId: string
  // 부서가 있는 구성원이 쓰고, 회장단이 발행한다.
  canWrite: boolean
  canPublish: boolean
  onOpenEvent: () => void
  // 저장하지 않은 글이 있는지. 다른 화면으로 갈 때 묻는 데 쓴다.
  onDirtyChange: (dirty: boolean) => void
  // 받은 행사로 행사 목록을 바꾼다(다른 곳에서 완료를 취소했을 수 있다).
  onEvent: (event: EventSummary) => void
}

// 완료한 행사의 결과보고서(REC-02·02A). 발행 전에는 쓰는 화면, 발행 뒤에는 읽는 화면이다. 휴대폰은 한 단이다.
export default function EventReport({ organizationId, eventId, onEvent, ...props }: Props) {
  const state = useEventReport(organizationId, eventId)
  useEffect(() => { if (state.data) onEvent(state.data.event) }, [state.data, onEvent])
  if (!state.data) {
    return <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6"><div className="mx-auto max-w-3xl">
      {state.loadError ? <div className="flex flex-col items-start gap-2"><StateMessage kind="error">결과보고서를 불러오지 못했어요.</StateMessage>
        <Button variant="outline" size="sm" onClick={state.refresh}>다시 불러오기</Button></div>
        : <StateMessage kind="loading">결과보고서 불러오는 중…</StateMessage>}
    </div></div>
  }
  // 불러오기·새로 불러오기·발행·발행 취소 때만 새로 그려 입력 칸을 받은 글로 맞춘다.
  // 저장은 새로 그리지 않는다. 저장 중에 친 글과 스크롤이 남고, 실패한 저장도 쓴 글을 그대로 둔다.
  return <Loaded key={state.revision} data={state.data} state={state} {...props} />
}

type LoadedProps = Omit<Props, 'organizationId' | 'eventId' | 'onEvent'> & { data: EventReportResponse; state: EventReportHook }
type Texts = Record<ReportSection, string>
// 공백만인 칸은 빈 칸(null)이다. 앞뒤 공백은 서버가 지운다.
const blank = (value: string) => value.trim() ? value : null

function Loaded({ data, state, canWrite, canPublish, onOpenEvent, onDirtyChange }: LoadedProps) {
  const { report, facts, event } = data
  const completed = event.completedAt !== null
  const published = report?.status === 'published'
  const editable = canWrite && completed && !published
  const saved = Object.fromEntries(REPORT_SECTIONS.map(key => [key, report?.[key] ?? null])) as Record<ReportSection, string | null>
  const [form, setForm] = useState<Texts>(() => Object.fromEntries(REPORT_SECTIONS.map(key => [key, saved[key] ?? ''])) as Texts)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ text: string; stale: boolean } | null>(null)
  const [confirming, setConfirming] = useState<'publish' | 'unpublish' | null>(null)
  const prefix = useId()
  const dirty = editable && REPORT_SECTIONS.some(key => (form[key].trim() || null) !== saved[key])
  useEffect(() => { onDirtyChange(dirty) }, [dirty, onDirtyChange])
  useEffect(() => () => onDirtyChange(false), [onDirtyChange])
  const input = { version: report?.version ?? 0, ...Object.fromEntries(REPORT_SECTIONS.map(key => [key, blank(form[key])])) } as SaveEventReportRequest
  // 버튼은 서버와 같은 스키마로 켠다.
  const valid = SaveEventReportSchema.safeParse(input).success
  const written = REPORT_SECTIONS.filter(key => saved[key] !== null).length
  const reportState = reportStateOf(report)
  async function run(action: () => Promise<ReportResult>) {
    setBusy(true)
    setMessage(null)
    const result = await action()
    setBusy(false)
    setConfirming(null)
    if (!result.ok) setMessage({ text: result.message, stale: result.code === 'UNKNOWN' || (result.code !== null && staleReportCodes.has(result.code)) })
  }
  // 새로 불러오면 저장하지 않은 글이 사라지므로 먼저 묻는다.
  function reload() {
    if (dirty && !window.confirm('저장하지 않은 글이 사라져요. 새로 불러올까요?')) return
    state.refresh()
  }
  const status = dirty ? '저장하지 않은 글이 있어요.' : published ? '발행했어요.' : `다섯 칸 중 ${written}칸을 썼어요.`
  const time = [eventTimeText(facts.event.startsAt, facts.event.endsAt) ?? '날짜 미정', facts.event.place].filter(Boolean).join(' · ')
  const history = [event.completedAt && `완료 ${dayOf(event.completedAt)}`,
    report?.published ? `발행 ${dayOf(report.published.at)} · ${report.published.by.name}`
      : report && `마지막 저장 ${formatKoreanTime(koreanOf(new Date(report.updated.at)))} · ${report.updated.by.name}`].filter(Boolean).join(' · ')
  return <div className="flex min-h-0 flex-1 flex-col">
    <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6"><div className="mx-auto flex max-w-3xl flex-col gap-4">
      {!completed && <Alert tone="warning">완료를 취소한 행사예요. 다시 완료하면 이어서 쓸 수 있어요.</Alert>}
      <section aria-label="결과보고서 요약" className={cn(cardClass, 'flex flex-col gap-2 p-4')}>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={reportStateTones[reportState]}>{reportStateLabels[reportState]}</Badge>
          <Button variant="link" size="sm" className="ml-auto h-auto p-0" onClick={onOpenEvent}>행사 기록 보기</Button>
        </div>
        <p className="text-sm wrap-anywhere text-gray-700">{time}</p>
        <p className="text-sm wrap-anywhere text-gray-700">{ownerText(facts.owner) ?? '담당 미정'}</p>
        {history && <p className="text-xs wrap-anywhere text-gray-500">{history}</p>}
      </section>
      <StatGrid label="행사 결과 숫자" className="grid-cols-2 sm:grid-cols-4" stats={factStats(facts)} />
      <p className="-mt-2 text-xs text-gray-500">{published ? '발행할 때 센 숫자예요.' : '행사 기록에서 지금 센 숫자예요. 발행하면 그때 숫자로 고정돼요.'}
        {' '}지연은 마감일을 넘겨 끝냈거나 아직 끝내지 않은 업무예요.</p>
      {REPORT_SECTIONS.map(key => {
        const label = REPORT_SECTION_LABELS[key]
        return <section key={key} aria-labelledby={`${prefix}-${key}`} className={cn(cardClass, 'flex flex-col gap-2 p-4')}>
          <h3 id={`${prefix}-${key}`} className="text-sm font-semibold text-gray-900">{label}</h3>
          {editable ? <>
            <p className="text-xs text-gray-500">{sectionHints[key]}</p>
            <Textarea aria-label={label} rows={5} value={form[key]} onChange={item => {
              const value = item.target.value
              setForm(current => ({ ...current, [key]: value }))
            }} />
            {codePoints(form[key].trim()) > REPORT_SECTION_MAX && <p className="text-xs text-destructive">글이 너무 길어요. 줄여 주세요.</p>}
          </> : saved[key] ? <p className="text-sm whitespace-pre-line wrap-anywhere text-gray-700">{saved[key]}</p>
            : <p className="text-sm text-gray-400">아직 쓰지 않았어요.</p>}
        </section>
      })}
    </div></div>
    {(editable || (canPublish && published)) && <footer className="shrink-0 border-t bg-white px-4 py-3 sm:px-6">
      <div className="mx-auto flex max-w-3xl flex-col gap-2">
        {message && <div className="flex flex-wrap items-center gap-2"><StateMessage kind="error">{message.text}</StateMessage>
          {message.stale && <Button variant="outline" size="sm" onClick={reload}>새로 불러오기</Button>}</div>}
        <div className="flex flex-wrap items-center gap-2">
          <p className="min-w-0 flex-1 text-xs text-gray-600">{status}</p>
          {editable && <Button variant={canPublish ? 'outline' : 'default'} disabled={busy || !dirty || !valid}
            onClick={() => void run(() => state.save(input))}>{busy ? '저장하는 중…' : '저장'}</Button>}
          {canPublish && editable && <Button disabled={busy || dirty || !report || written < REPORT_SECTIONS.length}
            onClick={() => setConfirming('publish')}>발행</Button>}
          {canPublish && published && <Button variant="outline" disabled={busy} onClick={() => setConfirming('unpublish')}>발행 취소</Button>}
        </div>
      </div>
    </footer>}
    <Dialog open={confirming !== null} onOpenChange={open => { if (!open && !busy) setConfirming(null) }}>
      <DialogContent>
        {confirming === 'publish' ? <>
          <DialogHeader><DialogTitle>결과보고서를 발행할까요?</DialogTitle>
            <DialogDescription>발행하면 지금 숫자와 이름이 고정되고, 고치려면 발행을 취소해야 해요.</DialogDescription></DialogHeader>
          <DialogFooter><Button variant="outline" disabled={busy} onClick={() => setConfirming(null)}>닫기</Button>
            <Button disabled={busy} onClick={() => void run(() => state.publish(report!.version))}>발행</Button></DialogFooter>
        </> : <>
          <DialogHeader><DialogTitle>발행을 취소할까요?</DialogTitle>
            <DialogDescription>다시 고칠 수 있게 되고, 숫자는 발행할 때 다시 세요.</DialogDescription></DialogHeader>
          <DialogFooter><Button variant="outline" disabled={busy} onClick={() => setConfirming(null)}>닫기</Button>
            <Button disabled={busy} onClick={() => void run(() => state.unpublish(report!.version))}>발행 취소</Button></DialogFooter>
        </>}
      </DialogContent>
    </Dialog>
  </div>
}
