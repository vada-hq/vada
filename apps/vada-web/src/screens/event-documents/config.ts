export const EVENT_DOCUMENT_SCREEN = 'EVT-DOC-01'

export const EVENT_DOCUMENT_NODE = {
  stats: '28:540',
  filter: '28:562',
  table: '28:578',
} as const

export const EVENT_DOCUMENT_ASSET = {
  workspaceStatus: { startAt: '28:522' } as Record<string, string>,
  document: '28:590',
} as const
