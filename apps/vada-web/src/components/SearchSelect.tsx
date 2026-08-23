import { useEffect, useMemo, useState } from 'react'
import type { FocusEvent, KeyboardEvent } from 'react'
import { ChevronDown, Loader2, Search } from 'lucide-react'
import { fetchOptions, getOptionSource } from '../option-sources/catalog'
import type { Option } from '../option-sources/catalog'

interface SearchSelectProps {
  id: string
  placeholder: string | null
  searchable: boolean
  disabled: boolean
  hasError?: boolean
  sourceKey: string
  sourceParams: Record<string, string>
  value: Option | null
  onSelect: (option: Option) => void
  triggerRef?: (element: HTMLElement | null) => void
}

type PanelStatus = 'idle' | 'loading' | 'ready' | 'error'

// Text Input 7:46 계열: pl 31.5→36(pl-9), pr 28→32(pr-8), py 7→8, radius 5.25→6.
// 활성: bg white·border gray-300·아이콘 gray-400 / 비활성(7:57): bg gray-50·
// border gray-200·텍스트 gray-400·아이콘 gray-300 — wireframe 사실.
// 목록 패널·상태 표시·키보드 조작은 vada-conventions 7번을 따른다.
export function SearchSelect({
  id,
  placeholder,
  searchable,
  disabled,
  hasError,
  sourceKey,
  sourceParams,
  value,
  onSelect,
  triggerRef,
}: SearchSelectProps) {
  const source = useMemo(() => getOptionSource(sourceKey), [sourceKey])
  const loadMode = source.type === 'static' ? 'static' : source.request.loadOn
  const remoteSearch =
    source.type === 'remote' && source.request.search?.mode === 'remote'
      ? source.request.search
      : null
  const messages = source.type === 'remote' ? source.messages : null
  const paramsKey = JSON.stringify(sourceParams)

  // 닫힘 상태의 기준값. 열리는 첫 프레임에 stale 목록·오도성 메시지가
  // 그려지지 않도록 close 시 항상 이 기준으로 되돌린다(F3).
  const baseStatus: PanelStatus =
    loadMode === 'open' ? 'loading' : loadMode === 'search' ? 'idle' : 'ready'

  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [remoteOptions, setRemoteOptions] = useState<Option[]>([])
  const [status, setStatus] = useState<PanelStatus>(baseStatus)
  const [highlightIndex, setHighlightIndex] = useState(-1)

  function close() {
    setOpen(false)
    setQuery('')
    setRemoteOptions([])
    setStatus(baseStatus)
    setHighlightIndex(-1)
  }

  useEffect(() => {
    if (disabled && open) {
      close()
    }
  }, [disabled, open]) // eslint-disable-line react-hooks/exhaustive-deps -- close는 setState 묶음이라 안정적이다

  // loadOn: open — 메뉴를 열 때 목록을 불러온다(education.colleges/departments).
  useEffect(() => {
    if (!open || loadMode !== 'open') {
      return
    }
    let cancelled = false
    setStatus('loading')
    fetchOptions(sourceKey, JSON.parse(paramsKey) as Record<string, string>)
      .then((options) => {
        if (!cancelled) {
          setRemoteOptions(options)
          setStatus('ready')
        }
      })
      .catch(() => {
        if (!cancelled) {
          setStatus('error')
        }
      })
    return () => {
      cancelled = true
    }
  }, [open, loadMode, sourceKey, paramsKey])

  // loadOn: search — 검색어 minLength 이상에서 debounce 후 원격 검색(education.schools).
  useEffect(() => {
    if (!open || loadMode !== 'search' || !remoteSearch) {
      return
    }
    const trimmed = query.trim()
    if (trimmed.length < remoteSearch.minLength) {
      setStatus('idle')
      setRemoteOptions([])
      return
    }
    let cancelled = false
    setStatus('loading')
    const timer = setTimeout(() => {
      fetchOptions(sourceKey, JSON.parse(paramsKey) as Record<string, string>, trimmed)
        .then((options) => {
          if (!cancelled) {
            setRemoteOptions(options)
            setStatus('ready')
          }
        })
        .catch(() => {
          if (!cancelled) {
            setStatus('error')
          }
        })
    }, remoteSearch.debounceMs)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [open, loadMode, remoteSearch, query, sourceKey, paramsKey])

  const baseOptions = source.type === 'static' ? source.options : remoteOptions
  const clientFilter =
    searchable && loadMode !== 'search' && query.trim().length > 0
  const visibleOptions = clientFilter
    ? baseOptions.filter((option) => option.label.includes(query.trim()))
    : baseOptions

  // 목록 내용이 바뀌면 키보드 하이라이트를 초기화한다.
  const optionsKey = visibleOptions.map((option) => option.value).join('|')
  useEffect(() => {
    setHighlightIndex(-1)
  }, [optionsKey, open])

  function pick(option: Option) {
    onSelect(option)
    close()
  }

  function moveHighlight(delta: number) {
    if (visibleOptions.length === 0) {
      return
    }
    const next =
      highlightIndex < 0
        ? delta > 0
          ? 0
          : visibleOptions.length - 1
        : (highlightIndex + delta + visibleOptions.length) % visibleOptions.length
    setHighlightIndex(next)
    document
      .getElementById(`${id}-option-${next}`)
      ?.scrollIntoView({ block: 'nearest' })
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (disabled) {
      return
    }
    if (event.key === 'Escape') {
      close()
      return
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      if (!open) {
        setOpen(true)
        return
      }
      moveHighlight(event.key === 'ArrowDown' ? 1 : -1)
      return
    }
    if (event.key === 'Enter' && open) {
      event.preventDefault()
      const option = visibleOptions[highlightIndex]
      if (option) {
        pick(option)
      }
    }
  }

  // 포커스가 컴포넌트(입력·옵션 버튼) 밖으로 나가면 닫는다(F1).
  function handleBlur(event: FocusEvent<HTMLDivElement>) {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
      close()
    }
  }

  const boxClass = `w-full rounded-md border py-2 text-left text-sm focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 focus:outline-none ${
    searchable ? 'pl-9 pr-8' : 'pl-3 pr-8'
  } ${
    disabled
      ? 'cursor-not-allowed border-gray-200 bg-gray-50 text-gray-400'
      : `bg-white ${hasError ? 'border-red-500' : 'border-gray-300'} text-gray-800`
  }`
  const iconClass = `pointer-events-none absolute top-1/2 size-4 -translate-y-1/2 ${
    disabled ? 'text-gray-300' : 'text-gray-400'
  }`

  const activeDescendant =
    open && highlightIndex >= 0 ? `${id}-option-${highlightIndex}` : undefined

  let statusMessage: string | null = null
  if (status === 'loading') {
    statusMessage = messages?.loading ?? '불러오는 중입니다'
  } else if (status === 'error') {
    statusMessage = messages?.error ?? '목록을 불러오지 못했습니다'
  } else if (status === 'idle' && loadMode === 'search') {
    statusMessage = messages?.idle ?? null
  } else if (visibleOptions.length === 0) {
    statusMessage = messages?.empty ?? '선택할 수 있는 항목이 없습니다.'
  }

  return (
    <div className="relative" onKeyDown={handleKeyDown} onBlur={handleBlur}>
      {searchable ? (
        <input
          ref={triggerRef}
          id={id}
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls={`${id}-listbox`}
          aria-activedescendant={activeDescendant}
          aria-autocomplete="list"
          aria-invalid={hasError || undefined}
          aria-describedby={hasError ? `${id}-error` : undefined}
          disabled={disabled}
          placeholder={placeholder ?? undefined}
          value={open ? query : (value?.label ?? '')}
          onClick={() => setOpen(true)}
          onChange={(event) => {
            setOpen(true)
            setQuery(event.target.value)
          }}
          className={`${boxClass} placeholder:text-gray-400`}
        />
      ) : (
        <button
          ref={triggerRef}
          id={id}
          type="button"
          role="combobox"
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={`${id}-listbox`}
          aria-activedescendant={activeDescendant}
          aria-invalid={hasError || undefined}
          aria-describedby={hasError ? `${id}-error` : undefined}
          disabled={disabled}
          onClick={() => (open ? close() : setOpen(true))}
          className={boxClass}
        >
          {/* 값이 없어 안내 문구를 그리는 중이라는 표시. design 대조가 이 자리의
              색을 견주지 않는다 — 정적 와이어프레임은 빈 칸과 값이 든 칸을
              구분해 그리지 못한다(design-check/index.ts). */}
          <span
            data-design-state={value ? undefined : ''}
            className={`block min-h-5 truncate ${value ? '' : 'text-gray-400'}`}
          >
            {value?.label ?? placeholder ?? ''}
          </span>
        </button>
      )}
      {searchable && <Search className={`${iconClass} left-3`} />}
      <ChevronDown className={`${iconClass} right-2.5`} />
      {open && !disabled && (
        <div className="absolute top-full left-0 z-10 mt-1 max-h-56 w-full overflow-auto rounded-md border border-gray-200 bg-white py-1 shadow-md">
          {statusMessage !== null ? (
            <div
              role="status"
              className={`flex items-center gap-2 px-3 py-2 text-sm ${
                status === 'error' ? 'text-red-500' : 'text-gray-500'
              }`}
            >
              {status === 'loading' && <Loader2 className="size-4 animate-spin" />}
              {statusMessage}
            </div>
          ) : (
            <div id={`${id}-listbox`} role="listbox">
              {visibleOptions.map((option, index) => (
                <button
                  key={option.value}
                  id={`${id}-option-${index}`}
                  type="button"
                  role="option"
                  aria-selected={option.value === value?.value}
                  onClick={() => pick(option)}
                  onMouseEnter={() => setHighlightIndex(index)}
                  className={`block w-full px-3 py-2 text-left text-sm hover:bg-gray-50 ${
                    index === highlightIndex ? 'bg-gray-50' : ''
                  } ${
                    option.value === value?.value
                      ? 'font-medium text-blue-600'
                      : 'text-gray-800'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
