import { SearchSelectPanel } from './search-select/SearchSelectPanel'
import { SearchSelectTrigger } from './search-select/SearchSelectTrigger'
import type { SearchSelectProps } from './search-select/types'
import { useSearchSelect } from './search-select/useSearchSelect'

// 검색 선택 상자의 조립과 포커스 경계만 담당한다.
export function SearchSelect(props: SearchSelectProps) {
  const model = useSearchSelect(props)

  return (
    <div className="relative" onKeyDown={model.handleKeyDown} onBlur={model.handleBlur}>
      <SearchSelectTrigger model={model} />
      <SearchSelectPanel model={model} />
    </div>
  )
}
