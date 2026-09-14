import { FigmaAsset } from '../../components/FigmaAsset'
import { BASE_ROLE_CHIP } from '../../design/tones'
import type { SubmitAction } from '../../spec/types'
import { ASSET, NODE, SCREEN } from './spec'
import type { RolePermissionEditorModel } from './useRolePermissionEditor'
import { roleScalar as scalar } from './useRolePermissionEditor'

export function RoleSelectionPanel({ model }: { model: RolePermissionEditorModel }) {
  return (
    <aside
      data-node-id={NODE.roleChoice}
      className="w-80 shrink-0 rounded-xl border border-gray-200 bg-white p-5"
    >
      <p id={`${model.roleChoice.fieldKey}-label`} className="text-sm font-bold text-gray-900">
        <span>{model.roleChoice.label}</span>
        {model.roleChoice.required && <span className="text-red-500">*</span>}
      </p>

      <div data-node-id={NODE.selected} className="border-b border-gray-100 pt-4 pb-4">
        <p className="text-sm font-bold text-gray-800">
          {scalar(model.person, model.selected.titleField!)}
        </p>
        <p className="flex items-center gap-1 pt-1 text-xs text-gray-500">
          <span>{`${scalar(model.person, model.selected.items![0].field!)} · ${
            model.selected.items![0].label
          } `}</span>
          <span
            className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${
              BASE_ROLE_CHIP[scalar(model.person, model.selected.status![0].toneField)] ?? ''
            }`}
          >
            {scalar(model.person, model.selected.status![0].field)}
          </span>
        </p>
      </div>

      <div
        role="radiogroup"
        aria-labelledby={`${model.roleChoice.fieldKey}-label`}
        className="flex flex-col gap-2 pt-5"
      >
        {model.options.map((option) => {
          const on = option.value === model.role
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => model.setRole(option.value)}
              className={`flex items-start gap-3 rounded-lg border px-4 py-3 text-left focus-visible:ring-2 focus-visible:ring-blue-600/50 focus-visible:outline-none ${
                on ? 'border-blue-400 bg-blue-50' : 'border-gray-200 bg-white hover:bg-gray-50'
              }`}
            >
              {on ? (
                <FigmaAsset screenId={SCREEN} nodeId={ASSET.radioOn} className="mt-0.5 size-4" />
              ) : (
                <span className="mt-0.5 block size-4 shrink-0 rounded-full border border-gray-300 bg-white" />
              )}
              <span>
                <span className="block text-xs font-semibold text-gray-800">{option.label}</span>
                <span className="block pt-1 text-xs font-medium text-gray-500">
                  {option.description}
                </span>
              </span>
            </button>
          )
        })}
      </div>

      <div className="flex gap-2 pt-5">
        <button
          type="button"
          data-node-id={NODE.revert}
          onClick={model.pressRevert}
          className="flex-1 rounded-lg border border-gray-300 bg-white px-4 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 focus-visible:ring-2 focus-visible:ring-blue-600/50 focus-visible:outline-none"
        >
          {model.revert.label}
        </button>
        <button
          type="button"
          data-node-id={NODE.apply}
          onClick={model.pressApply}
          className="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-xs font-medium text-white hover:bg-blue-700 focus-visible:ring-2 focus-visible:ring-blue-600/50 focus-visible:outline-none"
        >
          {model.submitAction.labelOf(model.apply.action as SubmitAction, model.apply.label)}
        </button>
      </div>

      {model.note === null ? null : (
        <p role="status" className="pt-4 text-xs text-gray-500">
          {model.note}
        </p>
      )}
      {model.submitAction.errorMessage === null ? null : (
        <p role="alert" className="pt-4 text-xs text-red-500">
          {model.submitAction.errorMessage}
        </p>
      )}
    </aside>
  )
}
