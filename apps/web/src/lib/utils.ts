import { clsx, type ClassValue } from 'clsx'
import { extendTailwindMerge } from 'tailwind-merge'

// index.css에 이름으로 더한 글자 크기·모서리(홈 구역 토큰). 알려 주지 않으면 tailwind-merge가 text-row-title을 글자색으로 읽어
// 부품 기본 글자 크기(text-sm)를 지우지 않고, 같은 줄의 글자색(text-fg)을 지운다.
const twMerge = extendTailwindMerge({
  extend: { theme: { text: ['row-title', 'row-sub', 'face'], radius: ['tray', 'group'] } },
})

// 부품 기본 클래스 뒤에 쓰는 쪽 클래스를 붙일 때, 충돌하는 Tailwind 클래스는 뒤의 것을 남긴다.
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
