import { EventSurveyImpact } from './EventSurveyImpact'
import { EventSurveyMode } from './EventSurveyMode'
import { EventSurveyReplacementActions } from './EventSurveyReplacementActions'
import type { EventSurveyReplacementModel } from './useEventSurveyReplacement'

export function EventSurveyReplacementPanel({
  model,
}: {
  model: EventSurveyReplacementModel
}) {
  return (
    <div className="flex justify-center pt-10">
      <div className="w-full max-w-[540px] overflow-hidden rounded-lg border border-gray-200 bg-white shadow-2xl">
        <EventSurveyImpact model={model} />
        <EventSurveyMode model={model} />
        <EventSurveyReplacementActions model={model} />
      </div>
    </div>
  )
}
