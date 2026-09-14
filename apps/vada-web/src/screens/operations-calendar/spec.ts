export const SCREEN = 'OPS-CAL-01'

export const NODE = {
  breadcrumb: '30:2090',
  previousMonth: '30:2106',
  month: '30:2110',
  nextMonth: '30:2112',
  filter: '30:2117',
  legend: '30:2126',
  grid: '30:2141',
  weekHeader: '30:2363',
  week: '30:2368',
} as const

export const ASSET = {
  breadcrumbSeparator: '30:2094',
  weekEnter: '30:2374',
} as const

export const WEEKDAYS = [
  { label: '일', className: 'text-red-400' },
  { label: '월', className: 'text-gray-400' },
  { label: '화', className: 'text-gray-400' },
  { label: '수', className: 'text-gray-400' },
  { label: '목', className: 'text-gray-400' },
  { label: '금', className: 'text-gray-400' },
  { label: '토', className: 'text-blue-400' },
] as const
