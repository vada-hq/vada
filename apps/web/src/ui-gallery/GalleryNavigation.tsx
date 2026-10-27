import { createContext, useCallback, useState, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

export const GalleryContext = createContext<{
  section: string | null
  register: (title: string) => void
} | null>(null)

export function gallerySectionHref(title: string) {
  return `/ui.html?${new URLSearchParams({ section: title })}`
}

export function GalleryNavigation({ children }: { children: ReactNode }) {
  const [section] = useState(() => new URLSearchParams(location.search).get('section'))
  const [titles, setTitles] = useState<string[]>([])
  const register = useCallback((title: string) => {
    setTitles(current => (current.includes(title) ? current : [...current, title]))
  }, [])
  return (
    <GalleryContext value={{ section, register }}>
      <nav aria-label="구역 목록" className="mt-4 border-b pb-4 text-sm">
        <ul className="flex max-h-64 flex-wrap gap-x-4 overflow-y-auto">
          {[null, ...titles].map(title => (
            <li key={title ?? 'all'}>
              <a
                href={title === null ? '/ui.html' : gallerySectionHref(title)}
                aria-current={section === title ? 'page' : undefined}
                className={cn(
                  'inline-flex min-w-11 items-center py-1 break-keep text-primary underline-offset-4 wrap-anywhere hover:underline max-sm:min-h-11',
                  section === title && 'font-bold',
                )}
              >
                {title ?? '모든 구역'}
              </a>
            </li>
          ))}
        </ul>
      </nav>
      {section !== null && titles.length > 0 && !titles.includes(section) && (
        <p className="py-6 text-sm">그런 구역이 없어요</p>
      )}
      {children}
    </GalleryContext>
  )
}
