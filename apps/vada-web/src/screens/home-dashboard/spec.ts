import { elementByNodeId, home01k } from '../../spec/screens'

export const SCREEN = 'HOME-01K'

export const ASSET = {
  mascot: '16:87',
  countTiles: ['16:103', '16:112', '16:124'],
  eventDate: '16:149',
  eventPlace: '16:156',
  eventLink: '16:169',
  calendarLink: '16:212',
  financeLink: '16:275',
  alertByKind: { document: '16:246', members: '16:259' } as Record<string, string>,
} as const

export const NODE = {
  briefing: '16:88',
  briefingNotices: '16:93',
  delayedTasksButton: '16:99',
  eventCounts: '16:101',
  events: '16:135',
  schedules: '16:206',
  calendarButton: '16:210',
  orgAlerts: '16:239',
  finance: '16:269',
  financeButton: '16:273',
  myTasksButton: '16:305',
} as const

export const COUNT_TILE_TONE = ['blue', 'indigo', 'orange']

export const FINANCE_TILE_TONE: Record<string, string> = {
  availableBudgetNote: 'blue',
  missingProofNote: 'red',
}

export function specOf<T>(nodeId: string): T {
  return elementByNodeId(home01k, nodeId).spec as T
}

export function alertIconOf(kind: string): string {
  const nodeId = ASSET.alertByKind[kind]
  if (!nodeId) {
    throw new Error(`조직 알림 종류 '${kind}'에 해당하는 아이콘이 없습니다.`)
  }
  return nodeId
}
