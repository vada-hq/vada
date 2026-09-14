import type { Db } from '../db/client.ts'
import { agendaRecordsOf, minutesRow } from './minutes-records.ts'
import { decided } from './minutes-progress.ts'

const NEEDS_CHECK = '확인 필요'

export interface AgendaOption {
  value: string
  label: string
  description?: string
  initiallySelected?: boolean
}

export async function agendaPickerOptions(
  db: Db,
  orgId: string,
  meetingId: string,
): Promise<AgendaOption[]> {
  await minutesRow(db, orgId, meetingId)
  const agendas = await agendaRecordsOf(db, orgId, meetingId)
  const firstOpen = agendas.findIndex((agenda) => !decided(agenda))
  const opened = firstOpen === -1 ? 0 : firstOpen
  return agendas.map((agenda, at) => {
    const option: AgendaOption = { value: agenda.id, label: `안건 ${at + 1}` }
    if (!decided(agenda)) option.description = NEEDS_CHECK
    if (at === opened) option.initiallySelected = true
    return option
  })
}
