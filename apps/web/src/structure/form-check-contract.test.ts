import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { expect, test } from 'vitest'

// 구조 검사(저장소 AGENTS.md '화면 문구와 폼', notes Q-onboarding-1 묶음): 칸 확인(useFormCheck)이 빈 값만 보면 길이 상한 같은
// 계약 문제가 칸 확인을 지나 보내는 쪽의 safeParse에서 조용히 멈춘다. 버튼을 눌러도 아무 일이 없는 폼이 된다.
// 그래서 useFormCheck를 부르는 파일은 withContract를 거치거나, 계약 문제를 다른 길로 칸에 옮기는 까닭을 아래에 적는다.

const SRC = join(__dirname, '..')
const IGNORED_DIRS = new Set(['test-support', 'ui-gallery', '__snapshots__', 'structure'])

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap(name => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return IGNORED_DIRS.has(name) ? [] : sources(path)
    return /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : []
  })
}

const FORM_CHECK_CALL = /\buseFormCheck(?:<[^>]*>)?\(/

// withContract를 직접 부르지 않는 폼. 계약 문제가 칸 아래로 가는 길이나 계약이 필요 없는 까닭을 한 줄로 적는다.
const OTHER_ROUTE: Record<string, string> = {
  'auth/AgreementPanel.tsx': '동의 체크 칸뿐이라 계약이 막을 글이나 수가 없다',
  'calendar/ScheduleDialog.tsx': 'scheduleErrors가 계약 문제를 칸 이름으로 옮긴다',
  'councils/CreateBasicStep.tsx': 'basicErrors가 withContract를 거친다',
  'councils/CreateStructureStep.tsx': 'structureErrors가 withContract를 거친다',
  'councils/JoinCouncilViews.tsx': 'myNameErrors가 withContract를 거친다',
  'councils/NoCouncil.tsx': '계약 실패 전체를 초대 코드 칸의 글로 바꾼다',
  'finance/ShipmentFormDialog.tsx': 'shipmentErrors가 withContract를 거친다',
  'finance/use-decision-rows.ts': 'decisionErrors가 줄마다 계약을 대 withContract를 거친다',
  'meetings/MeetingCancelDialog.tsx': '계약 실패 전체를 사유 칸의 글로 바꾼다',
  'meetings/MeetingForm.tsx': 'meetingFormErrors가 계약 문제를 칸 이름으로 옮긴다',
  'profile/MyNameDialog.tsx': 'myNameErrors가 withContract를 거친다',
  'public/ApplyFields.tsx': 'applyErrors가 withContract를 거친다',
  'settings/CohortForm.tsx': 'termErrors가 withContract를 거친다',
}

const forms = sources(SRC)
  .map(path => ({
    path: relative(SRC, path).split(sep).join('/'),
    source: readFileSync(path, 'utf8'),
  }))
  .filter(({ path, source }) => FORM_CHECK_CALL.test(source) && path !== 'lib/use-form-check.ts')

test('칸 확인을 쓰는 폼은 계약 문제도 칸 아래에 보인다', () => {
  const silent = forms
    .filter(({ path, source }) => !source.includes('withContract(') && !(path in OTHER_ROUTE))
    .map(({ path }) => path)
  expect(silent).toEqual([])
})

test('예외 목록에 쓸모없어진 줄이 없다', () => {
  const direct = new Set(
    forms.filter(({ source }) => source.includes('withContract(')).map(({ path }) => path),
  )
  const known = new Set(forms.map(({ path }) => path))
  const stale = Object.keys(OTHER_ROUTE).filter(path => direct.has(path) || !known.has(path))
  expect(stale).toEqual([])
})
