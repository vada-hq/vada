import { useState } from 'react'
import {
  eventRecordPath,
  recordsPath,
  statusOf,
  type CouncilView,
  type EventRecordResponse,
  type RecordEventsResponse,
} from '@vada/contracts'
import PageColumn from '@/components/PageColumn'
import StateMessage from '@/components/StateMessage'
import { Button } from '@/components/ui/button'
import { navigate, useHere } from '@/lib/app-location'
import { usePolledRead } from '@/lib/use-polled-read'
import { EventRecordView } from './EventRecordView'
import { RecordEventList } from './RecordEventList'
import { RECORD_TEXT } from './record-view'

type Props = { view: CouncilView; onForbidden: () => void }

const recordsApi = (councilId: string) => `/api/organizations/${councilId}/records/events`

function Failed({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <>
      <StateMessage kind="error">{message}</StateMessage>
      <Button variant="outline" touch className="self-start" onClick={onRetry}>
        다시 시도
      </Button>
    </>
  )
}

// 완료된 행사(REC-01). 모든 운영진이 본다(council.view). 403은 운영진이 아니게 된 것이라 학생회를 다시 읽는다.
function RecordList({ view, onForbidden }: Props) {
  const councilId = view.council.id
  const read = usePolledRead<RecordEventsResponse>(recordsApi(councilId), status => {
    if (status === statusOf('FORBIDDEN')) onForbidden()
  })
  if (read.state.kind === 'loading')
    return <StateMessage kind="loading">{RECORD_TEXT.loading}</StateMessage>
  if (read.state.kind === 'failed')
    return <Failed message={RECORD_TEXT.failed} onRetry={() => void read.reload()} />
  return (
    <RecordEventList
      events={read.state.data.events}
      truncated={read.state.data.truncated}
      onOpen={eventId => navigate(eventRecordPath(councilId, eventId))}
    />
  )
}

// 행사 기록(REC-02). 완료하지 않았거나 완료를 취소한 행사, 다른 학생회 행사는 서버가 404로 답한다.
function RecordDetail({ view, onForbidden, eventId }: Props & { eventId: string }) {
  const councilId = view.council.id
  const [lost, setLost] = useState(false)
  const read = usePolledRead<EventRecordResponse>(`${recordsApi(councilId)}/${eventId}`, status => {
    if (status === statusOf('FORBIDDEN')) onForbidden()
    if (status === statusOf('NOT_FOUND')) setLost(true)
  })
  if (lost)
    return (
      <>
        <StateMessage kind="notice">{RECORD_TEXT.lost}</StateMessage>
        <Button
          variant="outline"
          touch
          className="self-start"
          onClick={() => navigate(recordsPath(councilId))}
        >
          완료된 행사
        </Button>
      </>
    )
  if (read.state.kind === 'loading')
    return <StateMessage kind="loading">{RECORD_TEXT.loadingOne}</StateMessage>
  if (read.state.kind === 'failed')
    return <Failed message={RECORD_TEXT.failedOne} onRetry={() => void read.reload()} />
  return <EventRecordView councilId={councilId} record={read.state.data.record} />
}

// 기록 메뉴(DEC-110). 주소가 목록(/records/<학생회>)과 행사 기록(/records/<학생회>/<행사>)을 가른다.
export default function EventRecordsPage(props: Props) {
  const { location } = useHere()
  const eventId =
    location?.type === 'record' &&
    location.record === 'records' &&
    location.councilId === props.view.council.id
      ? location.recordId
      : null
  return (
    <PageColumn className="min-w-0 break-keep">
      {eventId ? (
        <RecordDetail key={eventId} {...props} eventId={eventId} />
      ) : (
        <RecordList {...props} />
      )}
    </PageColumn>
  )
}
