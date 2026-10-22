import { useState } from 'react'
import type { ApplicantsResponse } from '@vada/contracts'
import StateMessage from '@/components/StateMessage'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { APPLICANTS_LOAD_FAILED } from '@/lib/messages'
import type { EventDialogHandlers } from '@/events/useEventSubmit'
import { ApplicantRow } from './ApplicantRow'
import { useApplicants } from './useApplicants'

type Props = EventDialogHandlers & {
  councilId: string
  formId: string
  canManage: boolean
  // 이 화면에서 바꾼 출석(스캐너 포함). 목록을 다시 읽지 않고 이것으로 덮는다.
  attendance: ReadonlyMap<string, boolean>
  // 서버에서 읽은 신청자들(이 화면에서 바꾼 출석 값을 버린다)
  onLoaded: (registrationIds: string[]) => void
  onAttendance: (registrationId: string, attended: boolean) => void
  // 신청을 취소했다(양식의 신청 수를 다시 읽는다).
  onCancelled: () => void
}

const matches = (query: string, ...values: (string | null)[]) =>
  values.some(value => value?.includes(query))

// 신청자 목록: 신청 순. 읽을 때마다 열람 기록이 남으므로 [신청자 보기]를 눌러 이 화면이 열려야 읽는다.
export function ApplicantList({ councilId, formId, ...rest }: Props) {
  const { canManage, attendance, onAttendance, onCancelled, onLoaded, ...handlers } = rest
  const list = useApplicants(councilId, formId, handlers, data =>
    onLoaded(data.applicants.map(item => item.id)),
  )
  const { state } = list
  if (state.kind === 'loading') return <StateMessage kind="loading">불러오는 중이에요</StateMessage>
  if (state.kind === 'failed')
    return (
      <div className="flex flex-col items-start gap-3">
        <StateMessage kind="error">{APPLICANTS_LOAD_FAILED}</StateMessage>
        <Button variant="outline" size="sm" onClick={() => void list.reload()}>
          다시 시도
        </Button>
      </div>
    )
  return (
    <ApplicantItems
      councilId={councilId}
      data={state.data}
      onReload={() => void list.reload()}
      {...{ canManage, attendance, onAttendance, onCancelled, ...handlers }}
    />
  )
}

type ItemsProps = EventDialogHandlers &
  Pick<Props, 'councilId' | 'canManage' | 'attendance' | 'onAttendance' | 'onCancelled'> & {
    data: ApplicantsResponse
    onReload: () => void
  }

function ApplicantItems({ data, onReload, attendance, onCancelled, ...rest }: ItemsProps) {
  const [query, setQuery] = useState('')
  const [removed, setRemoved] = useState<ReadonlySet<string>>(new Set())
  const word = query.trim()
  const shown = data.applicants.filter(
    item => !removed.has(item.id) && (word === '' || matches(word, item.name, item.studentId)),
  )
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Input
          aria-label="이름이나 학번으로 찾기"
          placeholder="이름이나 학번으로 찾기"
          value={query}
          onChange={event => setQuery(event.target.value)}
        />
        <Button variant="outline" size="sm" className="shrink-0" onClick={onReload}>
          새로 읽기
        </Button>
      </div>
      {data.truncated && <StateMessage kind="notice">신청이 많아 앞의 일부만 보여요.</StateMessage>}
      {shown.length === 0 ? (
        <StateMessage kind="empty">
          {word === '' ? '아직 신청한 사람이 없어요.' : '찾는 신청자가 없어요.'}
        </StateMessage>
      ) : (
        <ul className="flex flex-col gap-2">
          {shown.map(item => (
            <ApplicantRow
              key={item.id}
              applicant={item}
              attended={attendance.get(item.id) ?? item.attended}
              onCancelled={id => {
                setRemoved(before => new Set(before).add(id))
                onCancelled()
              }}
              {...rest}
            />
          ))}
        </ul>
      )}
    </div>
  )
}
