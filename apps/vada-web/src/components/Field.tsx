import type { ReactNode } from 'react'

interface FieldProps {
  htmlFor: string
  /** design 대조가 이 필드를 찾아가는 끈(spec/screens.ts의 nodeIdOf). */
  nodeId?: string
  // 디자인에 라벨이 없는 필드(ORG-02의 조직 구성 방식)는 스펙에 key가 없다.
  // 없는 카피를 지어내지 않고 라벨 자체를 그리지 않는다.
  label?: string
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
  nodeId,
  label,
  required,
  disabled,
  error,
  helperText,
  children,
}: FieldProps) {
  return (
    <div data-node-id={nodeId} className="flex flex-col gap-1.5">
      {label !== undefined && (
        <label
          id={`${htmlFor}-label`}
          htmlFor={htmlFor}
          className={`text-xs font-medium ${disabled ? 'text-gray-400' : 'text-gray-700'}`}
        >
          {/* design은 라벨과 필수 표시를 색이 다른 두 줄기로 그린다. 한 덩어리로
              그리면 그 색을 맞출 자리가 없어진다. */}
          <span>{label}</span>
          {required && <span className="text-red-500">*</span>}
        </label>
      )}
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
