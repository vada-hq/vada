export const EVENT_SCHEDULE_SCREEN = 'EVT-SCHED-01'

export const EVENT_SCHEDULE_NODE = {
  calendar: '28:148',
  filter: '28:150',
  timeline: '28:161',
} as const

export const EVENT_SCHEDULE_ASSET = {
  workspaceStatus: { startAt: '28:129' } as Record<string, string>,
  enter: '28:180',
} as const
