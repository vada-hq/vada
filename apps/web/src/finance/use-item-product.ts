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
  sending: boolean,
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
  // 보낸 뒤에 도착한 조회가 본문을 바꾸면 재시도가 새 명령이 되어 요청이 둘 생긴다. 보내면 남은 조회를 버린다.
  useEffect(() => {
    if (!sending) return
    sequence.current++
    setState(before => ({ ...before, value: { kind: 'idle' } }))
  }, [sending])
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
