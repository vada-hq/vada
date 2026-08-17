import type { ReactNode } from 'react'

interface FieldProps {
  htmlFor: string
  label: string
  required: boolean
  disabled?: boolean
  error?: string
  // 스펙의 helperText: 필드 아래에 항상 표시하는 보조 설명(14:221, 11→text-xs gray-400).
  helperText?: string
  children: ReactNode
}

// 라벨 10.5→12(text-xs) medium, 라벨-컨트롤 간격 5.25→6(gap-1.5).
// 활성 라벨 #364153(gray-700), 비활성 라벨 #99A1AF(gray-400)는 wireframe 사실.
// 오류는 vada-conventions 7번: 필드 아래 인라인 red-500.
export function Field({
  htmlFor,
  label,
  required,
  disabled,
  error,
  helperText,
  children,
}: FieldProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label
        htmlFor={htmlFor}
        className={`text-xs font-medium ${disabled ? 'text-gray-400' : 'text-gray-700'}`}
      >
        {label}
        {required && <span className="text-red-500">*</span>}
      </label>
      {children}
      {helperText && <p className="text-xs text-gray-400">{helperText}</p>}
      {error && (
        <p id={`${htmlFor}-error`} className="text-xs text-red-500">
          {error}
        </p>
      )}
    </div>
  )
}
