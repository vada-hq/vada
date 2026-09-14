import type { RefObject } from 'react'
import { FigmaAsset } from '../../components/FigmaAsset'
import type { InputSpec } from '../../spec/types'

interface RosterFilePickerProps {
  screenId: string
  nodeId: string
  assetId: string
  spec: InputSpec
  inputRef: RefObject<HTMLInputElement | null>
  chosenFile: string
  onChoose: (name: string) => void
}

export function RosterFilePicker({
  screenId,
  nodeId,
  assetId,
  spec,
  inputRef,
  chosenFile,
  onChoose,
}: RosterFilePickerProps) {
  return (
    <div data-node-id={nodeId} className="mt-4 flex flex-col items-center gap-2 rounded-xl border border-dashed border-gray-300 px-6 py-10">
      <FigmaAsset screenId={screenId} nodeId={assetId} className="size-8" />
      <label htmlFor={spec.fieldKey} className="cursor-pointer text-sm font-medium text-gray-600">
        <span>{spec.label}</span>
        {spec.required ? <span className="text-red-500">*</span> : null}
      </label>
      <span className="text-xs text-gray-400">{spec.helperText}</span>
      <button type="button" onClick={() => inputRef.current?.click()} className="mt-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 focus-visible:ring-2 focus-visible:ring-blue-600/50 focus-visible:outline-none">
        파일 선택
      </button>
      <input
        ref={inputRef}
        id={spec.fieldKey}
        type={spec.inputType}
        className="sr-only"
        onChange={(event) => onChoose(event.target.files?.[0]?.name ?? '')}
      />
      {chosenFile === '' ? null : (
        <span role="status" className="pt-1 text-xs font-medium text-blue-600">{chosenFile}</span>
      )}
    </div>
  )
}
