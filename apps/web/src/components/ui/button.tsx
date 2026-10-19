import type { ComponentProps } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

// 와이어프레임 Btn: 반경 3.5px, 굵기 500. 모든 변형에 1px 테두리를 둬 주 버튼과 테두리 버튼의 높이(md 33.5px)를 맞춘다.
export const buttonVariants = cva(
  'inline-flex shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-sm border font-medium whitespace-nowrap transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-45 [&_svg]:pointer-events-none [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-primary text-primary-foreground hover:bg-blue-700',
        outline: 'border-input bg-white text-gray-700 hover:bg-gray-50',
        secondary: 'border-transparent bg-secondary text-secondary-foreground hover:bg-gray-200',
        ghost:
          'border-transparent bg-transparent text-gray-500 hover:bg-gray-100 hover:text-gray-700',
        destructive: 'border-transparent bg-destructive text-white hover:bg-red-700',
        link: 'border-transparent bg-transparent text-blue-500 underline-offset-4 hover:underline',
      },
      size: {
        md: 'px-4 py-2 text-sm [&_svg]:size-4',
        sm: 'px-3 py-1.5 text-xs [&_svg]:size-3.5',
        icon: 'p-2 [&_svg]:size-4',
      },
    },
    defaultVariants: { variant: 'default', size: 'md' },
  },
)

// type을 따로 정하지 않는다. form 안의 버튼은 브라우저 기본값(submit)을 그대로 쓴다.
export function Button({
  className,
  variant,
  size,
  ...props
}: ComponentProps<'button'> & VariantProps<typeof buttonVariants>) {
  return (
    <button
      data-slot="button"
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  )
}
