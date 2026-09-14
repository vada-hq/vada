import { FigmaAsset } from '../../components/FigmaAsset'
import type { SupplementDraftModel } from './useSupplementDraft'
import { ASSET, NODE, SCREEN, scalar, valueKey } from './spec'

export function SupplementItems({ model }: { model: SupplementDraftModel }) {
  const {
    items,
    listSource,
    heading,
    reason,
    existing,
    corrections,
    attachments,
    fieldsOf,
    values,
    setValues,
    blocked,
  } = model
  return (
    <>
        {items.length === 0 ? (
          <p className="text-sm text-gray-500">{listSource.messages.empty}</p>
        ) : (
          items.map((row, index) => {
            const itemId = scalar(row, 'id')
            const first = index === 0
            return (
              <section
                key={itemId}
                data-node-id={first ? NODE.items : undefined}
                className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm"
              >
                <span data-node-id={first ? NODE.itemHeading : undefined}
                  className="block border-b border-gray-100 pb-4"
                >
                  <span className="block text-sm font-bold text-gray-800">
                    {scalar(row, heading.titleField ?? '')}
                  </span>
                  <span className="block pt-1 text-xs font-normal text-gray-500">
                    {scalar(row, heading.descriptionField ?? '')}
                  </span>
                </span>

                <span
                  data-node-id={first ? NODE.itemReason : undefined}
                  className="mt-4 block rounded-lg border border-yellow-100 bg-yellow-50 p-4"
                >
                  <span className="block text-xs font-bold text-yellow-700">{reason.title}</span>
                  {(reason.items ?? []).map((item) => (
                    <span key={item.field} className="block pt-1 text-xs font-normal text-yellow-800">
                      {scalar(row, item.field ?? '')}
                    </span>
                  ))}
                </span>

                <span data-node-id={first ? NODE.itemExisting : undefined} className="mt-4 block">
                  <span className="block text-xs font-bold text-gray-400">{existing.title}</span>
                  <span className="grid grid-cols-5 gap-3 pt-2">
                    {(existing.items ?? []).map((item) => (
                      <span key={item.field} className="rounded-lg bg-gray-50 p-3">
                        <span className="block text-xs font-normal text-gray-400">
                          {item.label}
                        </span>
                        <span className="block pt-0.5 text-xs font-semibold text-gray-700">
                          {scalar(row, item.field ?? '')}
                        </span>
                      </span>
                    ))}
                  </span>
                </span>

                {/* 칸이 무엇인지 명세는 모른다. 그리는 순서도 데이터가 준 순서다. */}
                <span data-node-id={first ? NODE.corrections : undefined} className="mt-4 block">
                  <span className="block text-xs font-bold text-gray-400">
                    {corrections.label}
                  </span>
                  <span className="grid grid-cols-2 gap-3 pt-2">
                    {fieldsOf(corrections, row).map((field) => {
                      const key = valueKey(itemId, corrections.fieldKey, scalar(field, 'key'))
                      return (
                        <label key={key} className="block">
                          <span className="block pb-1 text-xs font-bold text-gray-600">
                            {scalar(field, 'label')}
                          </span>
                          <input
                            type="text"
                            value={values[key] ?? ''}
                            placeholder={scalar(field, 'placeholder')}
                            aria-invalid={blocked && (values[key] ?? '') === ''}
                            onChange={(event) =>
                              setValues((before) => ({ ...before, [key]: event.target.value }))
                            }
                            className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-normal text-gray-800 placeholder:text-gray-400 focus-visible:ring-2 focus-visible:ring-blue-600/50 focus-visible:outline-none"
                          />
                        </label>
                      )
                    })}
                  </span>
                </span>

                <span data-node-id={first ? NODE.attachments : undefined} className="mt-4 block">
                  <span className="block text-xs font-bold text-gray-400">
                    {attachments.label}
                  </span>
                  <span className="grid grid-cols-3 gap-3 pt-2">
                    {fieldsOf(attachments, row).map((field) => {
                      const key = valueKey(itemId, attachments.fieldKey, scalar(field, 'key'))
                      const chosen = values[key] ?? ''
                      return (
                        <button
                          key={key}
                          type="button"
                          // 파일을 실제로 고르는 일은 아직 그려지지 않았다. 무엇을 넣는
                          // 자리인지가 명세의 몫이고, 어떻게 넣는지는 디자인이 말한다.
                          onClick={() =>
                            setValues((before) => ({ ...before, [key]: scalar(field, 'label') }))
                          }
                          className="flex flex-col items-center gap-1 rounded-lg border border-dashed border-gray-200 bg-gray-50 px-3 py-4 hover:bg-gray-100 focus-visible:ring-2 focus-visible:ring-blue-600/50 focus-visible:outline-none"
                        >
                          <FigmaAsset
                            screenId={SCREEN}
                            nodeId={ASSET.attachment}
                            className="size-4"
                          />
                          <span className="text-xs font-semibold text-gray-400">
                            {scalar(field, 'label')}
                          </span>
                          <span className="text-xs font-normal text-gray-300">
                            {chosen === '' ? scalar(field, 'placeholder') : chosen}
                          </span>
                        </button>
                      )
                    })}
                  </span>
                </span>
              </section>
            )
          })
        )}
    </>
  )
}
