import { FigmaAsset } from '../../components/FigmaAsset'
import { SearchSelect } from '../../components/SearchSelect'
import { org07c } from '../../spec/screens'
import { ORG07AScreen } from '../ORG07AScreen'
import {
  DUES_ROSTER_ASSET as ASSET,
  DUES_ROSTER_NODE as NODE,
  DUES_ROSTER_SCREEN as SCREEN,
} from './config'
import type { DuesRosterUploadModel } from './useDuesRosterUpload'

function UploadSteps({ model }: { model: DuesRosterUploadModel }) {
  return (
    <ol data-node-id={NODE.steps} className="flex items-center gap-4 border-b border-gray-100 px-6 py-4">
      {model.steps.items.map((item, index) => {
        const active = item.key === model.step
        return (
          <li key={item.key} className="flex items-center gap-2">
            <span className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${active ? 'bg-blue-600 text-white' : 'text-gray-400'}`}>
              <span>{index + 1}</span>
              <span aria-current={active ? 'step' : undefined}>{item.label}</span>
            </span>
          </li>
        )
      })}
    </ol>
  )
}

function UploadFields({ model }: { model: DuesRosterUploadModel }) {
  return (
    <div className="px-6 py-5">
      <div data-node-id={NODE.term}>
        <label htmlFor={model.term.fieldKey} className="block text-xs font-medium text-gray-700">
          <span>{model.term.label}</span>
          {model.term.required ? <span className="text-red-500">*</span> : null}
        </label>
        <span className="mt-2 block">
          <SearchSelect
            id={model.term.fieldKey}
            placeholder={model.term.placeholder}
            searchable={model.term.searchable}
            disabled={false}
            sourceKey={model.term.optionsSource.key}
            sourceParams={{}}
            value={model.chosenTerm}
            onSelect={(option) => model.setChosenTerm({ value: option.value, label: option.label })}
          />
        </span>
        <p className="pt-2 text-xs text-gray-400">{model.term.helperText}</p>
      </div>

      <div data-node-id={NODE.file} className="mt-4 flex flex-col items-center gap-2 rounded-xl border border-dashed border-gray-300 px-6 py-10">
        <FigmaAsset screenId={SCREEN} nodeId={ASSET.upload} className="size-8" />
        <label htmlFor={model.file.fieldKey} className="cursor-pointer text-sm font-medium text-gray-600">
          <span>{model.file.label}</span>
          {model.file.required ? <span className="text-red-500">*</span> : null}
        </label>
        <span className="text-xs text-gray-400">{model.file.helperText}</span>
        <button type="button" onClick={() => model.fileInput.current?.click()} className="mt-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 focus-visible:ring-2 focus-visible:ring-blue-600/50 focus-visible:outline-none">
          파일 선택
        </button>
        <input
          ref={model.fileInput}
          id={model.file.fieldKey}
          type={model.file.inputType}
          className="sr-only"
          onChange={(event) => model.setChosenFile(event.target.files?.[0]?.name ?? '')}
        />
        {model.chosenFile === '' ? null : (
          <span role="status" className="pt-1 text-xs font-medium text-blue-600">{model.chosenFile}</span>
        )}
      </div>

      <p data-node-id={NODE.note} className="mt-4 rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-xs text-blue-700">
        {model.note.title}
      </p>
    </div>
  )
}

export function DuesRosterUploadModal({ model }: { model: DuesRosterUploadModel }) {
  return (
    <>
      <div aria-hidden className="pointer-events-none">
        <ORG07AScreen onNavigate={() => undefined} />
      </div>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/40 p-6" onClick={model.goBack}>
        <div role="dialog" aria-modal="true" aria-label={org07c.meta?.title ?? org07c.screenId} onClick={(event) => event.stopPropagation()} className="w-full max-w-2xl rounded-xl bg-white shadow-xl">
          <div className="flex items-start justify-between gap-4 px-6 pt-6">
            <span data-node-id={NODE.head}>
              <h2 className="text-base font-semibold text-gray-900">{model.head.title}</h2>
              <span className="block pt-1 text-xs text-gray-400">{model.head.description}</span>
            </span>
            <button type="button" data-node-id={NODE.close} aria-label={model.close.label} onClick={model.goBack} className="focus-visible:ring-2 focus-visible:ring-blue-600/50 focus-visible:outline-none">
              <FigmaAsset screenId={SCREEN} nodeId={ASSET.close} className="size-4" />
            </button>
          </div>
          <UploadSteps model={model} />
          <UploadFields model={model} />
          <div className="flex items-center justify-between border-t border-gray-100 px-6 py-4">
            <button type="button" data-node-id={NODE.cancel} onClick={model.goBack} className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 focus-visible:ring-2 focus-visible:ring-blue-600/50 focus-visible:outline-none">{model.cancel.label}</button>
            <button type="button" data-node-id={NODE.verify} onClick={model.verifyFile} className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-medium text-white hover:bg-blue-700 focus-visible:ring-2 focus-visible:ring-blue-600/50 focus-visible:outline-none">{model.verify.label}</button>
          </div>
          {model.pending === null ? null : <p role="status" className="px-6 pb-4 text-xs text-gray-500">{model.pending}</p>}
        </div>
      </div>
    </>
  )
}
