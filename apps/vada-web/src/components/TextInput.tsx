interface TextInputProps {
  id: string
  value: string
  placeholder: string | null
  // 스펙의 inputType. 소비하지 않으면 스펙이 email이어도 화면은 text로 남는다.
  type?: string
  hasError?: boolean
  // 값을 보여주되 고칠 수 없는 칸(FIN-REQ-01의 요청 부서). 비활성이 아니다 —
  // 읽을 수 있고 고를 수 있으며 접근성 이름도 그대로다. 사람이 정하는 값이
  // 아닐 뿐이다. design도 이 칸만 바탕을 회색으로, 글을 흐리게 그렸다.
  readOnly?: boolean
  onChange: (value: string) => void
  inputRef?: (element: HTMLInputElement | null) => void
}

// Text Input 7:29: px 10.5→12, py 7→8, radius 5.25→6(rounded-md),
// border #D1D5DC(gray-300), 텍스트 12.25→14(text-sm) #1E2939(gray-800).
// placeholder는 원본 결함을 따르지 않고 gray-400(vada-conventions 5번).
export function TextInput({
  id,
  value,
  placeholder,
  type = 'text',
  hasError,
  readOnly,
  onChange,
  inputRef,
}: TextInputProps) {
  return (
    <input
      ref={inputRef}
      id={id}
      type={type}
      value={value}
      readOnly={readOnly}
      placeholder={placeholder ?? undefined}
      aria-invalid={hasError || undefined}
      aria-describedby={hasError ? `${id}-error` : undefined}
      onChange={(event) => onChange(event.target.value)}
      className={`w-full rounded-md border px-3 py-2 text-sm placeholder:text-gray-400 focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 focus:outline-none ${
        readOnly ? 'bg-gray-50 text-gray-400' : 'bg-white text-gray-800'
      } ${hasError ? 'border-red-500' : 'border-gray-300'}`}
    />
  )
}
