import { useState, type ReactNode } from 'react'
import { CreateTaskSchema, type TaskCreateOptionsResponse } from '@vada/contracts'
import { Button } from '@/components/ui/button'
import { useFormCheck, withContract } from '@/lib/use-form-check'
import { TaskCreateDialogView } from './TaskCreateDialog'
import { selectAssignee } from './task-defaults'
import {
  createRequest,
  emptyFields,
  TASK_CONTRACT_MESSAGES,
  taskErrors,
  type TaskCreateValues,
} from './task-fields'
import { NO_EVENT_LABEL } from './task-view'

const DEPARTMENT_ID = '00000000-0000-4000-8000-0000000000d1'
const MEMBER_ID = '00000000-0000-4000-8000-000000000001'
const EVENT_ID = '00000000-0000-4000-8000-0000000000e1'
const OPTIONS: TaskCreateOptionsResponse = {
  departments: [
    {
      id: DEPARTMENT_ID,
      name: '기획부',
      assignees: [
        { id: null, name: null },
        { id: MEMBER_ID, name: '김새내' },
      ],
    },
    {
      id: null,
      name: null,
      assignees: [
        { id: null, name: null },
        { id: MEMBER_ID, name: '김새내' },
      ],
    },
  ],
  linkableEvents: [
    { departmentId: DEPARTMENT_ID, eventIds: [EVENT_ID] },
    { departmentId: null, eventIds: [EVENT_ID] },
  ],
}
const EMPTY: TaskCreateValues = {
  ...emptyFields,
  departmentId: DEPARTMENT_ID,
  assigneeId: null,
  eventId: null,
}
const EVENTS = [
  { id: null, label: NO_EVENT_LABEL },
  { id: EVENT_ID, label: '신입생 환영회' },
]

// 업무 추가 창 견본은 실제 계약으로 검사하되 서버에 쓰지 않는다. 화면 폭을 바꾸면 2열·1열과 전체 화면을 함께 볼 수 있다.
export function TaskCreatePreview({
  children,
}: {
  children: (open: (title: string) => void) => ReactNode
}) {
  const [open, setOpen] = useState(false)
  const [values, setValues] = useState(EMPTY)
  const request = createRequest(values, values.departmentId, values.assigneeId, values.eventId)
  const check = useFormCheck(() =>
    withContract(taskErrors(values), CreateTaskSchema.safeParse(request), TASK_CONTRACT_MESSAGES),
  )
  const start = (eventId: string | null, title = '포스터') => {
    setValues({ ...EMPTY, title, eventId })
    check.reset()
    setOpen(true)
  }
  return (
    <div aria-label="업무 추가 창 · 1280·390" className="flex w-full flex-wrap gap-3">
      {children(title => start(null, title))}
      <Button variant="outline" touch onClick={() => start(null)}>
        업무 추가 창 열기
      </Button>
      <Button variant="outline" touch onClick={() => start(EVENT_ID)}>
        행사 업무 추가 창 열기
      </Button>
      <TaskCreateDialogView
        open={open}
        options={OPTIONS}
        events={EVENTS}
        values={values}
        onValues={setValues}
        busy={false}
        errors={check.errors}
        formEl={check.formRef}
        onClose={() => setOpen(false)}
        onSubmit={() => {
          if (check.attempt()) setOpen(false)
        }}
        onDepartment={departmentId => {
          const department = OPTIONS.departments.find(item => item.id === departmentId)
          if (department)
            setValues(before => ({
              ...before,
              departmentId,
              assigneeId: selectAssignee(department.assignees, before.assigneeId, MEMBER_ID),
            }))
        }}
      />
    </div>
  )
}
