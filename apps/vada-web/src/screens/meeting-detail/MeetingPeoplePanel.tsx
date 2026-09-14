import { FigmaAsset } from '../../components/FigmaAsset'
import { MeetingStateChip } from '../meeting-shared/MeetingStateChip'
import { meetingScalar as scalar, type MeetingDetailModel } from './model'
import { ASSET, NODE, SCREEN } from './spec'
import { ReadOnlyMark, VariantButton } from './VariantControl'

export function MeetingPeoplePanel({ model }: { model: MeetingDetailModel }) {
  return (
    <section className="rounded-xl border border-gray-200 bg-white">
      <div
        data-node-id={NODE.peopleHeader}
        className="flex items-start justify-between gap-3 border-b border-gray-100 px-5 py-4"
      >
        <span>
          <span className="block text-sm font-bold text-gray-900">{model.peopleHeader.title}</span>
          <span className="block pt-1 text-xs font-normal text-gray-400">
            {scalar(model.detail, (model.peopleHeader.items ?? [])[0]?.field)}
          </span>
        </span>
        {model.variant === null ? null : model.variant.people.look === 'readonly' ? (
          <ReadOnlyMark model={model} slot={model.variant.people} />
        ) : (
          <VariantButton model={model} slot={model.variant.people} />
        )}
      </div>

      <ul data-node-id={NODE.people}>
        {model.peopleRows.length === 0 ? (
          <li className="px-5 py-4 text-xs font-normal text-gray-400">
            {model.peopleEmptyMessage}
          </li>
        ) : (
          model.peopleRows.map((person, at) => (
            <li
              key={String(person.memberId)}
              className={`flex items-center gap-3 px-5 py-3 ${
                at === model.peopleRows.length - 1 ? '' : 'border-b border-gray-100'
              }`}
            >
              <FigmaAsset screenId={SCREEN} nodeId={ASSET.person} className="size-7 shrink-0" />
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-1.5">
                  <span className="text-xs font-semibold text-gray-800">
                    {scalar(person, model.personField(0))}
                  </span>
                  {model.chipsOf(person).map((one, index) => (
                    <MeetingStateChip
                      key={`${String(person.memberId)}-${index}`}
                      label={String(one.label ?? '')}
                      tone={String(one.tone ?? '')}
                    />
                  ))}
                </span>
                <span className="block pt-0.5 text-xs font-normal text-gray-400">
                  {scalar(person, model.personField(2))}
                </span>
              </span>
              <span className="shrink-0 text-xs font-normal text-gray-400">
                {scalar(person, model.personField(3))}
              </span>
            </li>
          ))
        )}
      </ul>
    </section>
  )
}
