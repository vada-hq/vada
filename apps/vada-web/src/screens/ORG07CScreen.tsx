import { useRef, useState } from 'react'
import { FigmaAsset } from '../components/FigmaAsset'
import { SearchSelect } from '../components/SearchSelect'
import { elementByNodeId, org07c } from '../spec/screens'
import type { ButtonSpec, InputSpec, SelectSpec, StepsSpec, SummarySpec } from '../spec/types'
import { ORG07AScreen } from './ORG07AScreen'

// 학생회비 납부 명단 업로드(ORG-07C). 조직 갈래의 마지막 화면이고 **두 번째 모달**이다.
//
// ORG-07B에서 만든 어휘(screen.overlay)가 여기서 그대로 선다 - 어느 화면 위에
// 뜨는지와 이 화면이 그리는 부분이 디자인의 어디인지. 한 번 쓴 어휘가 다음 화면에서
// 손대지 않고 서는 것이 이 사이클의 값이다.
//
// 다른 점은 하나다: **어느 학기의 납부인지를 먼저 고른다.** 파일보다 먼저 정해야
// 무엇과 대조할지가 정해지기 때문이다. 학기 목록은 조직이 언제부터 있었는지에
// 달려 있어 명세가 들 수 없다(option-sources의 org.duesTerms).

const SCREEN = 'ORG-07C'

const NODE = {
  head: '30:6130',
  close: '30:6135',
  steps: '30:6139',
  term: '30:6153',
  file: '30:6159',
  note: '30:6168',
  cancel: '30:6172',
  verify: '30:6175',
} as const

const ASSET = {
  close: '30:6135',
  upload: '30:6160',
} as const

interface ORG07CScreenProps {
  onNavigate: (screenId: string) => void
}

