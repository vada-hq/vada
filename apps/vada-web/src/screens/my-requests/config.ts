export const MY_REQUESTS_SCREEN = 'MY-REQ-01'

export const MY_REQUESTS_NODE = {
  back: '30:151',
  heading: '30:155',
  scopeNote: '30:157',
  newRequest: '30:159',
  counts: '30:164',
  table: '30:190',
} as const

export const MY_REQUESTS_ASSET = {
  workspaceStatus: { startAt: '30:134' } as Record<string, string>,
  back: '30:151',
  newRequest: '30:160',
} as const

export const MY_REQUESTS_COUNT_TONE: Record<string, string> = {
  reviewCount: 'blue',
  supplementCount: 'yellow',
  approvedCount: 'green',
  purchasingCount: 'purple',
  doneCount: 'gray',
}

export const MY_REQUESTS_BREADCRUMB_SEPARATORS = ['30:80', '30:85', '30:90', '30:95']
