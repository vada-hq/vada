import { scalarValue as scalar } from '../../data-sources/values'
import { INITIAL_SECTION_KEY, NODE, SECTION_TONE } from './spec'
import type { ArchiveEditorModel } from './useArchiveEditor'

/** 서버가 계산한 절별 작성 상태를 목차로 표시한다. */
export function ArchiveToc({ model }: { model: ArchiveEditorModel }) {
  const { toc } = model.specs
  const [tocLabel, tocStatus] = toc.columns ?? []
  return (
    <nav
      data-node-id={NODE.toc}
      aria-label={toc.title}
      className="h-fit rounded-xl border border-gray-200 bg-white px-3 py-4"
    >
      <span className="block px-2 text-xs font-bold text-gray-400">{toc.title}</span>
      <ul className="pt-2">
        {model.tocRows.map((section) => {
          const tone = SECTION_TONE[scalar(section, tocStatus?.toneField)]
          const current = scalar(section, 'key') === INITIAL_SECTION_KEY
          return (
            <li
              key={scalar(section, 'key')}
              aria-current={current ? 'true' : undefined}
              className={`flex items-center justify-between rounded px-2 py-1.5 ${
                current ? 'bg-blue-50' : ''
              }`}
            >
              <span
                className={`text-xs ${
                  current
                    ? 'font-semibold text-blue-700'
                    : `font-medium ${tone?.label ?? 'text-gray-600'}`
                }`}
              >
                {scalar(section, (tocLabel?.fields ?? [])[0])}
              </span>
              <span
                className={`text-xs ${current ? 'font-semibold' : 'font-medium'} ${
                  tone?.status ?? 'text-gray-400'
                }`}
              >
                {scalar(section, (tocStatus?.fields ?? [])[0])}
              </span>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
