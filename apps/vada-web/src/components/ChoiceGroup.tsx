import { useEffect, useState } from 'react'
import { fetchOptions, getOptionSource } from '../option-sources/catalog'
import type { Option } from '../option-sources/catalog'

interface ChoiceGroupProps {
  id: string
  disabled: boolean
  hasError?: boolean
  sourceKey: string
  sourceParams: Record<string, string>
  value: Option | null
  onSelect: (option: Option) => void
  triggerRef?: (element: HTMLElement | null) => void
}

// select.presentation: choiceGroup — 선택지를 모두 펼친 버튼 묶음.
// 그리드 14:170: 3열, gap 7→8. 버튼 14:171: py 7→8, px 10.5→12, radius 3.5→4,
// border gray-200, 텍스트 10.5→12(text-xs) medium gray-600.
// 선택됨 14:173: bg #EFF6FF(blue-50), border #2B7FFF(blue-500), 텍스트 #1447E6(blue-700).
export function ChoiceGroup({
  id,
  disabled,
  hasError,
  sourceKey,
  sourceParams,
  value,
  onSelect,
  triggerRef,
}: ChoiceGroupProps) {
  const source = getOptionSource(sourceKey)
  const [options, setOptions] = useState<Option[]>(
    source.type === 'static' ? source.options : [],
  )
  const paramsKey = JSON.stringify(sourceParams)

  // 펼친 형태라 목록이 화면에 처음부터 있어야 한다. 원격 출처는 즉시 불러온다.
  useEffect(() => {
    if (source.type === 'static') {
      return
    }
    let cancelled = false
    fetchOptions(sourceKey, JSON.parse(paramsKey) as Record<string, string>)
      .then((loaded) => {
        if (!cancelled) {
          setOptions(loaded)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setOptions([])
        }
      })
    return () => {
      cancelled = true
    }
  }, [source.type, sourceKey, paramsKey])

  return (
    <div
      id={id}
      role="radiogroup"
      // label 요소는 div를 이름 짓지 못하므로 명시적으로 연결한다.
      aria-labelledby={`${id}-label`}
      aria-invalid={hasError || undefined}
      aria-describedby={hasError ? `${id}-error` : undefined}
      className="grid grid-cols-3 gap-2"
    >
      {options.map((option, index) => {
        const selected = option.value === value?.value
        return (
          <button
            // 판정 차단 시 포커스 대상은 묶음의 첫 선택지다.
            ref={index === 0 ? triggerRef : undefined}
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={disabled || option.disabled}
            onClick={() => onSelect(option)}
            className={`rounded border px-3 py-2 text-xs font-medium focus-visible:ring-2 focus-visible:ring-blue-600/50 focus-visible:outline-none ${
              selected
                ? 'border-blue-500 bg-blue-50 text-blue-700'
                : `bg-white text-gray-600 hover:bg-gray-50 ${
                    hasError ? 'border-red-500' : 'border-gray-200'
                  }`
            } ${disabled || option.disabled ? 'cursor-not-allowed opacity-50' : ''}`}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
