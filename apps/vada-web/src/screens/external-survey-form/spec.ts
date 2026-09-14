import shellJson from '../../../../../specs/figma/vada-wireframe/shell.json'

export const SCREEN = 'EXT-02A'
export const BRAND = (shellJson as { brand: { name: string } }).brand.name

export const NODE = {
  schedule: '30:7147',
  fee: '30:7173',
  name: '30:7179',
  studentNumber: '30:7184',
  college: '30:7189',
  department: '30:7196',
  currentGrade: '30:7203',
  motivation: '30:7210',
  consent: '30:7215',
  consentCheck: '30:7220',
  submit: '30:7228',
} as const

export const ROW_ASSET = ['30:7149', '30:7158', '30:7165'] as const

export const CHEVRON = {
  college: '30:7194',
  department: '30:7201',
  currentGrade: '30:7208',
} as const
