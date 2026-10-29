import { useEffect, type Dispatch, type SetStateAction } from 'react'
import { PURCHASE_TITLE_MAX } from '@vada/contracts'
import { isProductLink, readProductInfo } from '@/lib/product-info'
import { clipText, withLoaded } from '../chat/request-seed'
import type { RequestValues } from './request-form'

// 메시지가 넘긴 시작 링크만 읽는다. 사람이 양식에서 새로 적은 링크는 024-9의 불러오기 몫이다.
// 응답이 늦어도 사람이 고친 이름·링크와 지운 품목을 되살리거나 덮지 않는다.
export function useRequestProductSeeds(
  councilId: string,
  initial: RequestValues,
  setValues: Dispatch<SetStateAction<RequestValues>>,
) {
  useEffect(() => {
    let live = true
    for (const item of initial.items) {
      if (item.loadedProduct || !isProductLink(item.link)) continue
      void readProductInfo(councilId, item.link).then(state => {
        if (!live || state.kind !== 'ready') return
        setValues(current => {
          if (!current.items.some(row => row.key === item.key && row.link === item.link))
            return current
          const items = current.items.map(row =>
            row.key === item.key && row.link === item.link
              ? {
                  ...row,
                  ...withLoaded({ ...row, loadedPrice: row.loadedPrice ?? null }, state.product),
                }
              : row,
          )
          return {
            ...current,
            title:
              item.key === initial.items[0]?.key &&
              !current.titleEdited &&
              (current.title.trim() === '' || current.title.trim() === item.link)
                ? clipText(items.find(row => row.key === item.key)?.name ?? '', PURCHASE_TITLE_MAX)
                : current.title,
            items,
          }
        })
      })
    }
    return () => {
      live = false
    }
  }, [councilId, initial, setValues])
}
