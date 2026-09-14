export const FINANCE_LEDGER_SCREEN = 'FIN-LEDGER-01'

export const FINANCE_LEDGER_NODE = {
  breadcrumb: '30:3125',
  termTotal: '30:3140',
  monthTotal: '30:3145',
  proofDone: '30:3150',
  proofMissing: '30:3155',
  search: '30:3161',
  month: '30:3167',
  event: '30:3172',
  department: '30:3177',
  budgetItem: '30:3182',
  ledger: '30:3188',
  scope: '30:3287',
} as const

export const FINANCE_LEDGER_ASSET = {
  breadcrumbSeparator: '30:3129',
  search: '30:3162',
  monthChevron: '30:3169',
  eventChevron: '30:3174',
  departmentChevron: '30:3179',
  budgetItemChevron: '30:3184',
} as const

export const FINANCE_LEDGER_FILTERS = [
  { node: FINANCE_LEDGER_NODE.month, chevron: FINANCE_LEDGER_ASSET.monthChevron },
  { node: FINANCE_LEDGER_NODE.event, chevron: FINANCE_LEDGER_ASSET.eventChevron },
  { node: FINANCE_LEDGER_NODE.department, chevron: FINANCE_LEDGER_ASSET.departmentChevron },
  { node: FINANCE_LEDGER_NODE.budgetItem, chevron: FINANCE_LEDGER_ASSET.budgetItemChevron },
] as const

export const FINANCE_LEDGER_TILES = [
  FINANCE_LEDGER_NODE.termTotal,
  FINANCE_LEDGER_NODE.monthTotal,
  FINANCE_LEDGER_NODE.proofDone,
  FINANCE_LEDGER_NODE.proofMissing,
] as const
