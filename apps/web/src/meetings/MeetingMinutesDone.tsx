import { useState } from 'react'
import type { MeetingDetail } from '@vada/contracts'
import PageHeading from '@/components/PageHeading'
import { Alert } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { dayTimeLabel } from '@/lib/korean-date-text'
import { useUnsavedInput } from '@/lib/leave-guard'
import { MinutesDoneSidebar } from './MinutesDoneSidebar'
import { OrphanDrafts } from './MinutesDraftTexts'
import { MinutesDoneSummary } from './MinutesDoneSummary'
import { MinutesDoneAgenda, type AmendTarget } from './MinutesDoneAgenda'
import type { MinutesDraft } from './minutes-drafts'
import { MEETING_STATUS } from './meeting-text'
import { MINUTES_TEXT as T, confirmedLabel } from './minutes-text'

type Props = {
  councilId: string
  meeting: MeetingDetail
  drafts: ReadonlyMap<string, MinutesDraft>
  orphans: string[]
  entries: (activeForm?: string) => string[]
  submit: (suffix: string, value: object) => Promise<string | null>
  onAmended: (id: string) => void
  initialEditing?: AmendTarget
}
export function MeetingMinutesDone({
  councilId,
  meeting,
  drafts,
  orphans,
  entries,
  submit,
  onAmended,
  initialEditing,
}: Props) {
  const [editing, setEditing] = useState<AmendTarget | null>(initialEditing ?? null)
  const amendable = meeting.actions.includes('meeting.amend')
  const remaining = entries(editing ? `amend:${editing.kind}:${editing.id}` : undefined).filter(
    text => !orphans.includes(text),
  )
  // 확정으로 폼이 내려가면 폼의 떠날 때 확인도 풀린다. 남은 폼 글은 메모리에만 있으므로 여기서 다시 건다.
  useUnsavedInput(remaining.length > 0)
  return (
    <div className="flex min-w-0 flex-col gap-5 break-keep">
      <PageHeading trail={{ title: T.done, crumbs: [{ label: meeting.title, truncate: true }] }}>
        <h1 className="text-xl font-semibold">{T.done}</h1>
      </PageHeading>
      <OrphanDrafts texts={orphans} />
      <OrphanDrafts texts={remaining} label={T.remainingEntry} />
      <Alert tone="success" role="status" className="flex flex-col gap-2 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-semibold">{T.confirmed}</span>
          <Badge tone="success">{MEETING_STATUS.done.label}</Badge>
        </div>
        {meeting.confirmedAt && (
          <p className="tabular-nums">
            {confirmedLabel(dayTimeLabel(meeting.confirmedAt), meeting.confirmedBy?.name)}
          </p>
        )}
      </Alert>
      <MinutesDoneSummary councilId={councilId} meeting={meeting} />
      <div className="grid min-w-0 gap-5 sm:grid-cols-3">
        <div className="flex min-w-0 flex-col gap-4 sm:col-span-2">
          {meeting.agenda.length ? (
            meeting.agenda.map(item => (
              <MinutesDoneAgenda
                key={item.id}
                item={item}
                draft={drafts.get(item.id)}
                amendable={amendable}
                editing={editing}
                onEdit={setEditing}
                submit={submit}
                onAmended={onAmended}
              />
            ))
          ) : (
            <Card className="p-5 text-sm text-muted-foreground">{T.emptyAgenda}</Card>
          )}
        </div>
        <MinutesDoneSidebar meeting={meeting} councilId={councilId} />
      </div>
    </div>
  )
}
