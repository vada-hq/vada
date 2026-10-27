import { useEffect, useState, type Ref } from 'react'
import type { CouncilView, TaskResponse, TaskView } from '@vada/contracts'
import StateMessage from '@/components/StateMessage'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { useUnsavedInput } from '@/lib/leave-guard'
import { TASK_OPTIONS_FAILED, TASK_OPTIONS_LOADING } from '@/lib/messages'
import { useFormCheck, withContract } from '@/lib/use-form-check'
import { createRequest, emptyFields, TASK_CONTRACT_MESSAGES, taskErrors } from './task-fields'
import { defaultPlacement, visibleInView, type QuickAddContext } from './task-defaults'
import { useTaskCreate } from './useTaskCreate'
import { useTaskOptions, type TaskOptionsState } from './useTaskOptions'

type Props = {
  view: CouncilView
  taskView: TaskView
  dept: string | null
  // 행사의 업무 탭이면 그 행사
  eventId?: string | undefined
  // 행사 개요의 [업무 만들기]로 왔을 때 칸에 초점을 둔다.
  autoFocus?: boolean | undefined
  // 늘 때마다 칸에 초점을 둔다(보드 빈 상태의 [첫 업무 추가]).
  focusRequest?: number | undefined
  // 이 사람이 여기서 만들 수 있는지(선택지를 읽은 뒤). 빈 상태가 [첫 업무 추가]를 보일지 정한다.
  onAvailable?: ((available: boolean) => void) | undefined
  // 만들었다. 부모가 목록과 수를 다시 읽는다.
  onCreated: () => void
  onForbidden: () => void
  onOpenTask: (taskId: string) => void
}

// 만든 업무가 지금 보기에 없을 때의 안내. 열면 상세가 열린다.
function Hidden({ taskId, onOpen }: { taskId: string; onOpen: (taskId: string) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <StateMessage kind="notice">추가한 업무는 이 보기에 없음</StateMessage>
      <Button size="sm" variant="outline" onClick={() => onOpen(taskId)}>
        열기
      </Button>
    </div>
  )
}

// 칸의 글, 서버 선택지로 정한 자리, 만들기 요청, 만든 뒤 지금 보기에 없는 업무.
function useQuickAdd(props: Props) {
  const { view, taskView, dept, eventId, onForbidden } = props
  const councilId = view.council.id
  const options = useTaskOptions(councilId, eventId, onForbidden)
  const [title, setTitle] = useState('')
  const [hidden, setHidden] = useState<string | null>(null)
  const context: QuickAddContext = { view, taskView, dept, eventId }
  const placement =
    options.state.kind === 'ready' ? defaultPlacement(options.state.options, context) : null
  const request = createRequest(
    { ...emptyFields, title },
    placement?.departmentId ?? null,
    placement?.assigneeId ?? null,
    eventId ?? null,
  )
  const settle = useUnsavedInput(title !== '')
  // 만들 때마다 늘어, 화면이 칸에 초점을 되돌린다.
  const [created, setCreated] = useState(0)
  const create = useTaskCreate(councilId, request, {
    onForbidden,
    onCreated: (task: TaskResponse['task']) => {
      settle()
      setTitle('')
      reset()
      setHidden(visibleInView(task, context) ? null : task.id)
      props.onCreated()
      setCreated(count => count + 1)
    },
  })
  const { formRef, errors, attempt, reset } = useFormCheck(() =>
    withContract(taskErrors({ ...emptyFields, title }), create.parsed, TASK_CONTRACT_MESSAGES),
  )

  function submit() {
    if (!attempt()) return
    if (placement === null) {
      create.setProblem(unavailableText(options.state))
      return void options.reload()
    }
    setHidden(null)
    void create.submit()
  }

  // 부서를 고를 수 있는 곳이 없으면 만들 수 없는 사람이다.
  const ready = options.state.kind === 'ready'
  const unavailable = ready && placement === null
  return { title, setTitle, hidden, create, created, formRef, errors, submit, ready, unavailable }
}

const unavailableText = (state: TaskOptionsState) =>
  state.kind === 'failed' ? TASK_OPTIONS_FAILED : TASK_OPTIONS_LOADING

type ViewProps = {
  title: string
  onTitle: (title: string) => void
  onSubmit: () => void
  busy?: boolean
  // 칸 아래 오류와 보낸 뒤의 문제
  error?: string | undefined
  problem?: string | null
  // 만든 업무가 지금 보기에 없을 때 그 업무
  hiddenId?: string | null
  onOpenTask: (taskId: string) => void
  formEl?: Ref<HTMLFormElement>
}

// 빠른 추가의 모양. 부품 확인 화면이 같이 쓴다.
export function QuickAddView({
  formEl,
  title,
  onTitle,
  onSubmit,
  busy,
  error,
  problem,
  hiddenId,
  onOpenTask,
}: ViewProps) {
  return (
    <form
      ref={formEl}
      noValidate
      aria-label="업무 빠른 추가"
      className="flex flex-col gap-2"
      onSubmit={event => {
        event.preventDefault()
        onSubmit()
      }}
    >
      <div className="flex items-start gap-2">
        <Field label="새 업무" className="min-w-0 flex-1" error={error}>
          <Input value={title} onChange={event => onTitle(event.target.value)} />
        </Field>
        <Button type="submit" className="mt-6" busy={busy ?? false}>
          추가
        </Button>
      </div>
      {problem && <StateMessage kind="error">{problem}</StateMessage>}
      {hiddenId && <Hidden taskId={hiddenId} onOpen={onOpenTask} />}
    </form>
  )
}

// 목록 맨 위의 빠른 추가. 제목만 치고 Enter(또는 [추가])로 만들고, 부서·담당자·행사는 보는 곳에서 정한다.
// 만든 뒤 칸은 비고 초점은 남아 이어서 만든다.
export function TaskQuickAdd(props: Props) {
  const add = useQuickAdd(props)
  const { formRef, created, ready, unavailable } = add
  const { autoFocus, focusRequest = 0, onAvailable } = props
  useEffect(() => {
    if (autoFocus || created > 0 || focusRequest > 0)
      formRef.current?.querySelector('input')?.focus()
  }, [autoFocus, created, focusRequest, formRef])
  useEffect(() => {
    onAvailable?.(ready && !unavailable)
  }, [onAvailable, ready, unavailable])
  if (add.unavailable) return null
  return (
    <QuickAddView
      title={add.title}
      onTitle={add.setTitle}
      onSubmit={add.submit}
      busy={add.create.busy}
      error={add.errors['title']}
      problem={add.create.problem}
      hiddenId={add.hidden}
      onOpenTask={props.onOpenTask}
      formEl={formRef}
    />
  )
}
