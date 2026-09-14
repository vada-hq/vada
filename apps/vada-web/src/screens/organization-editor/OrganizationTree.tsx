import { FigmaAsset } from '../../components/FigmaAsset'
import type { ItemListSpec, SummarySpec } from '../../spec/types'
import { PersonCard } from './PersonCard'
import {
  ASSET, CARD_ART, HQ, NODE, NODE_FIRST, POOL, SCREEN, leaderKey, memberKey, scalar,
} from './spec'
import type { OrganizationDraftModel } from './useOrganizationDraft'

/** 회장단과 부서별 부서장·부원을 이동 가능한 조직도로 표시한다. */
export function OrganizationTree({ model }: { model: OrganizationDraftModel }) {
  const { executives, editExecutives, addExecutive, departments, addDepartment } = model.specs
  const executiveCard = executives.itemFields![0].spec as SummarySpec
  const [headSpec, leaderList, memberList] = departments.itemFields!.map((entry) => entry.spec)

  return (
    <div className="flex flex-1 flex-col items-center">
      <div
        data-node-id={NODE.executives}
        className="w-full max-w-md rounded-md border border-gray-300 bg-white"
        {...model.dropTarget(HQ)}
      >
        <p className="flex items-center gap-2 rounded-t-md border-b border-gray-200 bg-gray-50 px-5 py-3 text-sm font-semibold text-gray-800">
          <FigmaAsset screenId={SCREEN} nodeId={ASSET.executiveIcon} className="size-4" />
          <span>{executives.title}</span>
          <button
            type="button"
            data-node-id={NODE.editExecutives}
            onClick={model.pressAction(editExecutives)}
            className="ml-auto text-xs font-medium text-gray-400 hover:text-gray-600 focus-visible:ring-2 focus-visible:ring-blue-600/50 focus-visible:outline-none"
          >
            {editExecutives.label}
          </button>
        </p>
        <div className="flex flex-wrap gap-3 px-5 pt-4">
          {model.idsAt(HQ).map((id, index) => (
            <PersonCard
              key={id}
              row={model.personOf(id)}
              spec={executiveCard}
              nodeId={index === 0 ? NODE_FIRST.executiveCard : undefined}
              releaseLabel={executives.itemMove!.releaseLabel}
              onRelease={() => model.move(id, POOL)}
              onDragStart={() => model.setDragging(id)}
              variant="executive"
              art={index === 0 ? CARD_ART.executive : CARD_ART.viceExecutive}
            />
          ))}
        </div>
        <button
          type="button"
          data-node-id={NODE.addExecutive}
          onClick={model.pressAction(addExecutive)}
          className="flex items-center gap-1 px-5 py-3 text-xs font-medium text-blue-500 hover:text-blue-600 focus-visible:ring-2 focus-visible:ring-blue-600/50 focus-visible:outline-none"
        >
          <FigmaAsset screenId={SCREEN} nodeId={ASSET.addExecutiveIcon} className="size-3" />
          {addExecutive.label}
        </button>
      </div>

      <span aria-hidden className="h-6 w-px bg-gray-300" />
      <div
        data-node-id={NODE.departments}
        className="flex w-full flex-wrap items-start justify-center gap-3"
      >
        {model.departmentRows.map((row, index) => {
          const id = scalar(row, 'id')
          const at = (nodeId: string) => (index === 0 ? nodeId : undefined)
          const leaders = leaderList as ItemListSpec
          const members = memberList as ItemListSpec
          return (
            <div key={id} className="w-72 rounded-md border border-gray-200 bg-white">
              <p
                data-node-id={at(NODE_FIRST.departmentHead)}
                className="flex items-center border-b border-gray-100 px-5 py-3 text-sm font-semibold text-gray-800"
              >
                <span>{scalar(row, (headSpec as SummarySpec).titleField!)}</span>
                <button
                  type="button"
                  aria-label={`${scalar(row, 'name')} 메뉴`}
                  onClick={() => {
                    const action = (headSpec as SummarySpec).action
                    if (action?.type === 'pending') model.setNote(action.note)
                  }}
                  className="ml-auto focus-visible:ring-2 focus-visible:ring-blue-600/50 focus-visible:outline-none"
                >
                  <FigmaAsset screenId={SCREEN} nodeId={ASSET.departmentMenu} className="size-4" />
                </button>
              </p>

              <div
                data-node-id={at(NODE_FIRST.leaderSection)}
                className="px-5 pt-4"
                {...model.dropTarget(leaderKey(id))}
              >
                <p className="text-xs text-gray-400">{leaders.title}</p>
                {model.idsAt(leaderKey(id)).length === 0 ? (
                  <button
                    type="button"
                    onClick={() => {
                      if (leaders.emptyAction?.type === 'pending') model.setNote(leaders.emptyAction.note)
                    }}
                    className="mt-2 rounded border border-dashed border-blue-300 px-3 py-1.5 text-xs font-medium text-blue-500 hover:bg-blue-50 focus-visible:ring-2 focus-visible:ring-blue-600/50 focus-visible:outline-none"
                  >
                    {leaders.emptyAction?.label}
                  </button>
                ) : (
                  model.idsAt(leaderKey(id)).map((memberId) => (
                    <PersonCard
                      key={memberId}
                      row={model.personOf(memberId)}
                      spec={leaders.itemFields![0].spec as SummarySpec}
                      nodeId={at(NODE_FIRST.leaderCard)}
                      releaseLabel={leaders.itemMove!.releaseLabel}
                      onRelease={() => model.move(memberId, POOL)}
                      onDragStart={() => model.setDragging(memberId)}
                      variant="leader"
                      art={CARD_ART.leader}
                    />
                  ))
                )}
              </div>

              <div
                data-node-id={at(NODE_FIRST.memberSection)}
                className="px-5 pt-4 pb-5"
                {...model.dropTarget(memberKey(id))}
              >
                <p className="text-xs text-gray-400">{scalar(row, members.titleField!)}</p>
                {model.idsAt(memberKey(id)).map((memberId, memberIndex) => (
                  <PersonCard
                    key={memberId}
                    row={model.personOf(memberId)}
                    spec={members.itemFields![0].spec as SummarySpec}
                    nodeId={memberIndex === 0 ? at(NODE_FIRST.memberCard) : undefined}
                    releaseLabel={members.itemMove!.releaseLabel}
                    onRelease={() => model.move(memberId, POOL)}
                    onDragStart={() => model.setDragging(memberId)}
                    variant="member"
                    art={CARD_ART.member}
                  />
                ))}
              </div>
            </div>
          )
        })}

        <button
          type="button"
          data-node-id={NODE.addDepartment}
          onClick={model.pressAction(addDepartment)}
          className="flex h-28 w-72 flex-col items-center justify-center gap-1 rounded-md border border-dashed border-gray-300 text-xs font-medium text-gray-400 hover:bg-gray-50 focus-visible:ring-2 focus-visible:ring-blue-600/50 focus-visible:outline-none"
        >
          <FigmaAsset screenId={SCREEN} nodeId={ASSET.addDepartmentIcon} className="size-4" />
          {addDepartment.label}
        </button>
      </div>

      {model.note === null ? null : (
        <p role="status" className="pt-6 text-xs text-gray-500">
          {model.note}
        </p>
      )}
      {model.submitAction.errorMessage === null ? null : (
        <p role="alert" className="pt-6 text-xs text-red-500">
          {model.submitAction.errorMessage}
        </p>
      )}
    </div>
  )
}
