import { ChoiceGroup } from '../../components/ChoiceGroup'
import { FigmaAsset } from '../../components/FigmaAsset'
import type { MessageRoomDraftModel } from './useMessageRoomDraft'
import { ASSET, NODE, NODE_FIRST, SCREEN } from './spec'

export function MessageRoomFields({ model }: { model: MessageRoomDraftModel }) {
  const {
    category,
    roomName,
    members,
    targets,
    memberQuery,
    rows,
    wholeDepartment,
    expandDepartment,
    field,
    roomNameError,
    draft,
    runPending,
  } = model
  return (
      <div className="flex flex-col gap-5 px-6 pt-5">
        {/* 분류 — 목록이 원격이다. '일반'과 행사들이 한 줄에 섞여 있어 명세가
            목록을 들 수 없다(message.roomCategories). 그림은 '일반'이 골라진
            모습이지만 원격 목록에서 처음 골라질 값을 명세가 부를 수 없어
            initialValue는 null이다. */}
        <div data-node-id={NODE.category} className="flex flex-col gap-1.5">
          <label id={`${category.fieldKey}-label`} className="text-xs font-semibold text-gray-700">
            <span>{category.label}</span>
            {category.required && <span className="text-red-500">*</span>}
          </label>
          <ChoiceGroup
            id={category.fieldKey}
            disabled={!field.isSelectEnabled(category)}
            labelledBy={`${category.fieldKey}-label`}
            hasError={field.errors[category.fieldKey] !== undefined}
            sourceKey={category.optionsSource.key}
            sourceParams={field.resolveSourceParams(category)}
            value={field.selectValue(category.fieldKey)}
            onSelect={(option) =>
              field.setFieldValue(category.fieldKey, option.value, option.label)
            }
            triggerRef={field.registerRef(category.fieldKey)}
          />
          {field.errors[category.fieldKey] && (
            <p id={`${category.fieldKey}-error`} className="text-xs text-red-500">
              {field.errors[category.fieldKey]}
            </p>
          )}
        </div>

        {/* 방 이름 — 이 프레임만 '선택'이라는 딱지로 required: false를 그린다.
            라벨 안에 넣으면 접근 이름이 '방 이름 선택'이 되므로 형제로 둔다. */}
        <div data-node-id={NODE.roomName} className="flex flex-col gap-1.5">
          <span className="flex items-baseline gap-1.5">
            <label
              htmlFor={roomName.fieldKey}
              className="text-xs font-semibold text-gray-700"
            >
              {roomName.label}
            </label>
            {!roomName.required && <span className="text-xs text-gray-400">선택</span>}
          </span>
          <input
            id={roomName.fieldKey}
            ref={field.registerRef(roomName.fieldKey)}
            type={roomName.inputType}
            value={draft.values[roomName.fieldKey] ?? roomName.initialValue ?? ''}
            placeholder={roomName.placeholder ?? undefined}
            aria-invalid={roomNameError === undefined ? undefined : true}
            onChange={(event) =>
              field.setFieldValue(
                roomName.fieldKey,
                event.target.value === '' ? null : event.target.value,
              )
            }
            className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 focus:outline-none"
          />
          <p className="text-xs text-gray-400">{roomName.helperText}</p>
          {roomNameError && <p className="text-xs text-red-500">{roomNameError}</p>}
        </div>

        {/* 구성원 — 고른 대상이 쌓이는 자리. 명세가 가진 것은 제목뿐이다. */}
        <div data-node-id={NODE.members}>
          <p className="text-xs font-semibold text-gray-700">{members.title}</p>
        </div>

        <div>
          <div data-node-id={NODE.targets} className="flex items-center justify-between gap-4">
            <p className="text-xs font-semibold text-gray-700">{targets.title}</p>
            <span
              data-node-id={NODE.memberQuery}
              className="flex w-56 items-center gap-2 rounded-md border border-gray-200 bg-white px-3 py-2"
            >
              <FigmaAsset screenId={SCREEN} nodeId={ASSET.search} className="size-3.5" />
              <input
                id={memberQuery.fieldKey}
                ref={field.registerRef(memberQuery.fieldKey)}
                type={memberQuery.inputType}
                aria-label={memberQuery.label}
                value={draft.values[memberQuery.fieldKey] ?? memberQuery.initialValue ?? ''}
                placeholder={memberQuery.placeholder ?? undefined}
                onChange={(event) =>
                  field.setFieldValue(
                    memberQuery.fieldKey,
                    event.target.value === '' ? null : event.target.value,
                  )
                }
                className="w-full text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none"
              />
            </span>
          </div>

          <div className="mt-2 rounded-md border border-gray-200">
            {rows.map((row, index) => (
              <div
                key={String(row.id)}
                // 되풀이되는 줄은 첫 사본만 design과 짝지어진다.
                data-node-id={index === 0 ? NODE.departments : undefined}
                className="flex items-center gap-3 border-b border-gray-100 px-4 py-3 last:border-b-0"
              >
                <FigmaAsset
                  screenId={SCREEN}
                  nodeId={ASSET.departmentIcon}
                  className="size-7 shrink-0"
                />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-bold text-gray-900">
                    {String(row.name)}
                  </span>
                  <span className="block text-xs text-gray-400">
                    {String(row.memberCountLabel)}
                  </span>
                </span>
                <button
                  type="button"
                  data-node-id={index === 0 ? NODE_FIRST.wholeDepartment : undefined}
                  onClick={() => runPending(wholeDepartment)}
                  className="rounded border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-50 focus-visible:ring-2 focus-visible:ring-blue-600/50 focus-visible:outline-none"
                >
                  {wholeDepartment.label}
                </button>
                <button
                  type="button"
                  data-node-id={index === 0 ? NODE_FIRST.expandDepartment : undefined}
                  aria-label={expandDepartment.label}
                  onClick={() => runPending(expandDepartment)}
                  className="focus-visible:ring-2 focus-visible:ring-blue-600/50 focus-visible:outline-none"
                >
                  <FigmaAsset screenId={SCREEN} nodeId={ASSET.expandIcon} className="size-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
  )
}
