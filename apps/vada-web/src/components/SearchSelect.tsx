import { useEffect, useMemo, useRef, useState } from 'react'
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
// 목록 패널과 상태 표시는 vada-conventions 7번(카탈로그 messages + Loader2).
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
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [remoteOptions, setRemoteOptions] = useState<Option[]>([])
  const [status, setStatus] = useState<PanelStatus>('idle')
  const rootRef = useRef<HTMLDivElement | null>(null)

  const source = useMemo(() => getOptionSource(sourceKey), [sourceKey])
  const loadMode =
    source.type === 'static' ? 'static' : source.request.loadOn
  const remoteSearch =
    source.type === 'remote' && source.request.search?.mode === 'remote'
      ? source.request.search
      : null
  const messages = source.type === 'remote' ? source.messages : null
  const paramsKey = JSON.stringify(sourceParams)

  function close() {
    setOpen(false)
    setQuery('')
  }

  useEffect(() => {
    if (disabled && open) {
      close()
    }
  }, [disabled, open])

  useEffect(() => {
    if (!open) {
      return
    }
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        close()
      }
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [open])

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

  function pick(option: Option) {
    onSelect(option)
    close()
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

  let panelBody
  if (status === 'loading') {
    panelBody = (
      <div className="flex items-center gap-2 px-3 py-2 text-sm text-gray-500">
        <Loader2 className="size-4 animate-spin" />
        {messages?.loading}
      </div>
    )
  } else if (status === 'error') {
    panelBody = (
      <div className="px-3 py-2 text-sm text-red-500">{messages?.error}</div>
    )
  } else if (status === 'idle' && loadMode === 'search') {
    panelBody = (
      <div className="px-3 py-2 text-sm text-gray-500">{messages?.idle}</div>
    )
  } else if (visibleOptions.length === 0) {
    panelBody = (
      <div className="px-3 py-2 text-sm text-gray-500">
        {messages?.empty ?? '선택할 수 있는 항목이 없습니다.'}
      </div>
    )
  } else {
    panelBody = visibleOptions.map((option) => (
      <button
        key={option.value}
        type="button"
        role="option"
        aria-selected={option.value === value?.value}
        onClick={() => pick(option)}
        className={`block w-full px-3 py-2 text-left text-sm hover:bg-gray-50 ${
          option.value === value?.value
            ? 'font-medium text-blue-600'
            : 'text-gray-800'
        }`}
      >
        {option.label}
      </button>
    ))
  }

  return (
    <div
      ref={rootRef}
      className="relative"
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          close()
        }
      }}
    >
      {searchable ? (
        <input
          ref={triggerRef}
          id={id}
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls={`${id}-listbox`}
          aria-invalid={hasError || undefined}
          aria-describedby={hasError ? `${id}-error` : undefined}
          disabled={disabled}
          placeholder={placeholder ?? undefined}
          value={open ? query : (value?.label ?? '')}
          onFocus={() => setOpen(true)}
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
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={`${id}-listbox`}
          aria-invalid={hasError || undefined}
          aria-describedby={hasError ? `${id}-error` : undefined}
          disabled={disabled}
          onClick={() => (open ? close() : setOpen(true))}
          className={boxClass}
        >
          <span className={`block min-h-5 truncate ${value ? '' : 'text-gray-400'}`}>
            {value?.label ?? placeholder ?? ''}
          </span>
        </button>
      )}
      {searchable && <Search className={`${iconClass} left-3`} />}
      <ChevronDown className={`${iconClass} right-2.5`} />
      {open && !disabled && (
        <div
          id={`${id}-listbox`}
          role="listbox"
          className="absolute top-full left-0 z-10 mt-1 max-h-56 w-full overflow-auto rounded-md border border-gray-200 bg-white py-1 shadow-md"
        >
          {panelBody}
        </div>
      )}
    </div>
  )
}
