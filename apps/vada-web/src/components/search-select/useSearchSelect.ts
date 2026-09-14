import { useEffect, useMemo, useState } from 'react'
import type { FocusEvent, KeyboardEvent } from 'react'
import { fetchOptions } from '../../option-sources/catalog'
import { getOptionSource } from '../../option-sources/definitions'
import type { Option } from '../../option-sources/definitions'
import type { PanelStatus, SearchSelectProps } from './types'

export function useSearchSelect(props: SearchSelectProps) {
  const {
    id,
    disabled,
    searchable,
    sourceKey,
    sourceParams,
    onSelect,
  } = props
  const source = useMemo(() => getOptionSource(sourceKey), [sourceKey])
  const loadMode = source.type === 'static' ? 'static' : source.request.loadOn
  const remoteSearch =
    source.type === 'remote' && source.request.search?.mode === 'remote'
      ? source.request.search
      : null
  const messages = source.type === 'remote' ? source.messages : null
  const paramsKey = JSON.stringify(sourceParams)
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
    if (disabled && open) close()
  }, [disabled, open]) // eslint-disable-line react-hooks/exhaustive-deps -- close는 setState 묶음이라 안정적이다

  useEffect(() => {
    if (!open || loadMode !== 'open') return
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
        if (!cancelled) setStatus('error')
      })
    return () => {
      cancelled = true
    }
  }, [open, loadMode, sourceKey, paramsKey])

  useEffect(() => {
    if (!open || loadMode !== 'search' || !remoteSearch) return
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
          if (!cancelled) setStatus('error')
        })
    }, remoteSearch.debounceMs)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [open, loadMode, remoteSearch, query, sourceKey, paramsKey])

  const baseOptions = source.type === 'static' ? source.options : remoteOptions
  const clientFilter = searchable && loadMode !== 'search' && query.trim().length > 0
  const visibleOptions = clientFilter
    ? baseOptions.filter((option) => option.label.includes(query.trim()))
    : baseOptions
  const optionsKey = visibleOptions.map((option) => option.value).join('|')

  useEffect(() => {
    setHighlightIndex(-1)
  }, [optionsKey, open])

  function pick(option: Option) {
    onSelect(option)
    close()
  }

  function moveHighlight(delta: number) {
    if (visibleOptions.length === 0) return
    const next =
      highlightIndex < 0
        ? delta > 0
          ? 0
          : visibleOptions.length - 1
        : (highlightIndex + delta + visibleOptions.length) % visibleOptions.length
    setHighlightIndex(next)
    document.getElementById(`${id}-option-${next}`)?.scrollIntoView({ block: 'nearest' })
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (disabled) return
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
      if (option) pick(option)
    }
  }

  function handleBlur(event: FocusEvent<HTMLDivElement>) {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) close()
  }

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

  return {
    ...props,
    open,
    setOpen,
    query,
    setQuery,
    status,
    highlightIndex,
    setHighlightIndex,
    visibleOptions,
    activeDescendant:
      open && highlightIndex >= 0 ? `${id}-option-${highlightIndex}` : undefined,
    statusMessage,
    close,
    pick,
    handleKeyDown,
    handleBlur,
  }
}

export type SearchSelectModel = ReturnType<typeof useSearchSelect>
