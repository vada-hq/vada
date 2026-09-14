import { SearchSelect } from '../../components/SearchSelect'
import { org07c } from '../../spec/screens'
import { RosterFilePicker } from '../roster-upload/RosterFilePicker'
import { RosterUploadDialog } from '../roster-upload/RosterUploadDialog'
import { UploadSteps } from '../roster-upload/UploadSteps'
import {
  DUES_ROSTER_ASSET as ASSET,
  DUES_ROSTER_NODE as NODE,
  DUES_ROSTER_SCREEN as SCREEN,
} from './config'
import type { DuesRosterUploadModel } from './useDuesRosterUpload'

export function DuesRosterUploadModal({ model }: { model: DuesRosterUploadModel }) {
  return (
    <RosterUploadDialog
      screenId={SCREEN}
      title={org07c.meta?.title ?? org07c.screenId}
      headNodeId={NODE.head}
      headTitle={model.head.title}
      headDescription={model.head.description}
      closeNodeId={NODE.close}
      closeLabel={model.close.label}
      closeAssetId={ASSET.close}
      cancelNodeId={NODE.cancel}
      cancelLabel={model.cancel.label}
      verifyNodeId={NODE.verify}
      verifyLabel={model.verify.label}
      pending={model.pending}
      onClose={model.goBack}
      onVerify={model.verifyFile}
    >
      <UploadSteps nodeId={NODE.steps} spec={model.steps} current={model.step} />
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
              onSelect={(option) =>
                model.setChosenTerm({ value: option.value, label: option.label })
              }
            />
          </span>
          <p className="pt-2 text-xs text-gray-400">{model.term.helperText}</p>
        </div>
        <RosterFilePicker
          screenId={SCREEN}
          nodeId={NODE.file}
          assetId={ASSET.upload}
          spec={model.file}
          inputRef={model.fileInput}
          chosenFile={model.chosenFile}
          onChoose={model.setChosenFile}
        />
        <p data-node-id={NODE.note} className="mt-4 rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-xs text-blue-700">
          {model.note.title}
        </p>
      </div>
    </RosterUploadDialog>
  )
}
