import { useState } from 'react'

export function useGalleryParam(name: string, fallback: string) {
  const [value, setValue] = useState(
    () => new URLSearchParams(location.search).get(name) ?? fallback,
  )
  const change = (next: string) => {
    const url = new URL(location.href)
    url.searchParams.set(name, next)
    history.replaceState(history.state, '', url)
    setValue(next)
  }
  return [value, change] as const
}
