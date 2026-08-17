import { useEffect, useState } from 'react'
import { fetchOptions, getOptionSource } from '../option-sources/catalog'
import type { Option } from '../option-sources/catalog'

interface ChoiceGroupProps {
  id: string
  disabled: boolean
  labelledBy?: string
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
  labelledBy,
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

  const hasDescriptions = options.some((option) => Boolean(option.description))

  return (
    <div
      id={id}
      role="radiogroup"
      // label 요소는 div를 이름 짓지 못하므로 명시적으로 연결한다.
      // 디자인에 라벨이 없는 선택(ORG-02)은 연결할 대상이 없어 생략한다.
      aria-labelledby={labelledBy}
      aria-invalid={hasError || undefined}
      aria-describedby={hasError ? `${id}-error` : undefined}
      // 설명이 있는 선택지는 카드형(2열, 14:257), 없으면 압축형(3열, ORG-01 14:170).
      className={`grid gap-2 ${hasDescriptions ? 'grid-cols-2' : 'grid-cols-3'}`}
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
            className={`rounded border focus-visible:ring-2 focus-visible:ring-blue-600/50 focus-visible:outline-none ${
              hasDescriptions ? 'px-4 py-3 text-left' : 'px-3 py-2 text-xs font-medium'
            } ${
              selected
                ? 'border-blue-500 bg-blue-50'
                : `bg-white hover:bg-gray-50 ${hasError ? 'border-red-500' : 'border-gray-200'}`
            } ${disabled || option.disabled ? 'cursor-not-allowed opacity-50' : ''}`}
          >
            {hasDescriptions ? (
              <>
                {/* 라디오 표시 14:260/14:261: 선택 시 blue-600 점 */}
                <span className="flex items-center gap-2">
                  <span
                    className={`flex size-4 shrink-0 items-center justify-center rounded-full border ${
                      selected ? 'border-blue-600' : 'border-gray-300'
                    }`}
                  >
                    {selected && <span className="size-2 rounded-full bg-blue-600" />}
                  </span>
                  <span
                    className={`text-sm font-semibold ${
                      selected ? 'text-blue-800' : 'text-gray-800'
                    }`}
                  >
                    {option.label}
                  </span>
                </span>
                {option.description && (
                  <span className="block pt-1 pl-6 text-xs text-gray-500">
                    {option.description}
                  </span>
                )}
              </>
            ) : (
              <span className={selected ? 'text-blue-700' : 'text-gray-600'}>{option.label}</span>
            )}
          </button>
        )
      })}
    </div>
  )
}
