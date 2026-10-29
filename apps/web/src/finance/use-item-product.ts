import { useEffect, useRef, useState } from 'react'
import { readProductInfo, type ProductState } from '@/lib/product-info'
import { useLatest } from '@/lib/use-latest'
import { withLoaded } from '@/chat/request-seed'
import type { ItemValues } from './request-form'

type ItemProductState = { kind: 'idle' } | Exclude<ProductState, { kind: 'ready' }>

export function useItemProduct(
  councilId: string,
  values: ItemValues,
  onChange: (next: ItemValues) => void,
) {
  const latest = useLatest({ values, onChange })
  const sequence = useRef(0)
  const [resultState, setState] = useState<{ link: string; value: ItemProductState }>({
    link: values.link,
    value: { kind: 'idle' },
  })
  useEffect(
    () => () => {
      sequence.current++
    },
    [],
  )
  async function load() {
    const link = values.link
    const current = ++sequence.current
    setState({ link, value: { kind: 'loading' } })
    const result = await readProductInfo(councilId, link)
    if (current !== sequence.current || latest.current.values.link !== link) return
    setState({ link, value: result.kind === 'ready' ? { kind: 'idle' } : result })
    if (result.kind !== 'ready') return
    const row = latest.current.values
    latest.current.onChange({
      ...row,
      ...withLoaded({ ...row, loadedPrice: row.loadedPrice ?? null }, result.product),
    })
  }
  return {
    state: resultState.link === values.link ? resultState.value : ({ kind: 'idle' } as const),
    load,
  }
}
