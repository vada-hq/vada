import { useMemo, useState } from 'react'
import { ReplaceDuesRosterSchema, type DuesRosterView, type ReplaceDuesRosterRequest } from '@vada/contracts'
import StateMessage from '@/components/StateMessage'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { problemText, semesterEnd, useUntilRange } from './fee-view'
import { parseRoster } from './roster-paste'
import type { FeeResult } from './useFeeSettings'

type Props = {
  open: boolean
  // 지금 명단. 있으면 통째로 바꾼다고 알린다.
  current: DuesRosterView | null
  // 한국 날짜
  today: string
  onClose: () => void
  onSubmit: (input: ReplaceDuesRosterRequest) => Promise<FeeResult>
}
// 미리 보기에 줄 문제를 이만큼까지 적는다.
const PROBLEMS_SHOWN = 10

// 학생회비 납부 명단 올리기(와이어프레임 ORG-07C). 파일 대신 엑셀에서 두 칸을 복사해 붙여 넣는다.
// 한글 엑셀의 CSV는 CP949라 글자가 깨지기 쉽고, xlsx를 읽으려면 큰 라이브러리가 들기 때문이다.
export default function RosterUploadDialog({ open, onClose, ...props }: Props) {
  return <Dialog open={open} onOpenChange={next => { if (!next) onClose() }}>
    {open && <DialogContent><Form onClose={onClose} {...props} /></DialogContent>}
  </Dialog>
}

function Form({ current, today, onClose, onSubmit }: Omit<Props, 'open'>) {
  const [label, setLabel] = useState('')
  const [useUntil, setUseUntil] = useState(() => semesterEnd(today))
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const parsed = useMemo(() => parseRoster(text), [text])
  const range = useUntilRange(today)
  const inRange = useUntil >= range.min && useUntil <= range.max
  const input = useMemo(() => ({ version: current?.version ?? 0, label, useUntil, members: parsed.members }),
    [current?.version, label, useUntil, parsed])
  // 버튼은 서버와 같은 스키마로 켠다. 문제 줄이 하나라도 있으면 고쳐서 다시 붙여 넣는다.
  const valid = useMemo(() => inRange && parsed.problems.length === 0 && ReplaceDuesRosterSchema.safeParse(input).success,
    [inRange, parsed, input])
  async function upload() {
    setBusy(true)
    setMessage('')
    const result = await onSubmit(input)
    setBusy(false)
    if (result.ok) onClose()
    else setMessage(result.message)
  }
  return <>
    <DialogHeader>
      <DialogTitle>학생회비 납부 명단 올리기</DialogTitle>
      <DialogDescription>엑셀에서 학번과 이름 두 칸을 골라 복사한 뒤 붙여 넣어 주세요.</DialogDescription>
    </DialogHeader>
    <div className="flex flex-col gap-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <Label className="flex flex-col gap-1.5">명단 이름
          <Input value={label} placeholder="2026년 2학기 납부자" onChange={event => setLabel(event.target.value)} /></Label>
        <Label className="flex flex-col gap-1.5">쓰는 기한
          <Input type="date" min={range.min} max={range.max} value={useUntil} onChange={event => setUseUntil(event.target.value)} /></Label>
      </div>
      {!inRange && <p className="text-xs text-destructive">쓰는 기한은 오늘부터 1년 안의 날짜로 골라 주세요.</p>}
      <Label className="flex flex-col gap-1.5">붙여 넣기
        <Textarea rows={6} value={text} placeholder={'2022123456\t김바다'} className="font-mono"
          onChange={event => setText(event.target.value)} /></Label>
      {text.trim() !== '' && <section aria-label="미리 보기" className="flex flex-col gap-1 rounded-md bg-gray-50 p-3 text-sm">
        <p className="font-medium text-gray-900">{parsed.members.length.toLocaleString('ko-KR')}명을 찾았어요</p>
        {parsed.merged > 0 && <p className="text-xs text-gray-600">같은 줄 {parsed.merged}개를 하나로 합쳤어요</p>}
        {parsed.problems.length > 0 && <ul className="flex flex-col gap-0.5 text-xs text-destructive">
          {parsed.problems.slice(0, PROBLEMS_SHOWN).map(problem =>
            <li key={problem.line}>{problem.line}번째 줄: {problemText[problem.reason]}</li>)}
          {parsed.problems.length > PROBLEMS_SHOWN && <li>그 밖에 {parsed.problems.length - PROBLEMS_SHOWN}줄</li>}
        </ul>}
      </section>}
      {current && <Alert tone="warning" className="text-sm wrap-anywhere">
        지금 명단({current.label}, {current.members.length.toLocaleString('ko-KR')}명)을 지우고 새 명단으로 바꿔요.</Alert>}
      {message && <StateMessage kind="error">{message}</StateMessage>}
    </div>
    <DialogFooter>
      <Button variant="outline" disabled={busy} onClick={onClose}>닫기</Button>
      <Button disabled={busy || !valid} onClick={() => void upload()}>{busy ? '올리는 중…' : '올리기'}</Button>
    </DialogFooter>
  </>
}
