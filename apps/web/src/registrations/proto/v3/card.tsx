import { useRef, useState } from 'react'
import {
  ChevronDown,
  Eye,
  Link2,
  ListChecks,
  Lock,
  Pause,
  Pencil,
  Play,
  Plus,
  QrCode,
  ScanLine,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { copyText } from '@/lib/copy-text'
import { cn } from '@/lib/utils'
import type { CardForm } from '../builder-data'
import type { BuilderProps } from '../builder-props'
import { MissingTile, QrTile, type Phase } from './card-tiles'
import { IconCircle, StatePill, TinyPill } from './parts'
import { BIG_NUMBER, BUNDLE_RADIUS, QR_COL, TRAY_RADIUS } from './tokens'

// 양식 카드 = 회색 쟁반 안 흰 묶음 하나를 가로 두 칸으로 나눈다(390은 세로로 쌓음).
// 왼쪽 칸: 상태 알약 + 이름 → 큰 신청 수 → 링크 줄 → 글자 행동. 오른쪽 칸: QR 자리(초안은 점선 칸 안 '열기 전 채울 것').
// 받는 항목은 묶음 아래 띠 한 줄(접힘). 초안은 묶음 아래 꽉 찬 [설문 링크 활성화].

function phaseOf({ form }: CardForm): Phase {
  if (form.status === 'closed') return 'ended'
  if (!form.paused) return 'active'
  return form.applicantCount === 0 ? 'draft' : 'paused'
}

const PILL_TONE = {
  draft: 'neutral',
  active: 'success',
  paused: 'warning',
  ended: 'neutral',
} as const

// 큰 숫자: 신청 수. 출석은 행사 당일부터 뜻이 있어 0이면 숨긴다(명세 3절).
function Count({ item, phase }: { item: CardForm; phase: Phase }) {
  const { form } = item
  if (phase === 'draft')
    return <p className="flex h-10 items-end text-lg font-semibold text-fg-muted">신청 받기 전</p>
  const rest = [
    form.capacity === null ? '명 신청' : `/ ${form.capacity}명 신청`,
    form.attendedCount > 0 ? `출석 ${form.attendedCount}명` : null,
  ]
  return (
    <p className="flex flex-wrap items-baseline gap-x-2">
      <span className={cn('leading-10 font-bold text-fg tabular-nums', BIG_NUMBER)}>
        {form.applicantCount}
      </span>
      <span className="text-sm text-fg-tertiary">{rest.filter(Boolean).join(' · ')}</span>
    </p>
  )
}

function LinkRow({ item, phase, props }: { item: CardForm; phase: Phase; props: BuilderProps }) {
  const [copied, setCopied] = useState(false)
  const link = item.text.link
  if (!link) return null
  return (
    <div className="flex items-center gap-2 rounded-lg bg-surface-subtle py-1 pr-1 pl-3 max-sm:flex-col max-sm:items-stretch max-sm:p-2">
      <span className="flex min-w-0 grow items-center gap-2 text-sm text-fg-secondary">
        <Link2 aria-hidden className="size-4 shrink-0 text-fg-muted" />
        <span className="truncate">{link.replace('https://', '')}</span>
      </span>
      <Button
        variant={phase === 'active' ? 'default' : 'outline'}
        touch
        data-measure="copy-link"
        onClick={() => {
          props.onCopy(item.form.id, link)
          void copyText(link).then(setCopied)
        }}
      >
        {copied ? '복사했어요' : '링크 복사'}
      </Button>
    </div>
  )
}

// 글자 행동 줄: 테두리 없는 버튼. 주 행동이 [다시 받기]인 잠시 멈춤만 앞에 꽉 찬 버튼을 둔다.
function Actions({ item, phase, props }: { item: CardForm; phase: Phase; props: BuilderProps }) {
  const { form } = item
  const can = (action: (typeof form.actions)[number]) => form.actions.includes(action)
  const text = 'text-fg-secondary max-sm:px-2'
  return (
    <div className="-ml-2 flex flex-wrap items-center gap-1">
      {phase === 'paused' && can('form.resume') && (
        <Button touch className="mr-2 ml-2" onClick={() => props.onResume(form.id)}>
          <Play aria-hidden />
          다시 받기
        </Button>
      )}
      <Button variant="ghost" touch className={text} onClick={() => props.onPreview(form.id)}>
        <Eye aria-hidden />
        미리보기
      </Button>
      {can('form.update') && (
        <Button variant="ghost" touch className={text} onClick={() => props.onEdit(form.id)}>
          <Pencil aria-hidden />
          고치기
        </Button>
      )}
      {phase === 'active' && can('form.pause') && (
        <Button variant="ghost" touch className={text} onClick={() => props.onPause(form.id)}>
          <Pause aria-hidden />
          멈추기
        </Button>
      )}
    </div>
  )
}

function ItemsBand({ item }: { item: CardForm }) {
  const [open, setOpen] = useState(false)
  const { text } = item
  return (
    <div className="flex flex-col">
      <Button
        variant="ghost"
        touch
        aria-expanded={open}
        className="h-auto min-h-11 justify-start gap-3 rounded-lg px-3 py-2 text-left whitespace-normal text-fg hover:bg-muted-strong/60"
        onClick={() => setOpen(!open)}
      >
        <ListChecks aria-hidden className="text-fg-tertiary" />
        <span className="shrink-0 text-sm font-semibold">받는 항목</span>
        <span className="min-w-0 grow truncate text-sm font-normal text-fg-tertiary">
          {text.collected}
        </span>
        {text.locked && (
          <TinyPill>
            <Lock aria-hidden className="size-3" />
            잠김
          </TinyPill>
        )}
        <ChevronDown aria-hidden className={cn('text-fg-muted', open && 'rotate-180')} />
      </Button>
      {open && (
        <div className="flex flex-col gap-2 px-3 pt-1 pb-3">
          {text.locked && (
            <p className="text-xs text-fg-tertiary">신청이 있어 항목은 바꿀 수 없어요</p>
          )}
          <ul className="grid gap-x-6 gap-y-1.5 sm:grid-cols-2">
            {text.items.map(row => (
              <li key={row.label} className="flex items-center gap-2 text-sm text-fg-secondary">
                <span className="min-w-0 truncate">{row.label}</span>
                {row.kind && <span className="text-xs text-fg-tertiary">{row.kind}</span>}
                {row.required && <TinyPill>필수</TinyPill>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

function Activate({ item, props }: { item: CardForm; props: BuilderProps }) {
  const [blocked, setBlocked] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  if (!item.form.actions.includes('form.activate')) return null
  const ready = item.conditions.every(condition => condition.done)
  return (
    <div ref={ref} className="flex flex-col gap-1.5">
      <Button
        variant={ready ? 'default' : 'outline'}
        touch
        className="h-11 w-full"
        onClick={() => {
          if (ready) return props.onActivate(item.form.id)
          setBlocked(true)
          ref.current?.closest('section')?.querySelector<HTMLElement>('[data-fill]')?.focus()
        }}
      >
        설문 링크 활성화
      </Button>
      {blocked && !ready && (
        <p role="alert" className="text-center text-xs text-danger-emphasis">
          열기 전 채울 것을 먼저 채워 주세요
        </p>
      )}
    </div>
  )
}

function FormTray({ item, props }: { item: CardForm; props: BuilderProps }) {
  const phase = phaseOf(item)
  return (
    <section
      aria-label={item.text.name}
      className={cn('flex flex-col gap-1 bg-surface-muted p-2', TRAY_RADIUS)}
    >
      <div
        className={cn(
          'grid overflow-hidden border border-default bg-white max-md:divide-y md:divide-x',
          'divide-border-subtle',
          QR_COL,
          BUNDLE_RADIUS,
        )}
      >
        <div className="flex min-w-0 flex-col gap-4 p-5 max-sm:p-4">
          <div className="flex flex-wrap items-center gap-2">
            <StatePill tone={PILL_TONE[phase]}>{item.text.status}</StatePill>
            <h3 className="min-w-0 text-lg font-semibold text-fg wrap-anywhere">
              {item.text.name}
            </h3>
          </div>
          <div className="flex flex-col gap-1">
            <Count item={item} phase={phase} />
            <p className="text-sm text-fg-tertiary">
              {phase === 'draft' ? item.text.period : `${item.text.period} 신청`} · {item.text.fee}
            </p>
          </div>
          <LinkRow item={item} phase={phase} props={props} />
          <div className="mt-auto">
            <Actions item={item} phase={phase} props={props} />
          </div>
        </div>
        <div className="flex flex-col justify-center bg-surface-subtle p-4">
          {item.text.link ? (
            <QrTile item={item} phase={phase} props={props} />
          ) : (
            <MissingTile item={item} props={props} />
          )}
        </div>
      </div>
      {phase === 'draft' && <Activate item={item} props={props} />}
      <ItemsBand item={item} />
    </section>
  )
}

function Toolbar(props: BuilderProps) {
  const { data } = props
  const creatable = data.forms.length > 0 && data.listActions.includes('form.create')
  const scannable = data.forms.some(item => item.form.actions.includes('form.check_in'))
  return (
    <div className="flex flex-wrap items-center gap-2">
      <h2 className="mr-auto text-lg font-semibold text-fg max-sm:w-full">신청 양식</h2>
      {scannable && (
        <Button variant="outline" touch className="max-sm:flex-1" onClick={props.onScan}>
          <ScanLine aria-hidden />
          QR로 출석 확인
        </Button>
      )}
      {creatable && (
        <Button variant="outline" touch className="max-sm:flex-1" onClick={props.onCreate}>
          <Plus aria-hidden />
          참여 설문 만들기
        </Button>
      )}
    </div>
  )
}

// 빈 상태도 같은 생김새: 쟁반 안 흰 묶음, 왼쪽 '신청 양식 없음' + 버튼, 오른쪽 점선 QR 자리.
function Empty(props: BuilderProps) {
  return (
    <section className={cn('bg-surface-muted p-2', TRAY_RADIUS)}>
      <div
        className={cn(
          'grid overflow-hidden border border-default bg-white max-md:divide-y md:divide-x',
          'divide-border-subtle',
          QR_COL,
          BUNDLE_RADIUS,
        )}
      >
        <div className="flex flex-col items-start gap-4 p-6 max-sm:p-4">
          <IconCircle>
            <ListChecks />
          </IconCircle>
          <h3 className="text-lg font-semibold text-fg">신청 양식 없음</h3>
          {props.data.listActions.includes('form.create') && (
            <Button touch onClick={props.onCreate}>
              <Plus aria-hidden />
              참여 설문 만들기
            </Button>
          )}
        </div>
        <div className="flex bg-surface-subtle p-4">
          <div className="flex min-h-40 grow items-center justify-center rounded-lg border-2 border-dashed border-border-strong">
            <QrCode aria-hidden className="size-10 text-fg-faint" />
          </div>
        </div>
      </div>
    </section>
  )
}

export function CardScreen(props: BuilderProps) {
  const { forms } = props.data
  return (
    <div className="flex flex-col gap-3">
      {forms.length > 0 ? (
        <Toolbar {...props} />
      ) : (
        <h2 className="text-lg font-semibold text-fg">신청 양식</h2>
      )}
      {forms.length === 0 ? (
        <Empty {...props} />
      ) : (
        forms.map(item => <FormTray key={item.form.id} item={item} props={props} />)
      )}
    </div>
  )
}
