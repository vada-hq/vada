import { ChevronDown, Search } from 'lucide-react'
import type { SearchSelectModel } from './useSearchSelect'

export function SearchSelectTrigger({ model }: { model: SearchSelectModel }) {
  const boxClass = `w-full rounded-md border py-2 text-left text-sm focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 focus:outline-none ${
    model.searchable ? 'pl-9 pr-8' : 'pl-3 pr-8'
  } ${
    model.disabled
      ? 'cursor-not-allowed border-gray-200 bg-gray-50 text-gray-400'
      : `bg-white ${model.hasError ? 'border-red-500' : 'border-gray-300'} text-gray-800`
  }`
  const iconClass = `pointer-events-none absolute top-1/2 size-4 -translate-y-1/2 ${
    model.disabled ? 'text-gray-300' : 'text-gray-400'
  }`

  return (
    <>
      {model.searchable ? (
        <input
          ref={model.triggerRef}
          id={model.id}
          type="text"
          role="combobox"
          aria-expanded={model.open}
          aria-controls={`${model.id}-listbox`}
          aria-activedescendant={model.activeDescendant}
          aria-autocomplete="list"
          aria-invalid={model.hasError || undefined}
          aria-describedby={model.hasError ? `${model.id}-error` : undefined}
          disabled={model.disabled}
          placeholder={model.placeholder ?? undefined}
          value={model.open ? model.query : (model.value?.label ?? '')}
          onClick={() => model.setOpen(true)}
          onChange={(event) => {
            model.setOpen(true)
            model.setQuery(event.target.value)
          }}
          className={`${boxClass} placeholder:text-gray-400`}
        />
      ) : (
        <button
          ref={model.triggerRef}
          id={model.id}
          type="button"
          role="combobox"
          aria-haspopup="listbox"
          aria-expanded={model.open}
          aria-controls={`${model.id}-listbox`}
          aria-activedescendant={model.activeDescendant}
          aria-invalid={model.hasError || undefined}
          aria-describedby={model.hasError ? `${model.id}-error` : undefined}
          disabled={model.disabled}
          onClick={() => (model.open ? model.close() : model.setOpen(true))}
          className={boxClass}
        >
          <span
            data-design-state={model.value ? undefined : ''}
            className={`block min-h-5 truncate ${model.value ? 'text-gray-900' : 'text-gray-400'}`}
          >
            {model.value?.label ?? model.placeholder ?? ''}
          </span>
        </button>
      )}
      {model.searchable && <Search className={`${iconClass} left-3`} />}
      {model.chevron === undefined ? (
        <ChevronDown className={`${iconClass} right-2.5`} />
      ) : (
        <span className={`${iconClass} right-2.5`}>{model.chevron}</span>
      )}
    </>
  )
}
