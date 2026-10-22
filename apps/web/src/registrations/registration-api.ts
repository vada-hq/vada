const councilPath = (councilId: string) => `/api/organizations/${encodeURIComponent(councilId)}`
const part = encodeURIComponent

export const formsPath = (councilId: string, eventId: string) =>
  `${councilPath(councilId)}/events/${part(eventId)}/registration-forms`
export const formPath = (councilId: string, formId: string) =>
  `${councilPath(councilId)}/registration-forms/${part(formId)}`
export const applicantsPath = (councilId: string, formId: string) =>
  `${formPath(councilId, formId)}/applicants`
export const checkInPath = (councilId: string, eventId: string) =>
  `${councilPath(councilId)}/events/${part(eventId)}/check-in`
export const registrationPath = (councilId: string, registrationId: string) =>
  `${councilPath(councilId)}/registrations/${part(registrationId)}`
