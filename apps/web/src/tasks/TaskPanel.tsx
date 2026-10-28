import { useEffect, useState } from 'react'
import {
  koreanDateOf,
  recordPath,
  type CouncilView,
  type TaskDetail,
  type TaskResultKind,
} from '@vada/contracts'
import { HistoryMenu, type MenuAction } from '@/components/HistoryMenu'
import StateMessage from '@/components/StateMessage'
import { Button } from '@/components/ui/button'
import { copyText } from '@/lib/copy-text'
import { TASK_LOAD_FAILED } from '@/lib/messages'
import { useNow } from '@/lib/use-now'
import { useTeam } from '@/team/useTeam'
import { editRequest, type TaskEdit } from './task-edits'
import { assigneeOptions, departmentOptions, eventOptions } from './task-pick-options'
import type { TaskDialogHandlers } from './task-requests'
import { resultOpener } from './task-result-open'
import { versionLine } from './task-text'
import { TaskDeleteConfirm } from './TaskDeleteConfirm'
import { TaskDetailFrame } from './TaskDetailFrame'
import { TaskDetailView } from './TaskDetailView'
import type { TaskPickOptions } from './TaskFactGrid'
import { TaskInlineText } from './TaskInlineText'
import { TaskMake } from './TaskMake'
import { TaskUndoBar } from './TaskUndoBar'
import { useAssigneeUndo } from './useAssigneeUndo'
import { useLinkableEvents } from './useLinkableEvents'
import { useTaskDetail } from './useTaskDetail'

type Props = TaskDialogHandlers & {
  view: CouncilView
  // 열린 업무의 번호. null이면 닫혀 있다.
  taskId: string | null
  onClose: () => void
  onOpenEvent?: ((eventId: string) => void) | undefined
}

// 업무 상세 오른쪽 패널. 업무 메뉴의 보드·표·달력, 행사의 업무 탭, 홈과 알림이 여는 업무 주소(/tasks/<학생회>/<업무>)가 모두 이것을 연다.
// 열려 있을 때만 읽고, 업무가 바뀌면 처음부터 다시 읽는다.
export function TaskPanel({ taskId, ...props }: Props) {
  if (taskId === null) return null
  return <OpenTaskPanel key={taskId} taskId={taskId} {...props} />
}

// 이을 수 있는 행사는 행사 고르기 창을 처음 열 때 읽는다(패널을 열 때마다 두 번 더 읽지 않게).
function EventsLoader(props: {
  councilId: string
  task: TaskDetail
  onForbidden: () => void
  onReady: (options: TaskPickOptions['events']) => void
}) {
  const { ready, list } = useLinkableEvents(props.councilId, props.task, props.onForbidden)
  const { onReady, task } = props
  // 넘기면 부모가 이 읽기를 내린다(events가 null이 아니게 되어).
  useEffect(() => {
    if (ready) onReady(eventOptions(list, task.event))
  }, [ready, list, onReady, task.event])
  return null
}

function usePanelMenu(task: TaskDetail | null, councilId: string, onDelete: () => void) {
  const [copied, setCopied] = useState<boolean | null>(null)
  const actions: MenuAction[] = []
  if (!task) return { actions, copied }
  actions.push({
    label: '링크 복사',
    onSelect: () =>
      void copyText(`${location.origin}${recordPath('tasks', councilId, task.id)}`).then(setCopied),
  })
  if (task.actions.includes('task.remove'))
    actions.push({ label: '지우기', destructive: true, onSelect: onDelete })
  return { actions, copied }
}

type Detail = ReturnType<typeof useTaskDetail>
type Team = ReturnType<typeof useTeam>

// 값 하나를 바꾸면 있는 업무 API 하나로 바로 보낸다. 담당자를 바꿨으면 아래 띠에 [되돌리기]를 단다(DEC-94, 018).
function usePanelEdit(councilId: string, detail: Detail, team: Team, onForbidden: () => void) {
  const undo = useAssigneeUndo(councilId, detail.refresh, onForbidden)
  const onEdit = async (edit: TaskEdit) => {
    const { where, path, body } = editRequest(edit)
    const task = detail.task
    const done = await detail.send(where, path, body)
    if (done && task && edit.field === 'assignee') {
      const member = team.data?.members.find(item => item.id === edit.assigneeId)
      undo.note({
        taskId: task.id,
        previousId: task.assignee?.id ?? null,
        assignee: member ? { id: member.id, name: member.name, current: true } : null,
      })
    }
    return done
  }
  return { onEdit, undo }
}

const canPickTeam = (task: TaskDetail | null) =>
  Boolean(
    task?.actions.some(
      action => action === 'task.change_assignee' || action === 'task.change_department',
    ),
  )

function pickOptions(team: Team, task: TaskDetail | null, events: TaskPickOptions['events']) {
  return {
    departments: team.data ? departmentOptions(team.data) : null,
    assignees: team.data && task ? assigneeOptions(team.data, task) : null,
    events,
    teamFailed: team.loadFailed,
  }
}

function Unloaded({ detail }: { detail: Detail }) {
  if (!detail.loadFailed) return <StateMessage kind="loading">불러오는 중이에요</StateMessage>
  return (
    <div className="flex flex-col items-start gap-3">
      <StateMessage kind="error">{TASK_LOAD_FAILED}</StateMessage>
      <Button variant="outline" onClick={detail.retry}>
        다시 시도
      </Button>
    </div>
  )
}

