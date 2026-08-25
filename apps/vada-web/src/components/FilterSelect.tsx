import { useState } from 'react'
import { FigmaAsset } from './FigmaAsset'
import { fetchOptions, getOptionSource, type Option } from '../option-sources/catalog'

// 목록을 좁히는 작은 드롭다운.
//
// SearchSelect와 다른 부품이다. 저쪽은 폼의 필드라 라벨·오류·비활성 사유를 갖고
// 화살표도 스스로 그리는데, 여기는 **디자인이 그린 화살표가 자산으로 뽑혀 있어**
// 그것을 그려야 한다. 자산 대조는 등록 노드 안의 그림을 모두 찾으므로, 제 화살표를
// 그리는 부품을 쓰면 그 자리가 어긋난다.
//
// 디자인이 문구를 하나도 그리지 않았다 — 빈 네모 넷이다. 그래서 무엇으로 거르는지는
// 명세의 placeholder가 갖고, 선택지는 서버가 준다.

interface FilterSelectProps {
  nodeId: string
  screenId: string
  chevronNodeId: string
  placeholder: string
  sourceKey: string
  sourceParams: Record<string, string>
  value: Option | null
  onSelect: (option: Option) => void
}

export function FilterSelect({
  nodeId,
  screenId,
  chevronNodeId,
  placeholder,
  sourceKey,
  sourceParams,
  value,
  onSelect,
}: FilterSelectProps) {
  const [open, setOpen] = useState(false)
  const [options, setOptions] = useState<Option[] | null>(null)
  const [failed, setFailed] = useState(false)
  const source = getOptionSource(sourceKey)
  // 상태 문구는 서버에 물어보는 출처만 갖는다 — 명세에 고정인 선택지는 기다릴 일이 없다.
  const messages = source.type === 'remote' ? source.messages : null

  // 목록은 메뉴를 열 때 불러온다(카탈로그의 loadOn: open). 한 번 받아 두면 다시
  // 열어도 그대로 쓴다 — 거르는 선택지가 보는 사이에 늘지는 않는다.
  async function toggle() {
    const next = !open
    setOpen(next)
    if (!next || options !== null) {
      return
    }
    try {
      setOptions(await fetchOptions(sourceKey, sourceParams))
    } catch {
      setFailed(true)
    }
  }

  return (
    <div data-node-id={nodeId} className="relative">
      <button
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={placeholder}
        onClick={toggle}
        className="flex w-40 items-center justify-between gap-2 rounded border border-gray-200 bg-white px-2.5 py-1.5 text-left text-xs text-gray-700 hover:bg-gray-50"
      >
        <span className={value === null ? 'truncate text-gray-400' : 'truncate'}>
          {value === null ? placeholder : value.label}
        </span>
        <FigmaAsset screenId={screenId} nodeId={chevronNodeId} className="size-3 shrink-0" />
      </button>

      {open ? (
        <ul
          role="listbox"
          aria-label={placeholder}
          className="absolute z-10 mt-1 w-40 overflow-hidden rounded border border-gray-200 bg-white py-1 shadow-lg"
        >
          {options === null && !failed ? (
            <li data-design-state="loading" className="px-2.5 py-1.5 text-xs text-gray-400">
              {messages?.loading}
            </li>
          ) : null}
          {failed ? (
            <li data-design-state="error" className="px-2.5 py-1.5 text-xs text-red-600">
              {messages?.error}
            </li>
          ) : null}
          {options !== null && options.length === 0 ? (
            <li data-design-state="empty" className="px-2.5 py-1.5 text-xs text-gray-400">
              {messages?.empty}
            </li>
          ) : null}
          {(options ?? []).map((option) => (
            <li key={option.value}>
              <button
                type="button"
                role="option"
                aria-selected={option.value === value?.value}
                onClick={() => {
                  onSelect(option)
                  setOpen(false)
                }}
                className="block w-full px-2.5 py-1.5 text-left text-xs text-gray-700 hover:bg-gray-50"
              >
                {option.label}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
