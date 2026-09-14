import type { ReactNode } from 'react'
import { FigmaAsset } from '../../components/FigmaAsset'
import { DANGER_BUTTON, STATE_CHIP } from '../../design/tones'
import type { DataRow } from '../../data-sources/definitions'
import { evt04b } from '../../spec/screens'
import type { SubmitAction } from '../../spec/types'
import { EVT04Screen } from '../EVT04Screen'
import {
  ATTENDANCE_QR_ASSET as ASSET,
  ATTENDANCE_QR_NODE as NODE,
  ATTENDANCE_QR_SCREEN as SCREEN,
} from './config'
import type { AttendanceQrModel } from './useAttendanceQr'

function text(row: DataRow, field: string | undefined) {
  return field === undefined ? '' : String(row[field] ?? '')
}

function ModalShell({
  screenParams,
  onClose,
  children,
}: {
  screenParams: Record<string, string>
  onClose: () => void
  children: ReactNode
}) {
  return (
    <>
      <div aria-hidden className="pointer-events-none">
        <EVT04Screen screenParams={screenParams} onNavigate={() => undefined} />
      </div>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-6" onClick={onClose}>
        <div
          role="dialog"
          aria-modal="true"
          aria-label={evt04b.meta?.title ?? evt04b.screenId}
          onClick={(event) => event.stopPropagation()}
          className="w-full max-w-[440px] rounded-lg border border-gray-200 bg-white shadow-2xl"
        >
          {children}
        </div>
      </div>
    </>
  )
}

function DialogHeader({ model }: { model: Extract<AttendanceQrModel, { state: 'empty' | 'ready' }> }) {
  return (
    <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
      <h2 data-node-id={NODE.head} className="text-base font-semibold text-gray-900">{model.head.title}</h2>
      <button type="button" data-node-id={NODE.close} aria-label={model.close.label} onClick={model.goBack} className="shrink-0 rounded p-1 hover:bg-gray-50">
        <FigmaAsset screenId={SCREEN} nodeId={ASSET.close} className="size-3.5" />
      </button>
    </div>
  )
}

function QrContent({ model }: { model: Extract<AttendanceQrModel, { state: 'ready' }> }) {
  const status = model.status.status?.[0]
  return (
    <div className="flex flex-col items-center gap-4 px-6 py-6">
      <div data-node-id={NODE.code} className="flex size-40 flex-col items-center justify-center gap-2 rounded border border-gray-200 bg-gray-100">
        <FigmaAsset screenId={SCREEN} nodeId={ASSET.code} className="size-12" />
        <span className="text-xs text-gray-400">{model.code.title}</span>
      </div>
      <span data-node-id={NODE.state} className={`rounded px-2 py-0.5 text-xs font-medium ${STATE_CHIP[text(model.qr, model.status.toneField)] ?? STATE_CHIP.gray}`}>
        {text(model.qr, status?.field)}
      </span>
      <dl data-node-id={NODE.window} className="flex w-full flex-col gap-2">
        {(model.checkInWindow.items ?? []).map((item) => (
          <div key={item.field} className="flex items-center gap-3">
            <dt className="w-12 shrink-0 text-xs text-gray-500">{item.label}</dt>
            <dd className="min-w-0 flex-1 rounded border border-gray-300 px-2.5 py-1.5 text-xs text-gray-800">{text(model.qr, item.field)}</dd>
          </div>
        ))}
      </dl>
      <p data-node-id={NODE.guide} className="text-center text-xs text-gray-400">
        {text(model.qr, (model.guide.items ?? [])[0]?.field)}
      </p>
      <div className="flex w-full gap-2">
        <button type="button" data-node-id={NODE.download} onClick={model.pressDownload} className="flex flex-1 items-center justify-center gap-1.5 rounded border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50">
          <FigmaAsset screenId={SCREEN} nodeId={ASSET.download} className="size-3" />
          {model.download.label}
        </button>
        <button type="button" data-node-id={NODE.regenerate} onClick={() => model.submit(model.regenerate)} className="flex flex-1 items-center justify-center gap-1.5 rounded border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50">
          <FigmaAsset screenId={SCREEN} nodeId={ASSET.regenerate} className="size-3" />
          {model.submitAction.labelOf(model.regenerate.action as SubmitAction, model.regenerate.label)}
        </button>
        <button type="button" data-node-id={NODE.deactivate} onClick={() => model.submit(model.deactivate)} className={`flex-1 rounded px-3 py-1.5 text-xs font-medium focus-visible:ring-2 focus-visible:outline-none ${DANGER_BUTTON}`}>
          {model.submitAction.labelOf(model.deactivate.action as SubmitAction, model.deactivate.label)}
        </button>
      </div>
      {model.note === null ? null : <p role="status" className="text-xs text-gray-500">{model.note}</p>}
      {model.submitAction.errorMessage === null ? null : <p role="alert" className="text-xs text-red-500">{model.submitAction.errorMessage}</p>}
    </div>
  )
}

export function AttendanceQrModal({
  model,
  screenParams,
}: {
  model: AttendanceQrModel
  screenParams: Record<string, string>
}) {
  return (
    <ModalShell screenParams={screenParams} onClose={model.goBack}>
      {model.state === 'missing' ? (
        <p role="alert" className="px-6 py-6 text-sm text-red-700">{model.message}</p>
      ) : (
        <>
          <DialogHeader model={model} />
          {model.state === 'empty' ? (
            <p data-design-state="empty" className="px-6 py-8 text-center text-xs text-gray-400">{model.message}</p>
          ) : (
            <QrContent model={model} />
          )}
        </>
      )}
    </ModalShell>
  )
}