function DeleteConfirm({
  detail,
  open,
  onCancel,
  onDeleted,
}: {
  detail: Detail
  open: boolean
  onCancel: () => void
  onDeleted: () => void
}) {
  return (
    <TaskDeleteConfirm
      open={open}
      busy={detail.saving}
      error={detail.problem?.where === 'delete' ? detail.problem.text : ''}
      onClose={() => {
        detail.clearProblem()
        onCancel()
      }}
      onConfirm={() => {
        void detail.send('delete', '/delete', {}).then(done => {
          if (done) onDeleted()
        })
      }}
    />
  )
}

function CopyNotice({ copied }: { copied: boolean | null }) {
  if (copied === null) return null
  return (
    <StateMessage kind={copied ? 'notice' : 'error'}>
      {copied ? '링크 복사 완료' : '링크를 복사하지 못했어요'}
    </StateMessage>
  )
}

function PanelHeading({
  detail,
  onEdit,
}: {
  detail: Detail
  onEdit: (edit: TaskEdit) => Promise<boolean>
}) {
  const task = detail.task
  return (
    <TaskInlineText
      field="title"
      value={task?.title ?? '업무'}
      editable={task?.actions.includes('task.edit') ?? false}
      busy={detail.saving}
      problem={detail.problem?.where === 'title' ? detail.problem.text : undefined}
      onSave={title => title !== null && onEdit({ field: 'title', title })}
    />
  )
}

type OpenProps = Props & { taskId: string }
type Parts = ReturnType<typeof usePanelParts>

// 패널이 가진 상태: 업무, 사람·부서 목록, 행사 목록(필요할 때), 만들기 창, 지우기 확인, 되돌리기 띠.
function usePanelParts({ view, taskId, onForbidden, onChanged, onLost }: OpenProps) {
  const councilId = view.council.id
  const detail = useTaskDetail(councilId, taskId, { onForbidden, onChanged, onLost })
  const team = useTeam(councilId, onForbidden, canPickTeam(detail.task))
  const [wantEvents, setWantEvents] = useState(false)
  const [events, setEvents] = useState<TaskPickOptions['events']>(null)
  useEffect(() => {
    setEvents(null)
  }, [detail.task?.department?.id])
  const [making, setMaking] = useState<TaskResultKind | null>(null)
  const [deleting, setDeleting] = useState(false)
  const edit = usePanelEdit(councilId, detail, team, onForbidden)
  const menu = usePanelMenu(detail.task, councilId, () => setDeleting(true))
  const today = koreanDateOf(useNow())
  return {
    councilId,
    detail,
    team,
    wantEvents,
    setWantEvents,
    events,
    setEvents,
    making,
    setMaking,
    deleting,
    setDeleting,
    edit,
    menu,
    today,
  }
}

function PanelBody({ parts, props }: { parts: Parts; props: OpenProps }) {
  const { detail, edit } = parts
  if (!detail.task) return <Unloaded detail={detail} />
  return (
    <TaskDetailView
      task={detail.task}
      today={parts.today}
      busy={detail.saving}
      problem={detail.problem}
      options={pickOptions(parts.team, detail.task, parts.events)}
      onEdit={edit.onEdit}
      onMake={parts.setMaking}
      openerOf={resultOpener(parts.councilId)}
      onNeedEvents={() => parts.setWantEvents(true)}
      onOpenEvent={props.onOpenEvent}
    />
  )
}

// 행사 목록 읽기, 결과물 만들기 창. 업무를 다 읽은 뒤에만 있다.
function PanelExtras({ parts, props }: { parts: Parts; props: OpenProps }) {
  const task = parts.detail.task
  if (!task) return null
  const afterMake = () => {
    parts.setMaking(null)
    parts.detail.refresh()
  }
  return (
    <>
      {parts.wantEvents && parts.events === null && (
        <EventsLoader
          key={task.department?.id ?? 'council'}
          councilId={parts.councilId}
          task={task}
          onForbidden={props.onForbidden}
          onReady={parts.setEvents}
        />
      )}
      {parts.making && (
        <TaskMake
          view={props.view}
          task={task}
          kind={parts.making}
          onClose={afterMake}
          onMade={afterMake}
          onLost={props.onLost}
          onForbidden={props.onForbidden}
        />
      )}
    </>
  )
}

function OpenTaskPanel(props: OpenProps) {
  const parts = usePanelParts(props)
  const { detail, edit, menu } = parts
  return (
    <TaskDetailFrame
      title={detail.task?.title ?? '업무'}
      busy={detail.saving}
      onClose={props.onClose}
      record={{ kind: 'tasks', id: props.taskId }}
      heading={<PanelHeading detail={detail} onEdit={edit.onEdit} />}
      menu={
        detail.task && (
          <HistoryMenu history={detail.task.history} line={versionLine} actions={menu.actions} />
        )
      }
    >
      <CopyNotice copied={menu.copied} />
      <PanelBody parts={parts} props={props} />
      <PanelExtras parts={parts} props={props} />
      <TaskUndoBar bar={edit.undo.bar} dismiss={edit.undo.dismiss} undo={edit.undo.undo} />
      <DeleteConfirm
        detail={detail}
        open={parts.deleting}
        onCancel={() => parts.setDeleting(false)}
        onDeleted={props.onClose}
      />
    </TaskDetailFrame>
  )
}
