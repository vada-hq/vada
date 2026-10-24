import { useState } from 'react'
import type { CouncilView, RegistrationForm, TaskDetail, TaskResultKind } from '@vada/contracts'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { EventCreateDialog } from '@/events/EventCreateDialog'
import { RequestCreateDialog } from '@/finance/RequestCreateDialog'
import { useEventDetail } from '@/events/useEventDetail'
import { FormCreated } from '@/registrations/FormCreated'
import { FormEditor } from '@/registrations/FormEditor'
import { NoticeMakeDialog } from './NoticeMakeDialog'
import type { TaskDialogHandlers } from './task-requests'
import { makeLabel } from './task-results'

type Props = Pick<TaskDialogHandlers, 'onLost' | 'onForbidden'> & {
  view: CouncilView
  task: TaskDetail
  kind: TaskResultKind
  onClose: () => void
  // 만들었다. 부모가 업무를 새로 읽고 이 창을 닫는다.
  onMade: () => void
}

// 신청 양식 만들기는 탭 안의 화면이라 대화상자로 감싼다. 행사는 업무의 행사다(canMake가 행사 있는 업무에만 준다).
// 행사를 읽어 일시·장소 미정 경고와 미리보기를 보이고, 만든 뒤에는 링크와 QR을 바로 보인 다음 닫을 때 업무를 새로 읽는다.
function FormMakeDialog({ view, task, onClose, onMade, onLost, onForbidden }: Omit<Props, 'kind'>) {
  const [created, setCreated] = useState<RegistrationForm | null>(null)
  const eventId = task.event?.id ?? ''
  const read = useEventDetail(view.council.id, eventId, { onLost, onForbidden })
  if (!task.event) return null
  const finish = created ? onMade : onClose
  return (
    <Dialog
      open
      onOpenChange={open => {
        if (!open) finish()
      }}
    >
      <DialogContent aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle className="sr-only">{makeLabel('registration_form')}</DialogTitle>
        </DialogHeader>
        {created ? (
          <FormCreated form={created} doneLabel="닫기" onDone={onMade} />
        ) : (
          <FormEditor
            councilId={view.council.id}
            councilName={view.council.name}
            eventId={task.event.id}
            event={read.state.kind === 'ready' ? read.state.data.event : null}
            taskId={task.id}
            backLabel="닫기"
            onEditEvent={onClose}
            onClose={onClose}
            onDone={setCreated}
            onLost={onLost}
            onForbidden={onForbidden}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

// 업무 상세에서 결과물을 만드는 창. 만들기 창은 원래 있던 것에 taskId를 넘겨 다시 쓴다.
export function TaskMake({ kind, ...props }: Props) {
  const { view, task, onClose, onMade, onLost, onForbidden } = props
  switch (kind) {
    case 'request':
      return (
        <RequestCreateDialog
          open
          councilId={view.council.id}
          taskId={task.id}
          eventId={task.event?.id ?? null}
          start={{ title: task.title }}
          onClose={onClose}
          onCreated={onMade}
          onLost={onLost}
          onForbidden={onForbidden}
        />
      )
    case 'registration_form':
      return <FormMakeDialog {...props} />
    case 'message':
      return (
        <NoticeMakeDialog
          councilId={view.council.id}
          taskId={task.id}
          onClose={onClose}
          onMade={onMade}
          onLost={onLost}
          onForbidden={onForbidden}
        />
      )
    case 'event':
      return (
        <EventCreateDialog
          view={view}
          taskId={task.id}
          onClose={onClose}
          onDone={onMade}
          onLost={onLost}
          onForbidden={onForbidden}
        />
      )
  }
}
