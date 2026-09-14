export const SCREEN = 'FIN-00'
export const NODE = {
  breadcrumb: '30:2549',
  period: '30:2559',
  intro: '30:2570',
  totalBudget: '30:2576',
  spent: '30:2589',
  planned: '30:2602',
  available: '30:2616',
  execution: '30:2629',
  scope: '30:2650',
  breakdown: '30:2655',
  recent: '30:2697',
  ledgerLink: '30:2701',
  proof: '30:2735',
} as const
export const ASSET = {
  breadcrumbSeparator: '30:2553',
  ledgerLink: '30:2703',
} as const
export const CARDS = [
  { node: NODE.totalBudget, asset: '30:2577', tone: 'blue', noteWeight: 'font-normal' },
  { node: NODE.spent, asset: '30:2591', tone: 'green', noteWeight: 'font-medium' },
  { node: NODE.planned, asset: '30:2604', tone: 'orange', noteWeight: 'font-medium' },
  { node: NODE.available, asset: '30:2617', tone: 'indigo', noteWeight: 'font-normal' },
] as const
export const VARIANT_BUDGET_CARD = {
  screen: 'FIN-00B',
  node: '30:2863',
  asset: '30:2865',
  tone: 'blue',
  noteWeight: 'font-medium',
} as const
export const PROOF_TONE: Record<string, string> = {
  completed: 'green',
  supplement: 'yellow',
  unregistered: 'red',
}
