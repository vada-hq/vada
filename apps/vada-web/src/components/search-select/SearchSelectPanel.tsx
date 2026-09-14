import { Loader2 } from 'lucide-react'
import type { SearchSelectModel } from './useSearchSelect'

export function SearchSelectPanel({ model }: { model: SearchSelectModel }) {
  if (!model.open || model.disabled) return null

  return (
    <div className="absolute top-full left-0 z-10 mt-1 max-h-56 w-full overflow-auto rounded-md border border-gray-200 bg-white py-1 shadow-md">
      {model.statusMessage !== null ? (
        <div
          role="status"
          className={`flex items-center gap-2 px-3 py-2 text-sm ${
            model.status === 'error' ? 'text-red-500' : 'text-gray-500'
          }`}
        >
          {model.status === 'loading' && <Loader2 className="size-4 animate-spin" />}
          {model.statusMessage}
        </div>
      ) : (
        <div id={`${model.id}-listbox`} role="listbox">
          {model.visibleOptions.map((option, index) => (
            <button
              key={option.value}
              id={`${model.id}-option-${index}`}
              type="button"
              role="option"
              aria-selected={option.value === model.value?.value}
              onClick={() => model.pick(option)}
              onMouseEnter={() => model.setHighlightIndex(index)}
              className={`block w-full px-3 py-2 text-left text-sm hover:bg-gray-50 ${
                index === model.highlightIndex ? 'bg-gray-50' : ''
              } ${
                option.value === model.value?.value
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
  )
}
