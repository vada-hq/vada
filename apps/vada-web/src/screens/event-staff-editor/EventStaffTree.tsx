import { FigmaAsset } from '../../components/FigmaAsset'
import type { DataRow } from '../../data-sources/definitions'
import type { ItemListSpec, SelectSpec, SummarySpec } from '../../spec/types'
import { DepartmentSelect, LeaderPerson, MemberRow } from './StaffCards'
import { ASSET, DEPARTMENT_ART, HQ, NODE, NODE_FIRST, POOL, SCREEN, scalar } from './spec'
import type { EventStaffDraftModel } from './useEventStaffDraft'

function personOf(model: EventStaffDraftModel, id: string): DataRow {
  const person = model.people.get(id)
  if (person === undefined) throw new Error(`EVT-03B의 구성원 '${id}'를 찾을 수 없습니다.`)
  return person
}

/** 전체 책임자와 부서 카드로 이루어진 운영 조직을 표시한다. */
export function EventStaffTree({ model }: { model: EventStaffDraftModel }) {
  const { leaderCard, changeLeader, departments } = model.specs
  const [headSpec, deptLeader, memberList, addMember] = departments.itemFields!.map(
    (entry) => entry.spec,
  )

  return (
    <div className="flex flex-col items-center pt-6">
      <div data-node-id={NODE.leaderCard} className="w-48 rounded-md border border-gray-300 bg-white">
        <p className="flex items-center gap-1.5 rounded-t-md border-b border-gray-200 bg-gray-50 px-3 py-2 text-sm font-semibold text-gray-800">
          <FigmaAsset screenId={SCREEN} nodeId={ASSET.leaderCardIcon} className="size-3.5" />
          {leaderCard.title}
        </p>
        <div className="p-3">
          {model.idsAt(HQ).map((id, index) => (
            <LeaderPerson
              key={id}
              row={personOf(model, id)}
              spec={leaderCard.itemFields![0].spec as SummarySpec}
              nodeId={index === 0 ? NODE_FIRST.leaderPerson : undefined}
              releaseLabel={leaderCard.itemMove!.releaseLabel}
              onRelease={() => model.move(id, POOL)}
            />
          ))}
          <button
            type="button"
            data-node-id={NODE.changeLeader}
            onClick={model.pressAction(changeLeader)}
            className="mt-3 flex items-center gap-1 text-xs font-medium text-blue-500 hover:text-blue-600 focus-visible:ring-2 focus-visible:ring-blue-600/50 focus-visible:outline-none"
          >
            <FigmaAsset screenId={SCREEN} nodeId={ASSET.changeLeaderIcon} className="size-2.5" />
            {changeLeader.label}
          </button>
        </div>
      </div>

      <span aria-hidden className="h-6 w-px bg-gray-400" />
      <div
        data-node-id={NODE.departments}
        className="flex w-full flex-wrap items-start justify-center gap-3"
      >
        {model.departmentRows.map((row, index) => (
          <DepartmentCard
            key={scalar(row, 'id')}
            model={model}
            row={row}
            index={index}
            headSpec={headSpec as SummarySpec}
            leaderSpec={deptLeader as SelectSpec}
            memberSpec={memberList as ItemListSpec}
            addMemberSpec={addMember as SelectSpec}
          />
        ))}
      </div>
    </div>
  )
}

interface DepartmentCardProps {
  model: EventStaffDraftModel
  row: DataRow
  index: number
  headSpec: SummarySpec
  leaderSpec: SelectSpec
  memberSpec: ItemListSpec
  addMemberSpec: SelectSpec
}

function DepartmentCard({
  model,
  row,
  index,
  headSpec,
  leaderSpec,
  memberSpec,
  addMemberSpec,
}: DepartmentCardProps) {
  const departmentId = scalar(row, 'id')
  const art = DEPARTMENT_ART[Math.min(index, DEPARTMENT_ART.length - 1)]
  const at = (nodeId: string) => (index === 0 ? nodeId : undefined)
  const selectValue = (spec: SelectSpec) => {
    const key = model.fieldKeyOf(departmentId, spec.fieldKey)
    const stored = model.values[key]
    return typeof stored !== 'string' || stored === ''
      ? null
      : { value: stored, label: model.draft.labels[key] ?? stored }
  }
  const leaderKey = model.fieldKeyOf(departmentId, leaderSpec.fieldKey)
  const addMemberKey = model.fieldKeyOf(departmentId, addMemberSpec.fieldKey)

  return (
    <div className="w-56 rounded-md border border-gray-200 bg-white">
      <p
        data-node-id={at(NODE_FIRST.departmentHead)}
        className="flex items-center border-b border-gray-100 px-3 py-2 text-sm font-semibold text-gray-800"
      >
        <span>{scalar(row, headSpec.titleField!)}</span>
        <button
          type="button"
          aria-label={`${scalar(row, 'name')} ${headSpec.action?.label ?? ''}`}
          onClick={() => {
            if (headSpec.action?.type === 'pending') model.setNote(headSpec.action.note)
          }}
          className="ml-auto focus-visible:ring-2 focus-visible:ring-blue-600/50 focus-visible:outline-none"
        >
          <FigmaAsset screenId={SCREEN} nodeId={art.menu} className="size-4" />
        </button>
      </p>

      <div data-node-id={at(NODE_FIRST.departmentLeader)} className="px-3 pt-3">
        <label htmlFor={leaderKey} className="text-xs text-gray-400">
          {leaderSpec.label}
        </label>
        <div className="pt-1.5">
          <DepartmentSelect
            spec={leaderSpec}
            id={leaderKey}
            departmentId={departmentId}
            screenParams={model.screenParams}
            chevronNodeId={art.chevron}
            value={selectValue(leaderSpec)}
            onSelect={(option) =>
              model.write({ [leaderKey]: option.value }, { [leaderKey]: option.label })
            }
          />
        </div>
      </div>

      <div data-node-id={at(NODE_FIRST.memberSection)} className="px-3 pt-3">
        <p className="text-xs text-gray-400">{scalar(row, memberSpec.titleField!)}</p>
        {model.idsAt(model.memberKey(departmentId)).map((personId, memberIndex) => (
          <MemberRow
            key={personId}
            row={personOf(model, personId)}
            spec={memberSpec.itemFields![0].spec as SummarySpec}
            nodeId={memberIndex === 0 ? at(NODE_FIRST.memberCard) : undefined}
            releaseLabel={memberSpec.itemMove!.releaseLabel}
            releaseNodeId={art.release}
            onRelease={() => model.move(personId, POOL)}
          />
        ))}
      </div>

      <div data-node-id={at(NODE_FIRST.addMember)} className="px-3 pt-3 pb-3">
        <label htmlFor={addMemberKey} className="sr-only">
          {addMemberSpec.label}
        </label>
        <DepartmentSelect
          spec={addMemberSpec}
          id={addMemberKey}
          departmentId={departmentId}
          screenParams={model.screenParams}
          chevronNodeId={art.addChevron}
          value={selectValue(addMemberSpec)}
          onSelect={(option) => {
            model.write(
              { [addMemberKey]: option.value },
              { [addMemberKey]: option.label },
            )
            model.move(option.value, model.memberKey(departmentId))
          }}
        />
      </div>
    </div>
  )
}
