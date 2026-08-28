import { useRef, useState } from 'react'
import { FigmaAsset } from '../components/FigmaAsset'
import { readObjectSource } from '../data-sources/catalog'
import { elementByNodeId, org07b } from '../spec/screens'
import type { ButtonSpec, InputSpec, StepsSpec, SummarySpec } from '../spec/types'
import { ORG07AScreen } from './ORG07AScreen'

// 학생 명단 업로드·갱신(ORG-07B). **첫 모달이다.**
//
// 모달은 화면이면서 화면이 아니다 - 주소로 열 수 있는 한 자리이지만, 뒤에는 열기
// 전에 보던 것이 그대로 남아 있다. 명세가 그것을 말한다(screen.overlay): 어느
// 화면 위에 뜨는지와, 이 화면이 그리는 부분이 디자인의 어디인지.
//
// **그 둘을 말하지 않으면 두 가지가 무너진다.** 화면을 만드는 사람이 뒤에 무엇이
// 있는지 지어내게 되고, 검증기가 아래 화면의 버튼들을 '명세에 없는 상호작용'으로
// 본다 - 디자인이 모달을 화면 전체와 형제로 그리기 때문이다.
//
// 단계 둘(파일 업로드 · 검증 결과)은 **이 화면을 여는 동안에만 있는 것**이라
// 서버가 모른다. steps가 출처 없이도 설 수 있게 된 이유다.

const SCREEN = 'ORG-07B'

const NODE = {
  head: '30:5858',
  close: '30:5863',
  steps: '30:5867',
  intro: '30:5880',
  file: '30:5886',
  note: '30:5895',
  cancel: '30:5899',
  verify: '30:5902',
} as const

const ASSET = {
  close: '30:5863',
  upload: '30:5887',
} as const

interface ORG07BScreenProps {
  onNavigate: (screenId: string) => void
}

export function ORG07BScreen({ onNavigate }: ORG07BScreenProps) {
  const head = elementByNodeId(org07b, NODE.head).spec as SummarySpec
  const close = elementByNodeId(org07b, NODE.close).spec as ButtonSpec
  const steps = elementByNodeId(org07b, NODE.steps).spec as StepsSpec
  const intro = elementByNodeId(org07b, NODE.intro).spec as SummarySpec
  const file = elementByNodeId(org07b, NODE.file).spec as InputSpec
  const note = elementByNodeId(org07b, NODE.note).spec as SummarySpec
  const cancel = elementByNodeId(org07b, NODE.cancel).spec as ButtonSpec
  const verify = elementByNodeId(org07b, NODE.verify).spec as ButtonSpec

  // 출처가 없으면 첫 단계에서 시작하고 그 뒤는 화면이 안다.
  const [step] = useState(steps.items[0].key)
  const [chosen, setChosen] = useState('')
  const [pending, setPending] = useState<string | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)

  const scope = readObjectSource(head.dataSourceKey)
  // 닫으면 어디로 가는지는 **명세가 말한다.** 지어내면 명세를 고쳐도 화면이
  // 따라오지 않는다(overlay.screenId와 같은 곳을 가리킨다).
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
          aria-label={org07b.meta?.title ?? org07b.screenId}
          onClick={(event) => event.stopPropagation()}
          className="w-full max-w-2xl rounded-xl bg-white shadow-xl"
        >
          <div className="flex items-start justify-between gap-4 px-6 pt-6">
            <span data-node-id={NODE.head}>
              <h2 className="text-base font-semibold text-gray-900">{head.title}</h2>
              <span className="block pt-1 text-xs text-gray-400">
                {String(scope[head.descriptionField!])}
              </span>
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

          {/* 단계 줄. 순서가 곧 절차다. */}
          <ol data-node-id={NODE.steps} className="flex items-center gap-4 border-b border-gray-100 px-6 py-4">
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
                    {/* 지금 단계임을 **그 글이 든 칸**이 말한다 - 순번까지 함께
                        묶으면 무엇이 지금인지 보조기기가 짚을 자리가 없다. */}
                    <span aria-current={on ? 'step' : undefined}>{item.label}</span>
                  </span>
                </li>
              )
            })}
          </ol>

          <div className="px-6 py-5">
            <div data-node-id={NODE.intro}>
              <p className="text-sm font-semibold text-gray-800">{intro.title}</p>
              <p className="pt-1 text-xs text-gray-500">{intro.description}</p>
            </div>

            {/* 값이 글이 아니라 고른 파일이다. 그려지는 것은 그 파일의 이름이다. */}
            <div
              data-node-id={NODE.file}
              className="mt-4 flex flex-col items-center gap-2 rounded-xl border border-dashed border-gray-300 px-6 py-10"
            >
              <FigmaAsset screenId={SCREEN} nodeId={ASSET.upload} className="size-8" />
              {/* 라벨은 **그 글만** 담는다 - 안내와 단추까지 품으면 보조기기가
                  읽는 이름이 칸 전체가 된다(Field와 같은 규칙). */}
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
