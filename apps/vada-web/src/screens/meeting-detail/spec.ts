import { opsMeet03b, opsMeet03c } from '../../spec/screens'

export const SCREEN = 'OPS-MEET-03A'

export const NODE = {
  viewerChip: '18:2871',
  roleNotice: '18:2879',
  meeting: '18:2889',
  facts: '18:2914',
  stateBanner: '18:2955',
  agendaHeader: '18:2967',
  agendas: '18:2975',
  documents: '18:2987',
  peopleHeader: '18:3035',
  people: '18:3040',
} as const

export const ASSET = {
  viewerChip: '18:2872',
  roleNotice: '18:2880',
  event: '18:2902',
  facts: ['18:2917', '18:2928', '18:2937', '18:2946'],
  stateBanner: '18:2956',
  document: '18:2988',
  person: '18:3042',
} as const

export const BREADCRUMB_SEPARATORS = ['18:2860', '18:2865']

export interface VariantSlot {
  node: string
  asset: string | null
  look: string
}

export const VARIANTS = {
  'OPS-MEET-03B': {
    header: [
      { node: '20:92', asset: '20:93', look: 'secondary' },
      { node: '20:97', asset: '20:98', look: 'primary' },
    ],
    banner: { node: '20:187', asset: null, look: 'quiet' },
    people: { node: '20:264', asset: '20:265', look: 'secondary' },
  },
  'OPS-MEET-03C': {
    header: [{ node: '20:417', asset: '20:418', look: 'primary' }],
    banner: null,
    people: { node: '20:581', asset: '20:582', look: 'readonly' },
  },
} as const

export const BUTTON_LOOK: Record<string, string> = {
  primary: 'bg-blue-600 text-white hover:bg-blue-700',
  secondary: 'border border-gray-300 bg-white text-gray-700 hover:bg-gray-50',
  quiet: 'text-red-600 hover:underline',
}

export function variantSpec(screenId: string) {
  return screenId === 'OPS-MEET-03B' ? opsMeet03b : opsMeet03c
}
