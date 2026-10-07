import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

// 부품 기본 클래스 뒤에 쓰는 쪽 클래스를 붙일 때, 충돌하는 Tailwind 클래스는 뒤의 것을 남긴다.
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
