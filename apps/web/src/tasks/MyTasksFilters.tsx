import type { EventSummary, TaskFilter } from '@vada/contracts'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { NativeSelect } from '@/components/ui/native-select'
import { COUNCIL_TASK_LABEL, STATUS_LABEL } from './task-view'

export type MyTasksFilterProps = {
  filter: TaskFilter
  scope: string | null
  state: string | null
  search: string
  events: Pick<EventSummary, 'id' | 'name'>[]
  onScope: (scope: string | null) => void
  onState: (state: string | null) => void
  onSearch: (search: string) => void
}

export const hasMyTaskFilters = (props: MyTasksFilterProps) =>
  props.scope !== null ||
  (props.filter === 'open' && props.state !== null) ||
  props.search.trim() !== ''

export function MyTasksFilters(props: MyTasksFilterProps) {
  const { scope, events } = props
  const missingScope = scope && scope !== 'council' && !events.some(event => event.id === scope)
  return (
    <div className="flex min-w-0 flex-wrap items-end gap-3">
      <Field label="범위" className="min-w-0 flex-1 sm:max-w-64">
        <NativeSelect
          className="min-w-0 max-sm:min-h-11"
          value={scope ?? ''}
          onChange={event => props.onScope(event.target.value || null)}
        >
          <option value="">전체</option>
          <option value="council">{COUNCIL_TASK_LABEL}</option>
          {missingScope && <option value={scope}>선택한 행사</option>}
          {events.map(event => (
            <option key={event.id} value={event.id}>
              {event.name}
            </option>
          ))}
        </NativeSelect>
      </Field>
      {props.filter === 'open' && (
        <Field label="상태" className="min-w-0 flex-1 sm:max-w-40">
          <NativeSelect
            className="max-sm:min-h-11"
            value={props.state ?? ''}
            onChange={event => props.onState(event.target.value || null)}
          >
            <option value="">전체 상태</option>
            <option value="todo">{STATUS_LABEL.todo}</option>
            <option value="in_progress">{STATUS_LABEL.in_progress}</option>
          </NativeSelect>
        </Field>
      )}
      <Field label="검색" className="w-full min-w-0 sm:ml-auto sm:w-56">
        <Input
          type="search"
          className="max-sm:min-h-11"
          value={props.search}
          onChange={event => props.onSearch(event.target.value)}
        />
      </Field>
    </div>
  )
}
