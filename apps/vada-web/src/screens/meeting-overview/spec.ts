export const SCREEN = 'OPS-MEET-01A'

export const NODE = {
  attention: '18:418',
  query: '18:432',
  filterA: '18:435',
  filterB: '18:436',
  groups: '18:437',
} as const

export const ASSET = {
  attention: '18:420',
  collapse: '18:441',
  clock: '18:448',
  date: '18:464',
  place: '18:471',
  host: '18:476',
} as const

export const CREATE_VARIANT = {
  screen: 'OPS-MEET-01C',
  node: '18:1392',
  asset: '18:1393',
} as const
