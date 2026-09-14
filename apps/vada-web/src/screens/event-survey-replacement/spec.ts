export const SCREEN = 'EVT-05B'

export const NODE = {
  statusChip: '25:1074',
  editBasics: '25:1119',
  startEvent: '25:1121',
  head: '25:1126',
  impact: '25:1132',
  notes: '25:1143',
  mode: '25:1160',
  cancel: '25:1182',
  replace: '25:1184',
} as const

export const ASSET = {
  workspaceStatus: { startAt: '25:1109' } as Record<string, string>,
} as const

export const BREADCRUMB_SEPARATORS = ['25:1058', '25:1063', '25:1068']
