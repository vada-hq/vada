import { useState } from 'react'
import { MoreHorizontal, Plus, Star } from 'lucide-react'
import type { ReactNode } from 'react'
import type { ListSpec } from '../spec/types'

export interface ListValue {
  rootName: string
  items: string[]
}

interface OrgTreeProps {
  id: string
  /** design 대조가 이 트리를 찾아가는 끈(spec/screens.ts의 nodeIdOf). */
  nodeId?: string
  spec: ListSpec
  value: ListValue
  onChange: (next: ListValue) => void
}

// list 요소의 렌더. rootItem이 있으면 고정 루트 + 하위 항목의 트리로 그린다.
// HQCard 14:274: 240→274, border gray-300 2px, radius 5.25→6, 머리 bg gray-50.
// DeptCardSetup 14:291: 161→184, border gray-200 1px.
// 부서 추가 14:334: 88→100, 점선 border gray-300 2px.
// OrgStem 14:285: 2×28 → w-0.5 h-8 gray-400. OrgBranch 14:286이 가로 연결선.
const ROOT_WIDTH = 274
// 부서 카드는 161→184지만 그 안의 안내 텍스트(147→168)가 컨테이너를 넘친다
// (Figma 텍스트 자동 크기의 아티팩트). 브라우저에서 줄바꿈되지 않도록
// 텍스트 실폭 기준으로 잡는다: 168 + padding 12×2 = 192.
const ITEM_WIDTH = 192
const ADD_WIDTH = 100

export function OrgTree({ id, nodeId, spec, value, onChange }: OrgTreeProps) {
  const [editing, setEditing] = useState<number | 'root' | null>(null)
  const [openMenu, setOpenMenu] = useState<number | 'root' | null>(null)

  const canRenameItem = spec.itemActions.includes('rename')
  const canRemoveItem = spec.itemActions.includes('remove')
  const canRenameRoot = spec.rootItem?.actions.includes('rename') ?? false
  const canAdd = value.items.length < spec.maxItems
  const canRemove = value.items.length > spec.minItems

  function commit(next: Partial<ListValue>) {
    onChange({ ...value, ...next })
  }

  function renameItem(index: number, name: string) {
    const items = [...value.items]
    items[index] = name
    commit({ items })
  }

  function addItem() {
    commit({ items: [...value.items, `새 ${spec.itemNoun}`] })
    setEditing(value.items.length)
  }

  function nameCell(current: string, key: number | 'root') {
    if (editing === key) {
      return (
        <input
          autoFocus
          aria-label={`${spec.itemNoun} 이름`}
          value={current}
          onChange={(event) =>
            key === 'root'
              ? commit({ rootName: event.target.value })
              : renameItem(key, event.target.value)
          }
          onBlur={() => setEditing(null)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === 'Escape') {
              setEditing(null)
            }
          }}
          className="w-full min-w-0 rounded border border-blue-600 px-1 text-sm font-semibold text-gray-800 focus:outline-none"
        />
      )
    }
    return <span className="truncate text-sm font-semibold text-gray-800">{current}</span>
  }

  // 디자인에는 회장단의 이름 수정 어포던스가 없다. 조작은 결정으로 존재하므로
  // 원본에 없는 것을 관례로 보충한다 — 부서와 같은 … 메뉴를 쓴다.
  function cardMenu(key: number | 'root', label: string, actions: ReactNode) {
    if (editing === key) {
      return null
    }
    return (
      <div className="relative ml-auto shrink-0">
        <button
          type="button"
          aria-label={`${label} 메뉴`}
          aria-expanded={openMenu === key}
          onClick={() => setOpenMenu(openMenu === key ? null : key)}
          className="rounded p-0.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
        >
          <MoreHorizontal className="size-4" />
        </button>
        {openMenu === key && (
          <div className="absolute top-full right-0 z-10 mt-1 w-28 rounded-md border border-gray-200 bg-white py-1 shadow-md">
            {actions}
          </div>
        )}
      </div>
    )
  }

  const menuItemClass = 'block w-full px-3 py-1.5 text-left text-sm hover:bg-gray-50'

  return (
    <div id={id} data-node-id={nodeId} className="flex flex-col items-center pt-2">
      {spec.rootItem && (
        <>
          <div
            style={{ width: ROOT_WIDTH }}
            className="rounded-md border-2 border-gray-300 bg-white"
          >
            {/* 머리줄 14:275: bg gray-50, 테두리 gray-200 */}
            <div className="flex items-center gap-2 rounded-t-md border-b border-gray-200 bg-gray-50 px-3 py-2">
              <Star className="size-4 shrink-0 text-amber-400" />
              {nameCell(value.rootName, 'root')}
              {canRenameRoot &&
                cardMenu(
                  'root',
                  value.rootName,
                  <button
                    type="button"
                    onClick={() => {
                      setEditing('root')
                      setOpenMenu(null)
                    }}
                    className={`${menuItemClass} text-gray-800`}
                  >
                    이름 수정
                  </button>,
                )}
            </div>
            {spec.itemNote && <p className="px-3 py-3 text-xs text-gray-400">{spec.itemNote}</p>}
          </div>
          <span aria-hidden className="h-8 w-0.5 bg-gray-400" />
        </>
      )}

      {/* 가로 연결선(14:286)은 첫 항목 중앙에서 마지막 항목 중앙까지 잇는다. */}
      <div className="relative flex items-start justify-center gap-4">
        {value.items.length > 0 && (
          <span
            aria-hidden
            style={{ left: ITEM_WIDTH / 2, right: ADD_WIDTH / 2 }}
            className="absolute top-0 h-0.5 bg-gray-400"
          />
        )}
        {value.items.map((name, index) => (
          <div key={index} className="flex flex-col items-center">
            <span aria-hidden className="h-4 w-0.5 bg-gray-400" />
            <div
              style={{ width: ITEM_WIDTH }}
              className="rounded-md border border-gray-200 bg-white"
            >
              <div className="flex items-center gap-2 border-b border-gray-100 px-3 py-2">
                {nameCell(name, index)}
                {(canRenameItem || canRemoveItem) &&
                  cardMenu(
                    index,
                    name,
                    <>
                      {canRenameItem && (
                        <button
                          type="button"
                          onClick={() => {
                            setEditing(index)
                            setOpenMenu(null)
                          }}
                          className={`${menuItemClass} text-gray-800`}
                        >
                          이름 수정
                        </button>
                      )}
                      {canRemoveItem && (
                        <button
                          type="button"
                          disabled={!canRemove}
                          onClick={() => {
                            commit({ items: value.items.filter((_, at) => at !== index) })
                            setOpenMenu(null)
                          }}
                          className={`${menuItemClass} text-red-500 disabled:cursor-not-allowed disabled:text-gray-300`}
                        >
                          삭제
                        </button>
                      )}
                    </>,
                  )}
              </div>
              {spec.itemNote && <p className="px-3 py-3 text-xs text-gray-400">{spec.itemNote}</p>}
            </div>
          </div>
        ))}

        <div className="flex flex-col items-center">
          <span aria-hidden className="h-4 w-0.5 bg-gray-400" />
          <button
            type="button"
            disabled={!canAdd}
            onClick={addItem}
            style={{ width: ADD_WIDTH }}
            className="flex flex-col items-center gap-1 rounded-md border-2 border-dashed border-gray-300 px-4 py-4 text-xs text-gray-400 hover:border-gray-400 hover:text-gray-600 focus-visible:ring-2 focus-visible:ring-blue-600/50 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Plus className="size-4" />
            {spec.addLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
