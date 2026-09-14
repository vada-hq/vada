export const SCREEN = 'FIN-EVID-01'

export const NODE = {
  head: '30:1865',
  payments: '30:1887',
  vendor: '30:1889',
  amount: '30:1894',
  items: '30:1899',
  documents: '30:1908',
  addFile: '30:1922',
  save: '30:2012',
  complete: '30:2014',
} as const

export const ASSET = { addFile: '30:1924' } as const
export const BREADCRUMB_SEPARATORS = ['30:1841', '30:1846', '30:1851', '30:1856']
export const TILE_TEXT: Record<string, string> = { paidAmountNote: 'text-blue-700' }
