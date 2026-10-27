import { useContext, useEffect, type ReactNode } from 'react'
import { GalleryContext, gallerySectionHref } from './GalleryNavigation'

export function Section({ title, children }: { title: string; children: ReactNode }) {
  const gallery = useContext(GalleryContext)
  const register = gallery?.register
  useEffect(() => {
    register?.(title)
  }, [register, title])
  if (gallery && gallery.section !== null && gallery.section !== title) return null
  return (
    <section className="flex flex-col gap-3 border-b py-6">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <h2 className="text-base break-keep wrap-anywhere">{title}</h2>
        <a
          href={gallerySectionHref(title)}
          className="inline-flex items-center text-sm break-keep text-primary underline-offset-4 hover:underline max-sm:min-h-11"
        >
          이것만 열기
        </a>
      </div>
      <div className="flex flex-wrap items-start gap-3">{children}</div>
    </section>
  )
}
