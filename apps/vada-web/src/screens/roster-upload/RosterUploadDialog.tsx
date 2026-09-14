import type { ReactNode } from 'react'
import { FigmaAsset } from '../../components/FigmaAsset'
import { ORG07AScreen } from '../ORG07AScreen'

interface RosterUploadDialogProps {
  screenId: string
  title: string
  headNodeId: string
  headTitle: string | undefined
  headDescription: string | undefined
  closeNodeId: string
  closeLabel: string
  closeAssetId: string
  cancelNodeId: string
  cancelLabel: string
  verifyNodeId: string
  verifyLabel: string
  pending: string | null
  onClose: () => void
  onVerify: () => void
  children: ReactNode
}

export function RosterUploadDialog(props: RosterUploadDialogProps) {
  return (
    <>
      <div aria-hidden className="pointer-events-none">
        <ORG07AScreen onNavigate={() => undefined} />
      </div>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/40 p-6" onClick={props.onClose}>
        <div role="dialog" aria-modal="true" aria-label={props.title} onClick={(event) => event.stopPropagation()} className="w-full max-w-2xl rounded-xl bg-white shadow-xl">
          <div className="flex items-start justify-between gap-4 px-6 pt-6">
            <span data-node-id={props.headNodeId}>
              <h2 className="text-base font-semibold text-gray-900">{props.headTitle}</h2>
              <span className="block pt-1 text-xs text-gray-400">{props.headDescription}</span>
            </span>
            <button type="button" data-node-id={props.closeNodeId} aria-label={props.closeLabel} onClick={props.onClose} className="focus-visible:ring-2 focus-visible:ring-blue-600/50 focus-visible:outline-none">
              <FigmaAsset screenId={props.screenId} nodeId={props.closeAssetId} className="size-4" />
            </button>
          </div>
          {props.children}
          <div className="flex items-center justify-between border-t border-gray-100 px-6 py-4">
            <button type="button" data-node-id={props.cancelNodeId} onClick={props.onClose} className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 focus-visible:ring-2 focus-visible:ring-blue-600/50 focus-visible:outline-none">{props.cancelLabel}</button>
            <button type="button" data-node-id={props.verifyNodeId} onClick={props.onVerify} className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-medium text-white hover:bg-blue-700 focus-visible:ring-2 focus-visible:ring-blue-600/50 focus-visible:outline-none">{props.verifyLabel}</button>
          </div>
          {props.pending === null ? null : <p role="status" className="px-6 pb-4 text-xs text-gray-500">{props.pending}</p>}
        </div>
      </div>
    </>
  )
}
