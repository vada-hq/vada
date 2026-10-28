import { useEffect, useState } from 'react'
import type { CouncilView } from '@vada/contracts'
import PageColumn from '@/components/PageColumn'
import StateMessage from '@/components/StateMessage'
import { Button } from '@/components/ui/button'
import { useEvents } from '@/events/useEvents'
import { useRecordDialogs } from '@/lib/use-record-dialogs'
import { cardMenuOf } from './task-card-menu'
import { MY_TASK_EVENTS_FAILED } from './my-tasks-text'
import { MyTasksView } from './MyTasksView'
import { TaskDeleteConfirm } from './TaskDeleteConfirm'
import { TaskPanel } from './TaskPanel'
import { TaskCreateEntry } from './TaskCreateDialog'
import { useTaskCreateEntry } from './useTaskCreateEntry'
import { TaskTabs } from './TaskTabs'
import { useStatusChange } from './useStatusChange'
import type { useTaskControls } from './useTaskControls'
import { useTaskOpeners } from './useTaskOpeners'
import { useTaskRemove } from './useTaskRemove'
import { useTasks } from './useTasks'

type Props = {
  view: CouncilView
  initialTaskId?: string | undefined
  controls: ReturnType<typeof useTaskControls>
  onForbidden: () => void
  onChanged: () => void
}

// 주소에 남은 행사가 지워졌으면 서버가 404를 준다. 어느 탭의 읽기든 404면 범위를 풀어 전체를 다시 읽는다.
function useLostScope(controls: Props['controls'], lists: ReturnType<typeof useTasks>[]) {
  const lost =
    controls.listEvent !== 'none' &&
    lists.some(({ state }) => state.kind === 'failed' && state.notFound)
  const { setScope } = controls
  useEffect(() => {
    if (lost) setScope(null)
  }, [lost, setScope])
}

export function MyTasksPage({ view, initialTaskId, controls, onForbidden, onChanged }: Props) {
  const councilId = view.council.id
  const entry = useTaskCreateEntry(
    { view, taskView: 'mine', dept: null, eventId: undefined },
    onForbidden,
  )
  const [search, setSearch] = useState('')
  const dialogs = useRecordDialogs(initialTaskId)
  const opened = useTaskOpeners(councilId, false)
  const open = useTasks(
    councilId,
    { view: 'mine', filter: 'open', eventId: controls.listEvent },
    onForbidden,
  )
  const done = useTasks(
    councilId,
    { view: 'mine', filter: 'done', eventId: controls.listEvent },
    onForbidden,
    controls.filter === 'done',
  )
  const events = useEvents(councilId, onForbidden)
  useLostScope(controls, [open, done])
  const reload = async () => {
    onChanged()
    await Promise.all([open.reload(), done.reload()])
  }
  const changed = () => void reload()
  const lost = (message: string) => {
    dialogs.lose(message)
    changed()
  }
  const change = useStatusChange(councilId, reload, onForbidden)
  const remove = useTaskRemove(councilId, changed, { onLost: lost, onForbidden })
  const reset = () => {
    controls.clearMyFilters()
    setSearch('')
  }
  return (
    <PageColumn className="min-w-0">
      <TaskCreateEntry
        entry={entry}
        onCreated={changed}
        onOpenTask={opened.openTask}
        onForbidden={onForbidden}
      />
      {dialogs.lost && <StateMessage kind="error">{dialogs.lost}</StateMessage>}
      <TaskPanel
        view={view}
        taskId={dialogs.openId}
        onOpenEvent={opened.openEventFromTask}
        onClose={dialogs.closeDetail}
        onChanged={changed}
        onForbidden={onForbidden}
        onLost={lost}
      />
      <TaskDeleteConfirm
        open={remove.open}
        busy={remove.busy}
        error={remove.error}
        onClose={remove.close}
        onConfirm={remove.confirm}
      />
      <TaskTabs
        tab={{ value: controls.tab, onChange: controls.setTab }}
        scope={controls}
        view="mine"
        filter={controls.filter}
        showFilter={false}
        onView={controls.setView}
        onFilter={controls.setFilter}
      />
      {events.state.kind === 'failed' && (
        <div className="flex flex-wrap items-center gap-2">
          <StateMessage kind="error">{MY_TASK_EVENTS_FAILED}</StateMessage>
          <Button variant="outline" touch onClick={() => void events.reload()}>
            다시 시도
          </Button>
        </div>
      )}
      <MyTasksView
        open={open}
        done={done}
        filter={controls.filter}
        scope={controls.scope}
        state={controls.state}
        search={search}
        events={events.state.kind === 'ready' ? events.state.data.events : []}
        onScope={controls.setScope}
        onState={controls.setState}
        onSearch={setSearch}
        onFilter={controls.setFilter}
        onReset={reset}
        onOpenTask={opened.openTask}
        change={change}
        cardMenu={cardMenuOf(councilId, remove.ask)}
      />
    </PageColumn>
  )
}
