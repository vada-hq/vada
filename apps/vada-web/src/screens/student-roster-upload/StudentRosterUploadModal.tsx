import { org07b } from '../../spec/screen-specs/org07b'
import { RosterFilePicker } from '../roster-upload/RosterFilePicker'
import { RosterUploadDialog } from '../roster-upload/RosterUploadDialog'
import { UploadSteps } from '../roster-upload/UploadSteps'
import {
  STUDENT_ROSTER_UPLOAD_ASSET as ASSET,
  STUDENT_ROSTER_UPLOAD_NODE as NODE,
  STUDENT_ROSTER_UPLOAD_SCREEN as SCREEN,
} from './config'
import type { StudentRosterUploadModel } from './useStudentRosterUpload'

export function StudentRosterUploadModal({ model }: { model: StudentRosterUploadModel }) {
  return (
    <RosterUploadDialog
      screenId={SCREEN}
      title={org07b.meta?.title ?? org07b.screenId}
      headNodeId={NODE.head}
      headTitle={model.head.title}
      headDescription={String(model.scope[model.head.descriptionField!] ?? '')}
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
        <div data-node-id={NODE.intro}>
          <p className="text-sm font-semibold text-gray-800">{model.intro.title}</p>
          <p className="pt-1 text-xs text-gray-500">{model.intro.description}</p>
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
