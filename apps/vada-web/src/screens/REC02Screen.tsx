import { useState } from 'react'
import { AppShell } from '../components/AppShell'
import { Breadcrumbs } from '../components/Breadcrumbs'
import { readListSource, readObjectSource } from '../data-sources/catalog'
import { scalarValue as scalar } from '../data-sources/values'
import { NEUTRAL_CHIP, STATE_CHIP } from '../design/tones'
import { resolveParams } from '../spec/params'
import { rec02 } from '../spec/screens'
import type { ScopeDraft } from '../state/scopes'
import { ArchiveChecklist } from './archive-view/ArchiveChecklist'
import { ArchiveDocumentSections } from './archive-view/ArchiveDocumentSections'
import { ASSET, INITIAL_SECTION, NODE, SCREEN, listAt, rowsOf, summaryAt } from './archive-view/spec'

interface REC02ScreenProps {
  screenParams: Record<string, string>
  draft: ScopeDraft
  onChangeDraft: (next: ScopeDraft) => void
  onNavigate: (screenId: string, params?: Record<string, string>) => void
}

/** 발행된 아카이브의 머리·목차·본문·체크리스트를 조립한다. */
export function REC02Screen({
  screenParams, draft, onChangeDraft, onNavigate,
}: REC02ScreenProps) {
  const [note, setNote] = useState<string | null>(null)
  const missing = (rec02.params ?? []).filter((param) => (screenParams[param.key] ?? '') === '')
  if (missing.length > 0) {
    return (
      <AppShell
        screenId={rec02.screenId}
        activeNavigationScreenId={rec02.activeNavigationScreenId}
        eyebrow={rec02.meta?.eyebrow}
        title={rec02.meta?.title ?? rec02.screenId}
        onNavigate={onNavigate}
      >
        <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {missing.map((param) => param.missingNote).join(' ')}
        </p>
      </AppShell>
    )
  }

  const head = summaryAt(NODE.head)
  const headRow = readObjectSource(head.dataSourceKey, resolveParams(head.params, { screenParams }))
  const [schedule, owner, published, author, reviewer] = head.items ?? []
  const toc = listAt(NODE.toc)
  const tocRows = readListSource(toc.dataSourceKey, resolveParams(toc.params, { screenParams }))
  const [tocLabel] = toc.columns ?? []
  const tocHeader = (toc.group?.headerFields ?? [])[0]
  const activeKey = scalar(tocRows[INITIAL_SECTION] ?? {}, 'key')
  const breadcrumb = rec02.breadcrumb

  return (
    <AppShell
      screenId={rec02.screenId}
      activeNavigationScreenId={rec02.activeNavigationScreenId}
      eyebrow={rec02.meta?.eyebrow}
      title={rec02.meta?.title ?? rec02.screenId}
      onNavigate={onNavigate}
      breadcrumb={
        breadcrumb === undefined ? undefined : (
          <Breadcrumbs
            nodeId={breadcrumb.source}
            screenId={SCREEN}
            separatorNodeIds={[...ASSET.breadcrumbSeparators]}
            items={breadcrumb.items.map((item) => item.value ?? scalar(headRow, item.field))}
          />
        )
      }
    >
      <section
        data-node-id={NODE.head}
        className="flex items-start justify-between gap-6 rounded-xl border border-gray-200 bg-white px-6 py-5"
      >
        <div>
          <span className="flex items-center gap-3">
            <span
              data-design-rule="state-chip"
              className={`rounded px-2 py-0.5 text-xs font-medium ${
                STATE_CHIP[scalar(headRow, (head.status ?? [])[0]?.toneField)] ?? NEUTRAL_CHIP
              }`}
            >
              {scalar(headRow, (head.status ?? [])[0]?.field)}
            </span>
            <span className="text-xs text-gray-400">{scalar(headRow, schedule?.field)}</span>
          </span>
          <h2 className="pt-2 text-xl font-bold text-gray-900">{scalar(headRow, head.titleField)}</h2>
          <p className="pt-1 text-sm text-gray-500">{scalar(headRow, owner?.field)}</p>
        </div>
        <div className="shrink-0 text-right">
          <span className="block text-xs text-gray-400">{scalar(headRow, published?.field)}</span>
          <span className="block pt-1 text-xs text-gray-500">{scalar(headRow, author?.field)}</span>
          <span className="block pt-1 text-xs text-gray-500">{scalar(headRow, reviewer?.field)}</span>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-4 pt-4 pb-12 lg:grid-cols-[180px_1fr_260px]">
        <nav
          data-node-id={NODE.toc}
          aria-label={toc.title}
          className="h-fit rounded-xl border border-gray-200 bg-white px-3 py-4"
        >
          <span className="block px-2 text-xs font-bold text-gray-400">{toc.title}</span>
          <ul className="pt-2">
            {tocRows.map((section) => {
              const current = scalar(section, 'key') === activeKey
              return (
                <li key={scalar(section, 'key')}>
                  <span
                    aria-current={current ? 'true' : undefined}
                    className={`block rounded px-2 py-1.5 text-xs ${
                      current ? 'bg-blue-50 font-semibold text-blue-700' : 'font-medium text-gray-600'
                    }`}
                  >
                    {scalar(section, (tocHeader?.fields ?? [])[0])}
                  </span>
                  {rowsOf(section, toc.group?.itemsField).map((child) => (
                    <span key={scalar(child, 'key')} className="block px-4 py-1.5 text-xs font-medium text-gray-500">
                      {scalar(child, (tocLabel?.fields ?? [])[0])}
                    </span>
                  ))}
                </li>
              )
            })}
          </ul>
        </nav>

        <ArchiveDocumentSections
          screenParams={screenParams}
          activeKey={activeKey}
          onNote={setNote}
          onNavigate={onNavigate}
        />
        <ArchiveChecklist screenParams={screenParams} draft={draft} onChangeDraft={onChangeDraft} />
      </div>

      {note === null ? null : <p role="status" className="pb-6 text-xs text-gray-500">{note}</p>}
    </AppShell>
  )
}
