import { appPath } from '@vada/contracts'

export const meetingMinutesPath = (councilId: string, recordId: string, agenda?: string) =>
  appPath({
    type: 'record',
    record: 'meetings',
    councilId,
    recordId,
    query: agenda ? { mode: 'minutes', agenda } : { mode: 'minutes' },
  })
