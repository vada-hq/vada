export const SCREEN = 'EVT-FIN-01'

export const NODE = {
  myRequests: '28:780',
  newRequest: '28:785',
  totals: '28:836',
  tab: '28:866',
  alerts: '28:872',
  columns: ['28:878', '28:914', '28:920', '28:926'],
} as const

export const ASSET = {
  workspaceStatus: { startAt: '28:823' } as Record<string, string>,
  myRequests: '28:781',
  newRequest: '28:786',
} as const

export const TILE_TONE: Record<string, string> = { available: 'blue' }
