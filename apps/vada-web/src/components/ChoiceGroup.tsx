import { useEffect, useState } from 'react'
import { fetchOptions, getOptionSource } from '../option-sources/catalog'
import type { Option } from '../option-sources/catalog'

interface ChoiceGroupProps {
  id: string
  /** design 대조가 이 묶음을 찾아가는 끈(spec/screens.ts의 nodeIdOf). */
  nodeId?: string
  disabled: boolean
  labelledBy?: string
  hasError?: boolean
  sourceKey: string
  sourceParams: Record<string, string>
  value: Option | null
  onSelect: (option: Option) => void
  /**
   * 고른 선택지의 색이 값마다 다른 경우 그 표(선택). 무엇을 골랐느냐가 곧 결과인
   * 묶음이 그렇다(FIN-REV-01의 승인·보완·반려). 없으면 고른 것은 파랑 하나다.
   */
  selectedToneByValue?: Record<string, string>
  triggerRef?: (element: HTMLElement | null) => void
}

// select.presentation: choiceGroup — 선택지를 모두 펼친 버튼 묶음.
// 그리드 14:170: 3열, gap 7→8. 버튼 14:171: py 7→8, px 10.5→12, radius 3.5→4,
// border gray-200, 텍스트 10.5→12(text-xs) medium gray-600.
// 선택됨 14:173: bg #EFF6FF(blue-50), border #2B7FFF(blue-500), 텍스트 #1447E6(blue-700).
export function ChoiceGroup({
  id,
  nodeId,
  disabled,
  labelledBy,
  hasError,
  sourceKey,
  sourceParams,
  value,
  onSelect,
  selectedToneByValue,
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

  // **아무것도 고르지 않았으면 서버가 표시한 것을 연다.**
  //
  // 무엇이 열려 있어야 하는지는 서버가 안다(options[].initiallySelected). 화면이
  // '첫째를 연다'거나 '아직 안 끝난 것을 연다' 같은 규칙을 들면 그 규칙이 화면에
  // 박히고, 규칙이 바뀔 때마다 화면을 고쳐야 한다.
  //
  // 사람이 한 번 고르고 나면 다시 끼어들지 않는다 — value가 있으면 그것이 답이다.
  useEffect(() => {
    if (value !== null) {
      return
    }
    const marked = options.find((option) => option.initiallySelected === true)
    if (marked !== undefined) {
      onSelect(marked)
    }
    // onSelect는 그릴 때마다 새로 만들어지는 일이 많아 의존성에 두면 끝없이 돈다.
    // 여기서 보는 사실은 '목록이 왔는가'와 '아직 안 골랐는가' 둘뿐이다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options, value])

  const hasDescriptions = options.some((option) => Boolean(option.description))

  return (
    <div
      id={id}
      data-node-id={nodeId}
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
            // 아무것도 고르지 않은 상태는 design이 그리지 않았다 — 와이어프레임은
            // 늘 하나가 골라진 모습이다. 그 상태의 색은 대조하지 않는다
            // (design-check/index.ts의 data-design-state).
            data-design-state={value === null ? '' : undefined}
            // 고른 것의 색은 우리 규칙이 정한다(design/deviations.ts의 choice-group).
            data-design-rule="choice-group"
            role="radio"
            aria-checked={selected}
            disabled={disabled || option.disabled}
            onClick={() => onSelect(option)}
            className={`rounded border focus-visible:ring-2 focus-visible:ring-blue-600/50 focus-visible:outline-none ${
              hasDescriptions
                ? 'px-4 py-3 text-left'
                : // 압축형은 글자색을 버튼 자신이 갖는다. 안쪽 span에 칠하면 대조가
                  // 찾는 '가장 안쪽 칸'이 색 없는 그 span이 되어, 바탕과 글씨가
                  // 서로 다른 요소로 갈린다.
                  `px-3 py-2 text-xs ${
                    selectedToneByValue === undefined
                      ? `font-medium ${selected ? 'text-blue-700' : 'text-gray-600'}`
                      : `font-bold ${selected ? '' : 'text-gray-400'}`
                  }`
            } ${
              selected
                ? // 고른 테두리는 형태마다 다르다: 압축형 14:173은 blue-500,
                  // 카드형 14:259는 blue-400 — design의 사실이다.
                  (selectedToneByValue?.[option.value] ??
                    `bg-blue-50 ${hasDescriptions ? 'border-blue-400' : 'border-blue-500'}`)
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
                  <span className="block pt-1 pl-6 text-xs font-medium text-gray-500">
                    {option.description}
                  </span>
                )}
              </>
            ) : (
              option.label
            )}
          </button>
        )
      })}
    </div>
  )
}
