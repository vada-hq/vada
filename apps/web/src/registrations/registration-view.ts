import type { RegistrationForm } from '@vada/contracts'
import { momentLabel } from '@/events/event-view'

// '10월 24일 (토) 14:00 ~ 10월 25일 (일) 18:00'. 시작이 없으면 마감만 적는다.
export const periodLabel = (form: Pick<RegistrationForm, 'opensAt' | 'closesAt'>) =>
  form.opensAt === null
    ? `${momentLabel(form.closesAt)}까지`
    : `${momentLabel(form.opensAt)} ~ ${momentLabel(form.closesAt)}`

// '신청 3/50명 · 출석 1명'. 정원이 없으면 신청 수만 적는다.
export const countLabel = (
  form: Pick<RegistrationForm, 'applicantCount' | 'capacity' | 'attendedCount'>,
) =>
  `신청 ${form.applicantCount}${form.capacity === null ? '' : `/${form.capacity}`}명 · 출석 ${form.attendedCount}명`

// 학생이 여는 공개 링크. 카톡방에 올리고 포스터 QR로 찍는다.
export const applyUrl = (publicCode: string) => `${window.location.origin}/apply/${publicCode}`
