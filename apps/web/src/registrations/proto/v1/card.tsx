import { useState } from 'react'
import { ChevronDown, ClipboardList, Eye, Pause, Pencil, Play, Plus, ScanLine } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { valuesOfForm } from '../../registration-form'
import { ApplyPreview } from '../apply-preview'
import type { CardForm } from '../builder-data'
import type { BuilderProps } from '../builder-props'
import { DraftBody } from './card-draft'
import { LiveBody } from './card-live'
import {
  BAND,
  IconCircle,
  LockedLine,
  PhoneFrame,
  Sheet,
  StatusPill,
  Tray,
  toneOf,
  useToast,
  type Tone,
} from './parts'
import { radius, size, space, type } from './tokens'

// v1 양식 카드: 쟁반 위 흰 카드 한 장. 윗변 상태색 띠 + 머리 줄(알약·이름·[미리보기]·[고치기]).
// 초안은 막힌 이유 한 문장 + 체크 줄 넷(b13·b14) + [설문 링크 활성화], 받는 중이면 신청 수 + 링크 줄 + QR 썸네일.
// 받는 항목은 늘 맨 아래 접힌 한 줄.

type CardProps = BuilderProps & { item: CardForm; toast: (text: string) => void }

function Head({
  item,
  props,
  onPreview,
}: {
  item: CardForm
  props: BuilderProps
  onPreview: () => void
}) {
  const { form, text } = item
  return (
    <div className={cn('flex flex-wrap items-center gap-x-3 gap-y-1 pt-4 pb-3', space.cardX)}>
      <div className="flex min-w-0 flex-1 items-center gap-2.5 max-sm:basis-full">
        <StatusPill status={text.status} />
        <h3 className={cn('min-w-0 text-fg wrap-anywhere', type.head)}>{text.name}</h3>
      </div>
      <div className="flex items-center max-sm:-ml-3 sm:-mr-2">
        <Button variant="ghost" touch onClick={onPreview}>
          <Eye aria-hidden />
          미리보기
        </Button>
        {form.actions.includes('form.update') && (
          <Button variant="ghost" touch onClick={() => props.onEdit(form.id)}>
            <Pencil aria-hidden />
            고치기
          </Button>
        )}
      </div>
    </div>
  )
}
function Collected({ item }: { item: CardForm }) {
  const [open, setOpen] = useState(false)
  const { text } = item
  return (
    <div className="min-w-0 flex-1">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className={cn(
          'flex min-h-11 w-full cursor-pointer items-center gap-2 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
          type.body,
        )}
      >
        <span className="shrink-0 font-medium text-fg-secondary">받는 항목</span>
        <span className="min-w-0 text-fg-muted sm:truncate">{text.collected}</span>
        <ChevronDown
          aria-hidden
          className={cn(
            'size-4 shrink-0 text-fg-subtle transition-transform',
            open && 'rotate-180',
          )}
        />
      </button>
      {open && (
        <div className="flex flex-col gap-2 pb-3">
          <ol className="flex flex-col">
            {text.items.map(entry => (
              <li key={entry.label} className={cn('flex justify-between gap-3 py-1.5', type.body)}>
                <span className="text-fg-body">{entry.label}</span>
                <span className={cn('text-fg-muted', type.small)}>
                  {[entry.kind, entry.required ? '필수' : '선택'].filter(Boolean).join(' · ')}
                </span>
              </li>
            ))}
          </ol>
          {text.locked && <LockedLine>신청이 있어 항목은 바꿀 수 없어요</LockedLine>}
        </div>
      )}
    </div>
  )
}