export function ORG07CScreen({ onNavigate }: ORG07CScreenProps) {
  const head = elementByNodeId(org07c, NODE.head).spec as SummarySpec
  const close = elementByNodeId(org07c, NODE.close).spec as ButtonSpec
  const steps = elementByNodeId(org07c, NODE.steps).spec as StepsSpec
  const term = elementByNodeId(org07c, NODE.term).spec as SelectSpec
  const file = elementByNodeId(org07c, NODE.file).spec as InputSpec
  const note = elementByNodeId(org07c, NODE.note).spec as SummarySpec
  const cancel = elementByNodeId(org07c, NODE.cancel).spec as ButtonSpec
  const verify = elementByNodeId(org07c, NODE.verify).spec as ButtonSpec

  const [step] = useState(steps.items[0].key)
  const [chosenTerm, setChosenTerm] = useState<{ value: string; label: string } | null>(null)
  const [chosen, setChosen] = useState('')
  const [pending, setPending] = useState<string | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)

  // 닫으면 어디로 가는지는 명세가 말한다. 지어내면 명세를 고쳐도 화면이 안 따라온다.
  const goBack = () => {
    if (close.action.type === 'navigate') onNavigate(close.action.targetScreenId)
  }

  return (
    <>
      {/* 뒤에 남아 있는 화면. 명세가 overlay.screenId로 말한다. */}
      <div aria-hidden className="pointer-events-none">
        <ORG07AScreen onNavigate={() => undefined} />
      </div>

      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/40 p-6"
        onClick={goBack}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-label={org07c.meta?.title ?? org07c.screenId}
          onClick={(event) => event.stopPropagation()}
          className="w-full max-w-2xl rounded-xl bg-white shadow-xl"
        >
          <div className="flex items-start justify-between gap-4 px-6 pt-6">
            <span data-node-id={NODE.head}>
              <h2 className="text-base font-semibold text-gray-900">{head.title}</h2>
              <span className="block pt-1 text-xs text-gray-400">{head.description}</span>
            </span>
            <button
              type="button"
              data-node-id={NODE.close}
              aria-label={close.label}
              onClick={goBack}
              className="focus-visible:ring-2 focus-visible:ring-blue-600/50 focus-visible:outline-none"
            >
              <FigmaAsset screenId={SCREEN} nodeId={ASSET.close} className="size-4" />
            </button>
          </div>

          <ol
            data-node-id={NODE.steps}
            className="flex items-center gap-4 border-b border-gray-100 px-6 py-4"
          >
            {steps.items.map((item, index) => {
              const on = item.key === step
              return (
                <li key={item.key} className="flex items-center gap-2">
                  <span
                    className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${
                      on ? 'bg-blue-600 text-white' : 'text-gray-400'
                    }`}
                  >
                    <span>{index + 1}</span>
                    <span aria-current={on ? 'step' : undefined}>{item.label}</span>
                  </span>
                </li>
              )
            })}
          </ol>

          <div className="px-6 py-5">
            {/* 파일보다 먼저 정한다 - 무엇과 대조할지가 여기서 정해진다. */}
            <div data-node-id={NODE.term}>
              <label htmlFor={term.fieldKey} className="block text-xs font-medium text-gray-700">
                <span>{term.label}</span>
                {term.required && <span className="text-red-500">*</span>}
              </label>
              <span className="mt-2 block">
                <SearchSelect
                  id={term.fieldKey}
                  placeholder={term.placeholder}
                  searchable={term.searchable}
                  disabled={false}
                  sourceKey={term.optionsSource.key}
                  sourceParams={{}}
                  value={chosenTerm}
                  onSelect={(option) =>
                    setChosenTerm({ value: option.value, label: option.label })
                  }
                />
              </span>
              <p className="pt-2 text-xs text-gray-400">{term.helperText}</p>
            </div>

            <div
              data-node-id={NODE.file}
              className="mt-4 flex flex-col items-center gap-2 rounded-xl border border-dashed border-gray-300 px-6 py-10"
            >
              <FigmaAsset screenId={SCREEN} nodeId={ASSET.upload} className="size-8" />
              <label
                htmlFor={file.fieldKey}
                className="cursor-pointer text-sm font-medium text-gray-600"
              >
                <span>{file.label}</span>
                {file.required && <span className="text-red-500">*</span>}
              </label>
              <span className="text-xs text-gray-400">{file.helperText}</span>
              <button
                type="button"
                onClick={() => fileInput.current?.click()}
                className="mt-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 focus-visible:ring-2 focus-visible:ring-blue-600/50 focus-visible:outline-none"
              >
                파일 선택
              </button>
              <input
                ref={fileInput}
                id={file.fieldKey}
                type={file.inputType}
                className="sr-only"
                onChange={(event) => setChosen(event.target.files?.[0]?.name ?? '')}
              />
              {chosen === '' ? null : (
                <span role="status" className="pt-1 text-xs font-medium text-blue-600">
                  {chosen}
                </span>
              )}
            </div>

            <p
              data-node-id={NODE.note}
              className="mt-4 rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-xs text-blue-700"
            >
              {note.title}
            </p>
          </div>

          <div className="flex items-center justify-between border-t border-gray-100 px-6 py-4">
            <button
              type="button"
              data-node-id={NODE.cancel}
              onClick={goBack}
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 focus-visible:ring-2 focus-visible:ring-blue-600/50 focus-visible:outline-none"
            >
              {cancel.label}
            </button>
            <button
              type="button"
              data-node-id={NODE.verify}
              onClick={() => {
                if (verify.action.type === 'pending') setPending(verify.action.note)
              }}
              className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-medium text-white hover:bg-blue-700 focus-visible:ring-2 focus-visible:ring-blue-600/50 focus-visible:outline-none"
            >
              {verify.label}
            </button>
          </div>

          {pending === null ? null : (
            <p role="status" className="px-6 pb-4 text-xs text-gray-500">
              {pending}
            </p>
          )}
        </div>
      </div>
    </>
  )
}
