import type { ComponentProps } from 'react'
import { cn } from '@/lib/utils'

// 와이어프레임 SIGN-IN·INV 화면의 가운데 카드(폭 520px, 여백 36px). 페이지 가운데 정렬은 쓰는 쪽이 맡는다.
// 조직도처럼 가로로 넓은 단계(data-wide-step)를 담으면 1024px 이상에서 넓어진다(와이어프레임 ORG-02 약 980px).
// 단계는 만들기 양식 안에서 바뀌어 틀이 알 길이 없으므로, 내용의 표시를 보고 넓힌다.
export const wideStepClass = 'lg:has-data-wide-step:max-w-244'
export function AuthCard({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      className={cn(
        'flex w-full max-w-148 flex-col gap-6 rounded-lg border bg-white p-6 shadow-sm sm:p-10',
        wideStepClass,
        className,
      )}
      {...props}
    />
  )
}