// 맨 아래 띠: 받는 항목 접힌 한 줄 + 받기 행동(활성 [멈추기] 글자 버튼, 멈춤 [다시 받기] 주 버튼)
function Foot({ item, tone, props }: { item: CardForm; tone: Tone; props: BuilderProps }) {
  const { form } = item
  const canPause = tone === 'open' && form.actions.includes('form.pause')
  const canResume = tone === 'paused' && form.actions.includes('form.resume')
  return (
    <div
      className={cn(
        'flex flex-wrap items-start gap-x-3 border-t border-border-subtle py-1',
        space.cardX,
      )}
    >
      <Collected item={item} />
      {canPause && (
        <Button variant="ghost" touch className="-mr-2 mt-1" onClick={() => props.onPause(form.id)}>
          <Pause aria-hidden />
          멈추기
        </Button>
      )}
      {canResume && (
        <Button
          touch
          className="mt-1 max-sm:mb-2 max-sm:w-full"
          onClick={() => props.onResume(form.id)}
        >
          <Play aria-hidden />
          다시 받기
        </Button>
      )}
    </div>
  )
}

function PreviewDialog({
  item,
  props,
  open,
  onOpenChange,
}: {
  item: CardForm
  props: BuilderProps
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm gap-4">
        <DialogHeader>
          <DialogTitle>미리보기</DialogTitle>
        </DialogHeader>
        <PhoneFrame>
          <ApplyPreview
            values={valuesOfForm(item.form)}
            event={props.data.event}
            councilName={props.data.councilName}
          />
        </PhoneFrame>
      </DialogContent>
    </Dialog>
  )
}

function FormCard(props: CardProps) {
  const { item, toast } = props
  const [preview, setPreview] = useState(false)
  const draft = item.form.paused && item.form.applicantCount === 0
  const tone = toneOf(item.text.status)
  const openPreview = () => {
    props.onPreview(item.form.id)
    setPreview(true)
  }
  return (
    <Sheet className="overflow-hidden">
      <div aria-hidden className={cn(size.band, BAND[tone])} />
      <Head item={item} props={props} onPreview={openPreview} />
      {draft ? (
        <DraftBody item={item} props={props} />
      ) : (
        <LiveBody item={item} tone={tone} props={props} toast={toast} />
      )}
      <Foot item={item} tone={tone} props={props} />
      <PreviewDialog item={item} props={props} open={preview} onOpenChange={setPreview} />
    </Sheet>
  )
}

function Toolbar(props: BuilderProps) {
  const creatable = props.data.listActions.includes('form.create')
  const scannable = props.data.forms.some(item => item.form.actions.includes('form.check_in'))
  return (
    <div className="flex flex-wrap gap-2">
      {creatable && (
        <Button variant="outline" touch onClick={props.onCreate}>
          <Plus aria-hidden />
          참여 설문 만들기
        </Button>
      )}
      {scannable && (
        <Button variant="outline" touch onClick={props.onScan}>
          <ScanLine aria-hidden />
          QR로 출석 확인
        </Button>
      )}
    </div>
  )
}

// 빈 상태: 쟁반 위 점선 카드 자리 하나(카드가 쌓일 자리) + [참여 설문 만들기]
export function EmptyScreen(props: BuilderProps) {
  return (
    <Tray>
      <div
        className={cn(
          'flex min-h-64 flex-col items-center justify-center gap-4 border-2 border-dashed border-border-strong bg-white p-6 text-center',
          radius.card,
        )}
      >
        <IconCircle>
          <ClipboardList />
        </IconCircle>
        <h3 className={cn('text-fg', type.head)}>신청 양식 없음</h3>
        {props.data.listActions.includes('form.create') && (
          <Button touch onClick={props.onCreate}>
            <Plus aria-hidden />
            참여 설문 만들기
          </Button>
        )}
      </div>
    </Tray>
  )
}

export function CardScreen(props: BuilderProps) {
  const { show, toast } = useToast()
  if (props.data.forms.length === 0) return <EmptyScreen {...props} />
  return (
    <div className="flex flex-col gap-3">
      <Toolbar {...props} />
      <Tray className={cn('flex flex-col', space.stack)}>
        {props.data.forms.map(item => (
          <FormCard key={item.form.id} {...props} item={item} toast={show} />
        ))}
      </Tray>
      {toast}
    </div>
  )
}
