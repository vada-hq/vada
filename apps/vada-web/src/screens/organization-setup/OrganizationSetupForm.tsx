import { ChoiceGroup } from '../../components/ChoiceGroup'
import { OrgTree } from '../../components/OrgTree'
import { PrimaryButton } from '../../components/PrimaryButton'
import { SecondaryButton } from '../../components/SecondaryButton'
import { nodeIdOf } from '../../spec/screens'
import { org02 } from '../../spec/screen-specs/org02'
import type { SubmitAction } from '../../spec/types'
import type { OrganizationSetupModel } from './useOrganizationSetup'

export function OrganizationSetupForm({ model }: { model: OrganizationSetupModel }) {
  return (
    <>
      <div className="flex flex-col gap-5 pt-6">
        <ChoiceGroup
          id={model.setupSpec.fieldKey}
          nodeId={nodeIdOf(org02, model.setupSpec)}
          disabled={false}
          sourceKey={model.setupSpec.optionsSource.key}
          sourceParams={{}}
          value={model.selectedSetup}
          onSelect={(option) => model.setSetupMode(option.value, option.label)}
        />
        <OrgTree
          id={model.listSpec.fieldKey}
          nodeId={nodeIdOf(org02, model.listSpec)}
          spec={model.listSpec}
          value={model.listValue}
          onChange={model.setListValue}
        />
      </div>

      {org02.meta?.footerNote ? (
        <p className="pt-6 text-center text-xs text-gray-400">{org02.meta.footerNote}</p>
      ) : null}
      {model.blockedMessage === null ? null : (
        <p role="alert" className="text-xs font-medium text-red-600">{model.blockedMessage}</p>
      )}
      {model.submitAction.errorMessage === null ? null : (
        <p role="alert" className="pt-2 text-center text-xs text-red-500">
          {model.submitAction.errorMessage}
        </p>
      )}

      <div className="flex items-center justify-between gap-4 pt-8">
        <div className="flex items-center gap-2">
          {model.secondaryButtons.map((button) => (
            <SecondaryButton
              key={button.label}
              label={button.label}
              nodeId={nodeIdOf(org02, button)}
              onClick={() =>
                model.onNavigate(
                  button.action.type === 'navigate'
                    ? button.action.targetScreenId
                    : org02.screenId,
                )
              }
            />
          ))}
        </div>
        <PrimaryButton
          label={model.submitAction.labelOf(
            model.primaryButton.action as SubmitAction,
            model.primaryButton.label,
          )}
          nodeId={nodeIdOf(org02, model.primaryButton)}
          onClick={() => void model.submit()}
          fullWidth={false}
        />
      </div>
    </>
  )
}
