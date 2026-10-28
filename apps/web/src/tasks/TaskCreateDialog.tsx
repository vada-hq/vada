import type { ComponentProps, Ref } from 'react'
import type { TaskCreateOptionsResponse } from '@vada/contracts'
import StateMessage from '@/components/StateMessage'
import PageActions from '@/components/PageActions'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useEvents } from '@/events/useEvents'
import type { QuickAddContext } from './task-defaults'
import type { TaskCreateInitial } from './task-fields'
import { eventChoices, linkableEventsOf } from './task-form-options'
import { TASK_CREATE_TEXT as text } from './task-text'
import { TaskCreateFields } from './TaskCreateFields'
import { useTaskCreateForm } from './useTaskCreateForm'
import type { useTaskCreateEntry } from './useTaskCreateEntry'

type Props = {
  open: boolean
  context: QuickAddContext
  options: TaskCreateOptionsResponse | null
  initial?: TaskCreateInitial | undefined
  onClose: () => void
  onCreated: () => void
  onOpenTask: (id: string) => void
  onForbidden: () => void
}

type ViewProps = ComponentProps<typeof TaskCreateFields> & {
  open: boolean
  onClose: () => void
  onSubmit: () => void
  problem?: string | null
  formEl?: Ref<HTMLFormElement>
}

// 휴대폰은 같은 대화상자 부품을 전체 화면으로 펼친다.
export function TaskCreateDialogView({ formEl, ...props }: ViewProps) {
  return (
    <Dialog
      open={props.open}
      onOpenChange={open => {
        if (!open && !props.busy) props.onClose()
      }}
    >
      <DialogContent
        aria-describedby={undefined}
        closeDisabled={props.busy}
        className="sm:max-w-2xl max-sm:fixed max-sm:inset-0 max-sm:h-dvh max-sm:max-w-none max-sm:overflow-y-auto max-sm:rounded-none max-sm:border-0"
      >
        <DialogHeader>
          <DialogTitle>{text.title}</DialogTitle>
        </DialogHeader>
        <form
          ref={formEl}
          noValidate
          aria-label={text.title}
          className="flex flex-col gap-6"
          onSubmit={event => {
            event.preventDefault()
            props.onSubmit()
          }}
        >
          <TaskCreateFields {...props} />
          {props.problem && <StateMessage kind="error">{props.problem}</StateMessage>}
          <DialogFooter>
            <Button type="button" variant="outline" touch busy={props.busy} onClick={props.onClose}>
              {text.close}
            </Button>
            <Button type="submit" touch busy={props.busy}>
              {text.title}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function OpenCreateDialog(props: Props & { options: TaskCreateOptionsResponse }) {
  const form = useTaskCreateForm(props)
  const events = useEvents(props.context.view.council.id, props.onForbidden)
  const list = events.state.kind === 'ready' ? events.state.data.events : []
  // 고른 행사(행사 탭의 그 행사, 미리 채운 행사)는 행사 목록을 읽기 전이거나 목록에 없어도 선택칸에 남긴다. 값은 이미 서버 선택지로 맞췄다.
  const chosen = form.values.eventId
  const current =
    chosen === null
      ? null
      : { id: chosen, name: list.find(event => event.id === chosen)?.name ?? text.currentEvent }
  const linkable = linkableEventsOf(list, props.options.linkableEvents, form.values.departmentId)
  return (
    <TaskCreateDialogView
      {...form}
      open
      options={props.options}
      onValues={form.setValues}
      onSubmit={form.submit}
      onClose={form.close}
      formEl={form.formRef}
      events={eventChoices(linkable, current)}
    />
  )
}

// 닫을 때 상태를 비워 다음에 여는 곳의 기본값·미리 채운 값을 다시 받는다.
export function TaskCreateDialog({ open, options, ...props }: Props) {
  if (!open || options === null) return null
  return <OpenCreateDialog {...props} open options={options} />
}

// 페이지 머리의 행동과 창. 목록의 읽기·거르기와 관계없이 서버 선택지로만 단추를 보인다.
export function TaskCreateEntry({
  entry,
  ...handlers
}: Pick<Props, 'onCreated' | 'onOpenTask' | 'onForbidden'> & {
  entry: ReturnType<typeof useTaskCreateEntry>
}) {
  return (
    <>
      {entry.available && (
        <PageActions>
          <Button touch onClick={() => entry.open()}>
            {text.title}
          </Button>
        </PageActions>
      )}
      <TaskCreateDialog
        {...handlers}
        context={entry.context}
        options={entry.choices}
        initial={entry.initial ?? undefined}
        open={entry.initial !== null}
        onClose={entry.close}
        onCreated={() => {
          entry.created()
          handlers.onCreated()
        }}
      />
    </>
  )
}
