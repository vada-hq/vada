import { useEffect, useState } from 'react'
import { NotBuiltYet } from '../../data-sources/server'
import { fetchOptions } from '../../option-sources/catalog'
import { getOptionSource } from '../../option-sources/definitions'
import type { Option } from '../../option-sources/definitions'
import type { SelectSpec } from '../../spec/types'
import { NODE } from './spec'

interface AgendaPickerProps {
  picker: SelectSpec
  label: string | undefined
  sourceParams: Record<string, string>
  chosen: string | null
  onSelect: (option: Option) => void
}

/** 원격 선택지를 불러오고 서버가 표시한 첫 안건을 선택한다. */
export function AgendaPicker({
  picker,
  label,
  sourceParams,
  chosen,
  onSelect,
}: AgendaPickerProps) {
  const source = getOptionSource(picker.optionsSource.key)
  const [options, setOptions] = useState<Option[]>(
    source.type === 'static' ? source.options : [],
  )
  const [failed, setFailed] = useState(false)
  const [notBuilt, setNotBuilt] = useState<NotBuiltYet | null>(null)
  const messages = source.type === 'remote' ? source.messages : null
  const paramsKey = JSON.stringify(sourceParams)

  useEffect(() => {
    if (source.type === 'static') {
      return
    }
    let cancelled = false
    setFailed(false)
    setNotBuilt(null)
    fetchOptions(picker.optionsSource.key, JSON.parse(paramsKey) as Record<string, string>)
      .then((loaded) => {
        if (!cancelled) {
          setOptions(loaded)
        }
      })
      .catch((thrown: unknown) => {
        if (cancelled) return
        setOptions([])
        if (thrown instanceof NotBuiltYet) setNotBuilt(thrown)
        else setFailed(true)
      })
    return () => {
      cancelled = true
    }
  }, [source.type, picker.optionsSource.key, paramsKey])

  useEffect(() => {
    if (chosen !== null) {
      return
    }
    const marked = options.find((option) => option.initiallySelected === true)
    if (marked !== undefined) {
      onSelect(marked)
    }
    // onSelect는 렌더마다 만들어지고, 선택 여부와 목록만 이 효과를 다시 실행해야 한다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options, chosen])

  if (notBuilt !== null) throw notBuilt

  if (failed) {
    return (
      <div
        id={picker.fieldKey}
        data-node-id={NODE.picker}
        data-design-state="error"
        className="border-b border-gray-100 px-5 py-4 text-xs text-red-600"
      >
        {messages?.error}
      </div>
    )
  }

  return (
    <div
      id={picker.fieldKey}
      role="radiogroup"
      aria-label={label}
      data-node-id={NODE.picker}
      className="flex flex-col gap-2 border-b border-gray-100 px-5 py-4"
    >
      {options.map((option) => {
        const selected = option.value === chosen
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onSelect(option)}
            className={`flex items-center justify-between rounded-lg border px-3 py-2 text-left ${
              selected ? 'border-blue-400 bg-blue-50' : 'border-gray-200'
            }`}
          >
            <span
              className={`text-xs font-bold ${selected ? 'text-blue-600' : 'text-gray-500'}`}
            >
              {option.label}
            </span>
            <span className="text-xs font-medium text-orange-600">{option.description}</span>
          </button>
        )
      })}
    </div>
  )
}
