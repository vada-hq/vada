import { useState, type ReactNode } from 'react'
import {
  CalendarDays,
  ChevronLeft,
  ClipboardList,
  Eye,
  ListChecks,
  Monitor,
  Smartphone,
  Wallet,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { cn } from '@/lib/utils'
import { ApplyPreview } from '../apply-preview'
import type { BuilderProps } from '../builder-props'
import {
  errorsOf,
  SECTIONS,
  sectionOfError,
  stateOf,
  summaryOf,
  useEditor,
  type EditorState,
  type SectionId,
} from './editor-state'
import { EventBody, FeeBody, ItemsBody, RecruitBody, SectionRow } from './sections'
import {
  DESK_SCREEN_H,
  DESK_W,
  DEVICE_SHADOW,
  PHONE_RADIUS,
  PHONE_SCREEN_H,
  PHONE_SCREEN_RADIUS,
  PHONE_W,
  SPLIT,
  EDITOR_H,
  TRAY_RADIUS,
} from './tokens'

// 편집기 = 왼쪽 흰 설정 단(구역 줄 쌓기, 맨 아래 고정 [만들기]) + 오른쪽 회색 무대(큰 휴대폰 틀 미리보기).
// 1024px 미만은 설정 단만 보이고, 무대는 [미리보기]로 전체 화면이 된다.
// 미리보기는 편집기 form 바깥에 둔다(확정안 신청 화면이 제 form을 가진다).

const META: Record<SectionId, { title: string; icon: ReactNode }> = {
  event: { title: '행사 정보', icon: <CalendarDays /> },
  recruit: { title: '모집', icon: <ClipboardList /> },
  fee: { title: '참가비', icon: <Wallet /> },
  items: { title: '받는 항목', icon: <ListChecks /> },
}

function Body({ id, s, props }: { id: SectionId; s: EditorState; props: BuilderProps }) {
  if (id === 'event') return <EventBody data={props.data} onEditEvent={props.onEditEvent} />
  if (id === 'recruit') return <RecruitBody s={s} />
  if (id === 'fee') return <FeeBody s={s} />
  return <ItemsBody s={s} />
}

function Head({ s, props }: { s: EditorState; props: BuilderProps }) {
  const done = SECTIONS.filter(id => {
    const state = stateOf(id, s.ctx, s.errors, props.data)
    return state === 'done' || state === 'locked'
  }).length
  return (
    <div className="flex flex-col items-start gap-1 border-b border-border-subtle px-5 pt-3 pb-4">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        touch
        className="-ml-3 text-fg-tertiary"
        onClick={props.onBack}
      >
        <ChevronLeft aria-hidden />
        신청 양식 목록
      </Button>
      <div className="flex w-full items-baseline gap-3">
        <h2 className="grow text-lg font-semibold text-fg">{s.editor.title}</h2>
        <span className="text-xs text-fg-tertiary tabular-nums">
          {SECTIONS.length}개 중 {done}개 완료
        </span>
      </div>
    </div>
  )
}

// 브라우저 창 머리의 점 셋
const WINDOW_DOTS = ['close', 'min', 'max']

function DeviceToggle({ desk, onDesk }: { desk: boolean; onDesk: (desk: boolean) => void }) {
  const item = (on: boolean) =>
    cn(
      'rounded-full',
      on ? 'bg-fg text-white hover:bg-fg-body hover:text-white' : 'text-fg-tertiary',
    )
  return (
    <div
      role="group"
      aria-label="미리보기 기기"
      className="flex gap-1 rounded-full border border-default bg-white p-1"
    >
      <Button
        type="button"
        variant="ghost"
        size="sm"
        aria-pressed={!desk}
        className={item(!desk)}
        onClick={() => onDesk(false)}
      >
        <Smartphone aria-hidden />
        휴대폰
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        aria-pressed={desk}
        className={item(desk)}
        onClick={() => onDesk(true)}
      >
        <Monitor aria-hidden />
        컴퓨터
      </Button>
    </div>
  )
}

function Stage({ s, props }: { s: EditorState; props: BuilderProps }) {
  const [desk, setDesk] = useState(false)
  const preview = (
    <ApplyPreview values={s.values} event={props.data.event} councilName={props.data.councilName} />
  )
  return (
    <section aria-label="미리보기" className="hidden bg-surface-muted p-6 lg:block">
      <div className="flex flex-col items-center gap-5">
        <DeviceToggle desk={desk} onDesk={setDesk} />
        {desk ? (
          <div
            className={cn(
              'overflow-hidden rounded-xl border border-default bg-white',
              DESK_W,
              DEVICE_SHADOW,
            )}
          >
            <div className="flex h-9 items-center gap-1.5 border-b border-border-subtle bg-surface-subtle px-3">
              {WINDOW_DOTS.map(dot => (
                <span key={dot} aria-hidden className="size-2.5 rounded-full bg-muted-strong" />
              ))}
              <span className="ml-3 truncate rounded-full bg-white px-3 py-0.5 text-xs text-fg-muted">
                vada-m1.onrender.com/apply/…
              </span>
            </div>
            <div className={cn('overflow-y-auto [scrollbar-width:thin]', DESK_SCREEN_H)}>
              {preview}
            </div>
          </div>
        ) : (
          <div
            className={cn(
              'border border-default bg-white p-3',
              PHONE_W,
              PHONE_RADIUS,
              DEVICE_SHADOW,
            )}
          >
            <span
              aria-hidden
              className="mx-auto mb-2 block h-1.5 w-16 rounded-full bg-muted-strong"
            />
            <div
              className={cn(
                'overflow-y-auto border border-border-subtle [scrollbar-width:none]',
                PHONE_SCREEN_H,
                PHONE_SCREEN_RADIUS,
              )}
            >
              {preview}
            </div>
          </div>
        )}
      </div>
    </section>
  )
}

function submitWith(s: EditorState, props: BuilderProps) {
  s.setSubmitted(true)
  const found = errorsOf(s.values, s.accountId)
  const first = Object.keys(found)[0]
  if (!first) return props.onSubmit(s.values, s.accountId)
  s.setOpen(sectionOfError(first))
  // 펼친 뒤 그 칸으로(틀린 첫 칸으로 이동, GOV.UK)
  requestAnimationFrame(() =>
    document.querySelector<HTMLElement>(`[data-field="${first}"]`)?.focus(),
  )
}

export function EditorScreen(props: BuilderProps) {
  const s = useEditor(props.data)
  const [sheet, setSheet] = useState(false)
  return (
    <div
      className={cn(
        'grid overflow-clip border border-default bg-white',
        SPLIT,
        EDITOR_H,
        TRAY_RADIUS,
      )}
    >
      <form
        noValidate
        aria-label={s.editor.title}
        className="flex min-w-0 flex-col lg:min-h-0 lg:border-r lg:border-default"
        onSubmit={event => {
          event.preventDefault()
          submitWith(s, props)
        }}
      >
        <Head s={s} props={props} />
        <div className="flex min-h-0 grow flex-col lg:overflow-y-auto lg:[scrollbar-width:thin]">
          {SECTIONS.map(id => (
            <SectionRow
              key={id}
              icon={META[id].icon}
              title={META[id].title}
              summary={summaryOf(id, s.ctx, props.data)}
              state={stateOf(id, s.ctx, s.errors, props.data)}
              open={s.open === id}
              onToggle={() => s.setOpen(s.open === id ? null : id)}
            >
              <Body id={id} s={s} props={props} />
            </SectionRow>
          ))}
        </div>
        <div className="flex shrink-0 gap-2 border-t border-border-subtle bg-white p-4">
          <Button
            type="button"
            variant="outline"
            className="h-11 lg:hidden"
            onClick={() => setSheet(true)}
          >
            <Eye aria-hidden />
            미리보기
          </Button>
          <Button type="submit" className="h-11 grow" data-measure="submit">
            {s.editor.submit}
          </Button>
        </div>
      </form>
      <Stage s={s} props={props} />
      <Sheet open={sheet} onOpenChange={setSheet}>
        <SheetContent
          side="adaptive"
          title="미리보기"
          closeLabel="닫기"
          className="max-h-none max-sm:h-dvh max-sm:rounded-none sm:w-112"
        >
          <div className="min-h-0 grow overflow-y-auto">
            <ApplyPreview
              values={s.values}
              event={props.data.event}
              councilName={props.data.councilName}
            />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
