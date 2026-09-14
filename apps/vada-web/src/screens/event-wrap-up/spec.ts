export const SCREEN = 'EVT-02D'

export const NODE = {
  state: '20:5829',
  banner: '20:5834',
  countsTitle: '20:5848',
  counts: ['20:5851', '20:5859', '20:5867', '20:5875'],
  basics: '20:5881',
  remaining: '20:5907',
  changes: '20:5989',
} as const

export const ASSET = {
  banner: '20:5835',
  workspaceStatus: { startAt: '20:5816' } as Record<string, string>,
  remainingByTone: {
    gray: '20:5912',
    red: '20:5925',
  } as Record<string, string>,
} as const
