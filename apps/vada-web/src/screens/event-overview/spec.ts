export const SCREEN = 'EVT-02'

export const NODE = {
  briefing: '20:4807',
  highlights: ['20:4819', '20:4826', '20:4833'],
  basics: '20:4842',
  recruit: '20:4882',
  recruitEdit: '20:4886',
  stats: '20:4910',
  checklist: '20:4939',
  changes: '20:4988',
} as const

export const ASSET = {
  briefing: '20:4808',
  workspaceStatus: { startAt: '20:4793' } as Record<string, string>,
  checklistByTone: {
    yellow: '20:4944',
    orange: '20:4957',
    red: '20:4967',
    green: '20:4980',
  } as Record<string, string>,
} as const

export const HIGHLIGHT_TONE: Record<string, string> = {
  '20:4819': 'red',
  '20:4826': 'yellow',
  '20:4833': 'blue',
}

export const STAT_TONE: Record<string, string> = {
  applicants: 'blue',
  paid: 'green',
  needsCheck: 'yellow',
  unassignedTasks: 'red',
}
