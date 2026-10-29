// 머리글·본문·갤러리가 같은 가운데 틀을 쓴다(DEC-101).
const WIDTH_CLASSES = {
  narrow: 'max-w-3xl',
  default: 'max-w-7xl',
} as const

export type PageWidth = keyof typeof WIDTH_CLASSES

export const pageFrameClass = (width: PageWidth) => `mx-auto w-full ${WIDTH_CLASSES[width]}`
