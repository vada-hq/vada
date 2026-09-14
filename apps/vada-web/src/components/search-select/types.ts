import type { ReactNode } from 'react'
import type { Option } from '../../option-sources/definitions'

export interface SearchSelectProps {
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
  chevron?: ReactNode
}

export type PanelStatus = 'idle' | 'loading' | 'ready' | 'error'
